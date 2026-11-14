"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { categories, recurrences, transactions } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { requireUser } from "@/lib/auth";
import { parseBRL } from "@/lib/money";
import { run, type ActionResult } from "@/server/action-result";
import { getCategory, listCategories } from "@/server/queries";

const name = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Informe o nome.").max(60, "Nome muito longo (máx. 60)."));
const id = z.uuid();
const kind = z.enum(["receita", "despesa"]);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new DomainError(r.error.issues[0]?.message ?? "Dados inválidos.");
  return r.data;
}

const DUPLICATE = "Já existe uma categoria com esse nome aqui. Para juntar as duas, use “Mesclar”.";

async function ownCategory(userId: string, categoryId: string) {
  const c = await getCategory(userId, categoryId);
  if (!c) throw new DomainError("Categoria não encontrada.");
  return c;
}

export async function createCategory(input: {
  name: string;
  kind?: "receita" | "despesa";
  parentId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const result = await run(
    async () => {
      const data = parse(z.object({ name, kind: kind.optional(), parentId: id.nullish() }), input);
      let k = data.kind;
      if (data.parentId) {
        const parent = await ownCategory(user.id, data.parentId);
        if (parent.parentId) throw new DomainError("Subcategorias não podem ter subcategorias.");
        if (parent.archivedAt) throw new DomainError("Reative a categoria antes de adicionar subcategorias.");
        k = parent.kind;
      }
      if (!k) throw new DomainError("Escolha se é receita ou despesa.");
      const [row] = await db
        .insert(categories)
        .values({ userId: user.id, name: data.name, kind: k, parentId: data.parentId ?? null })
        .returning({ id: categories.id });
      return { id: row.id };
    },
    { unique: DUPLICATE },
  );
  if (result.ok) refresh();
  return result;
}

export async function renameCategory(input: { id: string; name: string }): Promise<ActionResult> {
  const user = await requireUser();
  const result = await run(
    async () => {
      const data = parse(z.object({ id, name }), input);
      await ownCategory(user.id, data.id);
      await db
        .update(categories)
        .set({ name: data.name })
        .where(and(eq(categories.id, data.id), eq(categories.userId, user.id)));
      return undefined;
    },
    { unique: DUPLICATE },
  );
  if (result.ok) refresh();
  return result;
}

/** Limite mensal simples (C2); texto vazio remove o limite. */
export async function setCategoryLimit(input: { id: string; limit: string }): Promise<ActionResult> {
  const user = await requireUser();
  const result = await run(async () => {
    const data = parse(z.object({ id, limit: z.string() }), input);
    const c = await ownCategory(user.id, data.id);
    if (c.kind !== "despesa") throw new DomainError("Limite mensal só vale para despesas.");
    let cents: number | null = null;
    if (data.limit.trim()) {
      cents = parseBRL(data.limit);
      if (cents === null || cents <= 0) throw new DomainError("Informe um valor maior que zero, ex.: 1.500,00");
    }
    await db
      .update(categories)
      .set({ monthlyLimitCents: cents })
      .where(and(eq(categories.id, data.id), eq(categories.userId, user.id)));
    return undefined;
  });
  if (result.ok) refresh();
  return result;
}

export async function setCategoryArchived(input: { id: string; archived: boolean }): Promise<ActionResult> {
  const user = await requireUser();
  const result = await run(async () => {
    const data = parse(z.object({ id, archived: z.boolean() }), input);
    const c = await ownCategory(user.id, data.id);
    if (!data.archived && c.parentId) {
      const parent = await ownCategory(user.id, c.parentId);
      if (parent.archivedAt) throw new DomainError(`Reative primeiro a categoria “${parent.name}”.`);
    }
    await db
      .update(categories)
      .set({ archivedAt: data.archived ? new Date() : null })
      .where(and(eq(categories.id, data.id), eq(categories.userId, user.id)));
    return undefined;
  });
  if (result.ok) refresh();
  return result;
}

/** Exclui só categoria sem uso; com lançamentos, o caminho é arquivar ou mesclar. */
export async function deleteCategory(input: { id: string }): Promise<ActionResult> {
  const user = await requireUser();
  const result = await run(
    async () => {
      const data = parse(z.object({ id }), input);
      await ownCategory(user.id, data.id);
      await db.delete(categories).where(and(eq(categories.id, data.id), eq(categories.userId, user.id)));
      return undefined;
    },
    {
      foreignKey:
        "Esta categoria tem lançamentos ou subcategorias. Arquive-a (some dos cadastros e mantém o histórico) ou mescle com outra.",
    },
  );
  if (result.ok) refresh();
  return result;
}

/**
 * Mescla `sourceId` em `targetId`: move lançamentos, séries e subcategorias
 * e apaga a origem. Útil para juntar duplicadas ("Luz" e "Energia").
 */
export async function mergeCategory(input: { sourceId: string; targetId: string }): Promise<ActionResult> {
  const user = await requireUser();
  const result = await run(async () => {
    const data = parse(z.object({ sourceId: id, targetId: id }), input);
    if (data.sourceId === data.targetId) throw new DomainError("Escolha uma categoria diferente.");
    const [source, target] = await Promise.all([ownCategory(user.id, data.sourceId), ownCategory(user.id, data.targetId)]);
    if (source.kind !== target.kind) throw new DomainError("Só dá para mesclar categorias da mesma natureza.");
    if (target.parentId === source.id) throw new DomainError("Não dá para mesclar uma categoria com a própria subcategoria.");

    const all = await listCategories(user.id);
    const sourceChildren = all.filter((c) => c.parentId === source.id);
    if (sourceChildren.length > 0 && target.parentId) {
      throw new DomainError("Uma categoria com subcategorias só pode ser mesclada com outra categoria principal.");
    }

    await db.transaction(async (tx) => {
      /** Move lançamentos e séries de uma categoria para outra. */
      const moveEntries = async (from: string, to: string) => {
        await tx
          .update(transactions)
          .set({ categoryId: to })
          .where(and(eq(transactions.categoryId, from), eq(transactions.userId, user.id)));
        await tx
          .update(recurrences)
          .set({ categoryId: to })
          .where(and(eq(recurrences.categoryId, from), eq(recurrences.userId, user.id)));
      };
      const ownCat = (catId: string) => and(eq(categories.id, catId), eq(categories.userId, user.id));

      await moveEntries(source.id, target.id);

      // subcategorias da origem: as de mesmo nome são mescladas, as demais mudam de mãe
      for (const child of sourceChildren) {
        const twin = all.find(
          (c) => c.parentId === target.id && c.name.localeCompare(child.name, "pt-BR", { sensitivity: "base" }) === 0,
        );
        if (twin) {
          await moveEntries(child.id, twin.id);
          await tx.delete(categories).where(ownCat(child.id));
        } else {
          await tx.update(categories).set({ parentId: target.id }).where(ownCat(child.id));
        }
      }
      if (!target.monthlyLimitCents && source.monthlyLimitCents) {
        await tx.update(categories).set({ monthlyLimitCents: source.monthlyLimitCents }).where(ownCat(target.id));
      }
      await tx.delete(categories).where(ownCat(source.id));
    });
    return undefined;
  });
  if (result.ok) refresh();
  return result;
}

const STARTER: { name: string; kind: "receita" | "despesa"; children: string[] }[] = [
  { name: "Renda", kind: "receita", children: ["Salário", "Extras"] },
  { name: "Moradia", kind: "despesa", children: ["Aluguel", "Condomínio", "Luz", "Água", "Internet"] },
  { name: "Alimentação", kind: "despesa", children: ["Mercado", "Restaurantes"] },
  { name: "Transporte", kind: "despesa", children: ["Combustível", "Aplicativos"] },
  { name: "Saúde", kind: "despesa", children: ["Plano de saúde", "Farmácia"] },
  { name: "Lazer", kind: "despesa", children: [] },
];

/** Cria um conjunto inicial de categorias (só se o usuário ainda não tem nenhuma). */
export async function createStarterCategories(): Promise<ActionResult> {
  const user = await requireUser();
  const result = await run(async () => {
    await db.transaction(async (tx) => {
      const existing = await tx.select({ id: categories.id }).from(categories).where(eq(categories.userId, user.id)).limit(1);
      if (existing.length) throw new DomainError("Você já tem categorias cadastradas.");
      for (const p of STARTER) {
        const [parent] = await tx
          .insert(categories)
          .values({ userId: user.id, name: p.name, kind: p.kind })
          .returning({ id: categories.id });
        if (p.children.length) {
          await tx
            .insert(categories)
            .values(p.children.map((n) => ({ userId: user.id, name: n, kind: p.kind, parentId: parent.id })));
        }
      }
    });
    return undefined;
  });
  if (result.ok) refresh();
  return result;
}
