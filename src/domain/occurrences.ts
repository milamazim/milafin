/**
 * Junta, num período, tudo o que aparece na grade e na lista do mês:
 * - lançamentos avulsos;
 * - ocorrências calculadas das séries (sem linha no banco);
 * - ocorrências editadas isoladamente ("substituições"): linhas de
 *   `transactions` com `recurrenceId` + `recurrenceDate`, que tomam o lugar
 *   da ocorrência calculada daquela data (valor, data, pago, observação…).
 */
import type { ISODate } from "./dates";
import { occurrenceDates, type RecurrenceRule } from "./recurrence";

/** Subconjunto de `transactions` usado pelo domínio. */
export interface TransactionRow {
  id: string;
  categoryId: string;
  amountCents: number;
  date: ISODate;
  paid: boolean;
  note: string | null;
  recurrenceId: string | null;
  recurrenceDate: ISODate | null;
}

/** Subconjunto de `recurrences` usado pelo domínio. */
export interface RecurrenceRow extends RecurrenceRule {
  id: string;
  categoryId: string;
  amountCents: number;
  note: string | null;
}

export interface Occurrence {
  /** Identidade estável na interface (não muda ao editar só esta ocorrência). */
  key: string;
  kind: "avulso" | "recorrente";
  /** Linha em `transactions`, se existir (avulso ou ocorrência editada). */
  transactionId: string | null;
  recurrenceId: string | null;
  /** Data original na série (identifica a ocorrência). */
  recurrenceDate: ISODate | null;
  categoryId: string;
  amountCents: number;
  /** Data efetiva (pode diferir da original se foi editada). */
  date: ISODate;
  paid: boolean;
  note: string | null;
  /** Ocorrência de série com valores próprios (editada "só esta"). */
  edited: boolean;
}

export const occurrenceKey = (recurrenceId: string, recurrenceDate: ISODate) => `r:${recurrenceId}:${recurrenceDate}`;

/**
 * Ocorrências com data efetiva em [from, to], ordenadas por data.
 *
 * IMPORTANTE: `transactions` precisa conter TODAS as substituições das séries
 * cuja data original (`recurrenceDate`) está no período — inclusive as que
 * foram movidas para fora dele. Senão a ocorrência calculada reapareceria.
 * Consulta sugerida: `date BETWEEN from AND to OR recurrence_date BETWEEN from AND to`.
 */
export function buildOccurrences(input: {
  transactions: readonly TransactionRow[];
  recurrences: readonly RecurrenceRow[];
  from: ISODate;
  to: ISODate;
}): Occurrence[] {
  const { transactions, recurrences, from, to } = input;
  const out: Occurrence[] = [];
  const overridden = new Set<string>();

  for (const t of transactions) {
    const fromSeries = t.recurrenceId !== null && t.recurrenceDate !== null;
    if (fromSeries) overridden.add(occurrenceKey(t.recurrenceId!, t.recurrenceDate!));
    if (t.date < from || t.date > to) continue;
    out.push({
      key: fromSeries ? occurrenceKey(t.recurrenceId!, t.recurrenceDate!) : `t:${t.id}`,
      kind: fromSeries ? "recorrente" : "avulso",
      transactionId: t.id,
      recurrenceId: t.recurrenceId,
      recurrenceDate: t.recurrenceDate,
      categoryId: t.categoryId,
      amountCents: t.amountCents,
      date: t.date,
      paid: t.paid,
      note: t.note,
      edited: fromSeries,
    });
  }

  for (const r of recurrences) {
    for (const date of occurrenceDates(r, from, to)) {
      const key = occurrenceKey(r.id, date);
      if (overridden.has(key)) continue;
      out.push({
        key,
        kind: "recorrente",
        transactionId: null,
        recurrenceId: r.id,
        recurrenceDate: date,
        categoryId: r.categoryId,
        amountCents: r.amountCents,
        date,
        paid: false,
        note: r.note,
        edited: false,
      });
    }
  }

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : 1));
}
