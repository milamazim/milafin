"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { recurrences, transactions } from "@/db/schema";
import { isValidISODate } from "@/domain/dates";
import { DomainError } from "@/domain/errors";
import { FREQUENCIES, isOccurrence, validateRule } from "@/domain/recurrence";
import { planDeleteOccurrence, planEditOccurrence, planMarkPaidBefore } from "@/domain/series-edit";
import { requireUser } from "@/lib/auth";
import { isActive } from "@/lib/category-tree";
import { todayISO } from "@/lib/format";
import { parseBRL } from "@/lib/money";
import { run, type ActionResult } from "@/server/action-result";
import {
  getCategory,
  getTransaction,
  listCategories,
  loadOverrideRows,
  loadRecurrenceRow,
  loadSeriesStartedBefore,
} from "@/server/queries";
import { executeSeriesOps } from "@/server/series-ops";

/* ------------------------------------------------------------- validação */

const isoDate = z.string().refine(isValidISODate, "Data inválida.");
const uuid = z.uuid();
const amount = z.string().transform((s, ctx) => {
  const cents = parseBRL(s);
  if (cents === null || cents <= 0) {
    ctx.addIssue({ code: "custom", message: "Informe um valor maior que zero, ex.: 1.234,56" });
    return z.NEVER;
  }
  return cents;
});
const note = z
  .string()
  .nullish()
  .transform((s) => (s?.trim() ? s.trim() : null))
  .pipe(z.string().max(500, "Observação muito longa (máx. 500).").nullable());
const scope = z.enum(["este", "deste-em-diante", "toda"]);
const frequency = z.enum(FREQUENCIES);

const entryFields = { categoryId: uuid, amount, date: isoDate, paid: z.boolean(), note };

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new DomainError(r.error.issues[0]?.message ?? "Dados inválidos.");
  return r.data;
}

/** A categoria é do usuário e pode receber lançamentos (ou é a que já estava). */
async function checkCategory(userId: string, categoryId: string, currentCategoryId?: string) {
  const c = await getCategory(userId, categoryId);
  if (!c) throw new DomainError("Categoria não encontrada.");
  if (categoryId === currentCategoryId) return;
  const all = await listCategories(userId);
  if (!isActive(c, all)) throw new DomainError("Esta categoria está arquivada.");
  if (!c.parentId && all.some((x) => x.parentId === c.id && isActive(x, all))) {
    throw new DomainError(`Escolha uma subcategoria de “${c.name}”.`);
  }
}

async function done<T>(result: Promise<ActionResult<T>>) {
  const r = await result;
  if (r.ok) refresh();
  return r;
}

/* ----------------------------------------------------------------- criar */

export type NewEntryInput = {
  categoryId: string;
  amount: string;
  date: string;
  paid: boolean;
  note?: string | null;
} & ({ recurring: false } | { recurring: true; frequency: (typeof FREQUENCIES)[number]; endDate?: string | null });

export async function createEntry(input: NewEntryInput): Promise<ActionResult> {
  const user = await requireUser();
  return done(
    run(async () => {
      const data = parse(
        z.discriminatedUnion("recurring", [
          z.object({ ...entryFields, recurring: z.literal(false) }),
          z.object({ ...entryFields, recurring: z.literal(true), frequency, endDate: isoDate.nullish() }),
        ]),
        input,
      );
      await checkCategory(user.id, data.categoryId);
      const base = { userId: user.id, categoryId: data.categoryId, amountCents: data.amount, note: data.note };

      if (!data.recurring) {
        await db.insert(transactions).values({ ...base, date: data.date, paid: data.paid });
        return undefined;
      }

      const rule = { frequency: data.frequency, startDate: data.date, endDate: data.endDate ?? null, excludedDates: [] };
      validateRule(rule);
      await db.transaction(async (tx) => {
        const [r] = await tx
          .insert(recurrences)
          .values({ ...base, ...rule })
          .returning({ id: recurrences.id });
        // "pago" no cadastro vale para a primeira ocorrência
        if (data.paid) {
          await tx.insert(transactions).values({
            ...base,
            date: data.date,
            paid: true,
            recurrenceId: r.id,
            recurrenceDate: data.date,
          });
        }
      });
      return undefined;
    }),
  );
}

/* --------------------------------------------------------- avulso: editar */

export async function updateTransaction(input: {
  id: string;
  categoryId: string;
  amount: string;
  date: string;
  paid: boolean;
  note?: string | null;
}): Promise<ActionResult> {
  const user = await requireUser();
  return done(
    run(async () => {
      const data = parse(z.object({ id: uuid, ...entryFields }), input);
      const current = await getTransaction(user.id, data.id);
      if (!current || current.recurrenceId) throw new DomainError("Lançamento não encontrado. Recarregue a tela.");
      await checkCategory(user.id, data.categoryId, current.categoryId);
      await db
        .update(transactions)
        .set({ categoryId: data.categoryId, amountCents: data.amount, date: data.date, paid: data.paid, note: data.note })
        .where(and(eq(transactions.id, data.id), eq(transactions.userId, user.id)));
      return undefined;
    }),
  );
}

export async function deleteTransaction(input: { id: string }): Promise<ActionResult> {
  const user = await requireUser();
  return done(
    run(async () => {
      const { id } = parse(z.object({ id: uuid }), input);
      const current = await getTransaction(user.id, id);
      if (!current || current.recurrenceId) throw new DomainError("Lançamento não encontrado. Recarregue a tela.");
      await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
      return undefined;
    }),
  );
}

/* ------------------------------------------------------ série: ocorrência */

async function loadTarget(userId: string, recurrenceId: string, recurrenceDate: string) {
  const series = await loadRecurrenceRow(userId, recurrenceId);
  if (!series) throw new DomainError("Série não encontrada. Recarregue a tela.");
  const overrides = await loadOverrideRows(userId, recurrenceId);
  return { series, overrides, recurrenceDate };
}

export async function editOccurrence(input: {
  recurrenceId: string;
  recurrenceDate: string;
  scope: "este" | "deste-em-diante" | "toda";
  categoryId: string;
  amount: string;
  date: string;
  paid: boolean;
  note?: string | null;
  frequency?: (typeof FREQUENCIES)[number];
}): Promise<ActionResult> {
  const user = await requireUser();
  return done(
    run(async () => {
      const data = parse(
        z.object({
          recurrenceId: uuid,
          recurrenceDate: isoDate,
          scope,
          frequency: frequency.optional(),
          ...entryFields,
        }),
        input,
      );
      const target = await loadTarget(user.id, data.recurrenceId, data.recurrenceDate);
      const current = target.overrides.find((o) => o.recurrenceDate === data.recurrenceDate);
      await checkCategory(user.id, data.categoryId, current?.categoryId ?? target.series.categoryId);
      const ops = planEditOccurrence({
        ...target,
        scope: data.scope,
        edit: {
          categoryId: data.categoryId,
          amountCents: data.amount,
          date: data.date,
          paid: data.paid,
          note: data.note,
          frequency: data.frequency,
        },
      });
      await executeSeriesOps(user.id, ops);
      return undefined;
    }),
  );
}

export async function deleteOccurrence(input: {
  recurrenceId: string;
  recurrenceDate: string;
  scope: "este" | "deste-em-diante" | "toda";
}): Promise<ActionResult> {
  const user = await requireUser();
  return done(
    run(async () => {
      const data = parse(z.object({ recurrenceId: uuid, recurrenceDate: isoDate, scope }), input);
      const target = await loadTarget(user.id, data.recurrenceId, data.recurrenceDate);
      await executeSeriesOps(user.id, planDeleteOccurrence({ ...target, scope: data.scope }));
      return undefined;
    }),
  );
}

/* ----------------------------------------- anteriores a hoje como pagas */

/**
 * Marca como pagas as ocorrências de séries com data anterior a hoje que
 * ainda não foram pagas. Com `recurrenceId`, só daquela série; sem, de todas.
 * Tudo numa transação. Devolve quantas ocorrências foram marcadas.
 */
export async function markPastPaid(input: { recurrenceId?: string } = {}): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  return done(
    run(async () => {
      const { recurrenceId } = parse(z.object({ recurrenceId: uuid.optional() }), input);
      const today = todayISO();
      let targets = await loadSeriesStartedBefore(user.id, today);
      if (recurrenceId) {
        targets = targets.filter((t) => t.series.id === recurrenceId);
        if (!targets.length && !(await loadRecurrenceRow(user.id, recurrenceId))) {
          throw new DomainError("Série não encontrada. Recarregue a tela.");
        }
      }
      const ops = targets.flatMap((t) => planMarkPaidBefore({ ...t, before: today }));
      if (ops.length) await executeSeriesOps(user.id, ops);
      return { count: ops.length };
    }),
  );
}

/* ------------------------------------------------------------------ pago */

/** Marca/desmarca pago num avulso ou numa ocorrência de série. */
export async function setPaid(
  input: { transactionId: string; paid: boolean } | { recurrenceId: string; recurrenceDate: string; paid: boolean },
): Promise<ActionResult> {
  const user = await requireUser();
  return done(
    run(async () => {
      if ("transactionId" in input) {
        const { transactionId, paid } = parse(z.object({ transactionId: uuid, paid: z.boolean() }), input);
        const rows = await db
          .update(transactions)
          .set({ paid })
          .where(and(eq(transactions.id, transactionId), eq(transactions.userId, user.id)))
          .returning({ id: transactions.id });
        if (!rows.length) throw new DomainError("Lançamento não encontrado. Recarregue a tela.");
        return undefined;
      }

      const data = parse(z.object({ recurrenceId: uuid, recurrenceDate: isoDate, paid: z.boolean() }), input);
      const target = await loadTarget(user.id, data.recurrenceId, data.recurrenceDate);
      if (!isOccurrence(target.series, data.recurrenceDate)) {
        throw new DomainError("Esta ocorrência não existe mais na série. Recarregue a tela.");
      }
      const current = target.overrides.find((o) => o.recurrenceDate === data.recurrenceDate);
      const values = current ?? { ...target.series, date: data.recurrenceDate };
      await executeSeriesOps(
        user.id,
        planEditOccurrence({
          ...target,
          scope: "este",
          edit: {
            categoryId: values.categoryId,
            amountCents: values.amountCents,
            date: values.date,
            note: values.note,
            paid: data.paid,
          },
        }),
      );
      return undefined;
    }),
  );
}
