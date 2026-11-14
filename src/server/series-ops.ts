import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { recurrences, transactions } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import type { SeriesOp } from "@/domain/series-edit";

/**
 * Executa um plano de `series-edit` numa única transação, NA ORDEM.
 * Toda operação é restrita ao `userId`; se alguma não encontrar a linha
 * esperada (ex.: foi alterada em outra aba), tudo é desfeito.
 */
export async function executeSeriesOps(userId: string, ops: readonly SeriesOp[]) {
  await db.transaction(async (tx) => {
    const expectOne = (rows: unknown[], what: string) => {
      if (rows.length !== 1) throw new DomainError(`${what} não encontrado(a). Recarregue a tela e tente de novo.`);
    };

    for (const op of ops) {
      switch (op.type) {
        case "createRecurrence":
          await tx.insert(recurrences).values({ ...op.values, excludedDates: [...op.values.excludedDates], userId });
          break;

        case "updateRecurrence": {
          const { excludedDates, ...rest } = op.patch;
          const rows = await tx
            .update(recurrences)
            .set({ ...rest, ...(excludedDates ? { excludedDates: [...excludedDates] } : {}) })
            .where(and(eq(recurrences.id, op.id), eq(recurrences.userId, userId)))
            .returning({ id: recurrences.id });
          expectOne(rows, "Série");
          break;
        }

        case "deleteRecurrence": {
          const rows = await tx
            .delete(recurrences)
            .where(and(eq(recurrences.id, op.id), eq(recurrences.userId, userId)))
            .returning({ id: recurrences.id });
          expectOne(rows, "Série");
          break;
        }

        case "upsertOverride": {
          const { recurrenceId, recurrenceDate, ...values } = op.values;
          await tx
            .insert(transactions)
            .values({ ...values, recurrenceId, recurrenceDate, userId })
            .onConflictDoUpdate({
              target: [transactions.recurrenceId, transactions.recurrenceDate],
              set: { ...values, updatedAt: new Date() },
              setWhere: eq(transactions.userId, userId),
            });
          break;
        }

        case "updateTransaction": {
          const rows = await tx
            .update(transactions)
            .set(op.patch)
            .where(and(eq(transactions.id, op.id), eq(transactions.userId, userId)))
            .returning({ id: transactions.id });
          expectOne(rows, "Lançamento");
          break;
        }

        case "deleteTransaction": {
          const rows = await tx
            .delete(transactions)
            .where(and(eq(transactions.id, op.id), eq(transactions.userId, userId)))
            .returning({ id: transactions.id });
          expectOne(rows, "Lançamento");
          break;
        }
      }
    }
  });
}
