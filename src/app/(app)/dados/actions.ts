"use server";

import { and, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { refresh } from "next/cache";

import { db } from "@/db";
import { categories, recurrences, transactions } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { requireUser } from "@/lib/auth";
import { parseBackup, planRestore, type RestoreMode } from "@/lib/backup";
import { run, type ActionResult } from "@/server/action-result";

/** Limite do arquivo (o corpo da action vai até 4 MB; ver next.config.ts). */
const MAX_BYTES = 3.5 * 1024 * 1024;
const CHUNK = 500;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Apaga tudo do usuário, respeitando as chaves (filhas antes das mães). */
async function wipe(tx: Tx, userId: string) {
  await tx.delete(transactions).where(eq(transactions.userId, userId));
  await tx.delete(recurrences).where(eq(recurrences.userId, userId));
  await tx.delete(categories).where(and(eq(categories.userId, userId), isNotNull(categories.parentId)));
  await tx.delete(categories).where(and(eq(categories.userId, userId), isNull(categories.parentId)));
}

async function insertChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

export type RestoreSummary = {
  inserted: { categories: number; recurrences: number; transactions: number };
  skipped: { categories: number; recurrences: number; transactions: number };
};

/**
 * Restaura um backup .json. "mesclar" acrescenta o que falta sem duplicar;
 * "substituir" apaga tudo antes. Uma transação: se algo falhar, nada muda.
 */
export async function restoreBackup(formData: FormData): Promise<ActionResult<RestoreSummary>> {
  const user = await requireUser();
  const result = await run(async () => {
    const file = formData.get("file");
    const mode = formData.get("mode") as RestoreMode;
    if (!(file instanceof File) || file.size === 0) throw new DomainError("Escolha um arquivo de backup (.json).");
    if (file.size > MAX_BYTES) throw new DomainError("Arquivo grande demais (máx. 3,5 MB).");
    if (mode !== "mesclar" && mode !== "substituir") throw new DomainError("Escolha como restaurar.");

    const parsed = parseBackup(await file.text());
    if (!parsed.ok) throw new DomainError(parsed.error);
    const { backup } = parsed;
    const fileIds = [...backup.data.categories, ...backup.data.recurrences, ...backup.data.transactions].map((x) => x.id);

    return db.transaction(async (tx) => {
      if (mode === "substituir") await wipe(tx, user.id);

      const [cats, recs, txs] = await Promise.all([
        tx
          .select({ id: categories.id, parentId: categories.parentId, name: categories.name, kind: categories.kind })
          .from(categories)
          .where(eq(categories.userId, user.id)),
        tx.select({ id: recurrences.id }).from(recurrences).where(eq(recurrences.userId, user.id)),
        tx
          .select({ id: transactions.id, recurrenceId: transactions.recurrenceId, recurrenceDate: transactions.recurrenceDate })
          .from(transactions)
          .where(eq(transactions.userId, user.id)),
      ]);

      // ids do arquivo que já pertencem a OUTRA pessoa precisam de id novo
      const taken = new Set<string>();
      for (let i = 0; i < fileIds.length; i += CHUNK) {
        const ids = fileIds.slice(i, i + CHUNK);
        const rows = await Promise.all([
          tx.select({ id: categories.id }).from(categories).where(and(inArray(categories.id, ids), ne(categories.userId, user.id))),
          tx.select({ id: recurrences.id }).from(recurrences).where(and(inArray(recurrences.id, ids), ne(recurrences.userId, user.id))),
          tx.select({ id: transactions.id }).from(transactions).where(and(inArray(transactions.id, ids), ne(transactions.userId, user.id))),
        ]);
        rows.flat().forEach((r) => taken.add(r.id));
      }

      const plan = planRestore(
        backup,
        {
          categories: cats,
          recurrenceIds: new Set(recs.map((r) => r.id)),
          transactionIds: new Set(txs.map((t) => t.id)),
          overrideKeys: new Set(txs.filter((t) => t.recurrenceId).map((t) => `${t.recurrenceId}|${t.recurrenceDate}`)),
          takenIds: taken,
        },
        () => crypto.randomUUID(),
      );

      await insertChunks(plan.categories, (chunk) =>
        tx.insert(categories).values(
          chunk.map((c) => ({ ...c, userId: user.id, archivedAt: c.archivedAt ? new Date(c.archivedAt) : null })),
        ),
      );
      await insertChunks(plan.recurrences, (chunk) =>
        tx.insert(recurrences).values(chunk.map((r) => ({ ...r, userId: user.id }))),
      );
      await insertChunks(plan.transactions, (chunk) =>
        tx.insert(transactions).values(chunk.map((t) => ({ ...t, userId: user.id }))),
      );

      return {
        inserted: {
          categories: plan.categories.length,
          recurrences: plan.recurrences.length,
          transactions: plan.transactions.length,
        },
        skipped: plan.skipped,
      };
    });
  });
  if (result.ok) refresh();
  return result;
}

/** Apaga todos os dados financeiros do usuário (a conta continua existindo). */
export async function deleteAllData(input: { confirm: string }): Promise<ActionResult> {
  const user = await requireUser();
  const result = await run(async () => {
    if (input?.confirm?.trim().toUpperCase() !== "APAGAR") throw new DomainError("Digite APAGAR para confirmar.");
    await db.transaction((tx) => wipe(tx, user.id));
    return undefined;
  });
  if (result.ok) refresh();
  return result;
}

