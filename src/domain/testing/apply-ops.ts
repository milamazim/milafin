/**
 * Simulador em memória do plano de `series-edit` (só para testes): aplica as
 * operações NA ORDEM, com as mesmas restrições do banco — chave única
 * (recurrence_id, recurrence_date), ON DELETE CASCADE e fim ≥ início.
 */
import type { RecurrenceRow, TransactionRow } from "../occurrences";
import type { SeriesOp } from "../series-edit";

export interface MemoryDb {
  recurrences: RecurrenceRow[];
  transactions: TransactionRow[];
}

export function applyOps(db: MemoryDb, ops: readonly SeriesOp[], newTxId = seqId("tx")): MemoryDb {
  const recurrences = db.recurrences.map((r) => ({ ...r }));
  let transactions = db.transactions.map((t) => ({ ...t }));

  const checkUnique = () => {
    const seen = new Set<string>();
    for (const t of transactions) {
      if (t.recurrenceId === null) continue;
      const k = `${t.recurrenceId}|${t.recurrenceDate}`;
      if (seen.has(k)) throw new Error(`violação de chave única: ${k}`);
      seen.add(k);
    }
  };
  const checkRule = (r: RecurrenceRow) => {
    if (r.endDate !== null && r.endDate < r.startDate) throw new Error(`fim antes do início em ${r.id}`);
  };
  const recurrence = (id: string) => {
    const r = recurrences.find((x) => x.id === id);
    if (!r) throw new Error(`série inexistente: ${id}`);
    return r;
  };
  const tx = (id: string) => {
    const t = transactions.find((x) => x.id === id);
    if (!t) throw new Error(`lançamento inexistente: ${id}`);
    return t;
  };

  for (const op of ops) {
    switch (op.type) {
      case "createRecurrence":
        if (recurrences.some((r) => r.id === op.values.id)) throw new Error("id duplicado");
        checkRule(op.values);
        recurrences.push({ ...op.values });
        break;
      case "updateRecurrence": {
        const r = recurrence(op.id);
        Object.assign(r, op.patch);
        checkRule(r);
        break;
      }
      case "deleteRecurrence":
        recurrence(op.id);
        recurrences.splice(recurrences.findIndex((r) => r.id === op.id), 1);
        transactions = transactions.filter((t) => t.recurrenceId !== op.id); // cascade
        break;
      case "upsertOverride": {
        recurrence(op.values.recurrenceId);
        const existing = transactions.find(
          (t) => t.recurrenceId === op.values.recurrenceId && t.recurrenceDate === op.values.recurrenceDate,
        );
        if (existing) Object.assign(existing, op.values);
        else transactions.push({ id: newTxId(), ...op.values });
        break;
      }
      case "updateTransaction":
        if (op.patch.recurrenceId) recurrence(op.patch.recurrenceId);
        Object.assign(tx(op.id), op.patch);
        break;
      case "deleteTransaction":
        tx(op.id);
        transactions = transactions.filter((t) => t.id !== op.id);
        break;
    }
    checkUnique();
  }
  return { recurrences, transactions };
}

export function seqId(prefix: string) {
  let n = 0;
  return () => `${prefix}${++n}`;
}
