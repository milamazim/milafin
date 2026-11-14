import "server-only";

import { and, asc, between, count, eq, gte, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db";
import { categories, recurrences, transactions } from "@/db/schema";
import { buildOccurrences, type Occurrence, type RecurrenceRow, type TransactionRow } from "@/domain/occurrences";
import type { ISODate } from "@/domain/dates";

/* Todas as consultas recebem o `userId` de `requireUser()` e filtram por ele. */

export async function listCategories(userId: string) {
  return db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.kind), asc(categories.sortOrder), asc(categories.name));
}

export async function getCategory(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return row ?? null;
}

export async function getRecurrence(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(recurrences)
    .where(and(eq(recurrences.id, id), eq(recurrences.userId, userId)));
  return row ?? null;
}

export async function getTransaction(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  return row ?? null;
}

/** Quantos lançamentos e séries usam cada categoria. */
export async function categoryUsage(userId: string): Promise<Map<string, number>> {
  const [tx, rec] = await Promise.all([
    db
      .select({ id: transactions.categoryId, n: count() })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .groupBy(transactions.categoryId),
    db
      .select({ id: recurrences.categoryId, n: count() })
      .from(recurrences)
      .where(eq(recurrences.userId, userId))
      .groupBy(recurrences.categoryId),
  ]);
  const map = new Map<string, number>();
  for (const r of [...tx, ...rec]) map.set(r.id, (map.get(r.id) ?? 0) + r.n);
  return map;
}

/** Substituições (ocorrências editadas) de uma série. */
export async function listOverrides(userId: string, recurrenceId: string) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.recurrenceId, recurrenceId)));
}

const toTransactionRow = (t: typeof transactions.$inferSelect): TransactionRow => ({
  id: t.id,
  categoryId: t.categoryId,
  amountCents: t.amountCents,
  date: t.date,
  paid: t.paid,
  note: t.note,
  recurrenceId: t.recurrenceId,
  recurrenceDate: t.recurrenceDate,
});

const toRecurrenceRow = (r: typeof recurrences.$inferSelect): RecurrenceRow => ({
  id: r.id,
  categoryId: r.categoryId,
  amountCents: r.amountCents,
  note: r.note,
  frequency: r.frequency,
  startDate: r.startDate,
  endDate: r.endDate,
  excludedDates: r.excludedDates,
});

/**
 * Ocorrências (avulsos + séries + editadas) com data efetiva em [from, to],
 * e as séries ativas no período (para mostrar a regra na edição).
 */
export async function loadPeriod(
  userId: string,
  from: ISODate,
  to: ISODate,
): Promise<{ occurrences: Occurrence[]; recurrences: RecurrenceRow[] }> {
  const [txRows, recRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          // inclui substituições movidas para fora do período (ver buildOccurrences)
          or(between(transactions.date, from, to), between(transactions.recurrenceDate, from, to)),
        ),
      ),
    db
      .select()
      .from(recurrences)
      .where(
        and(
          eq(recurrences.userId, userId),
          lte(recurrences.startDate, to),
          or(isNull(recurrences.endDate), gte(recurrences.endDate, from)),
        ),
      ),
  ]);

  const recs = recRows.map(toRecurrenceRow);
  return {
    occurrences: buildOccurrences({ transactions: txRows.map(toTransactionRow), recurrences: recs, from, to }),
    recurrences: recs,
  };
}

export async function loadRecurrenceRow(userId: string, id: string): Promise<RecurrenceRow | null> {
  const r = await getRecurrence(userId, id);
  return r ? toRecurrenceRow(r) : null;
}

export async function loadOverrideRows(userId: string, recurrenceId: string): Promise<TransactionRow[]> {
  return (await listOverrides(userId, recurrenceId)).map(toTransactionRow);
}
