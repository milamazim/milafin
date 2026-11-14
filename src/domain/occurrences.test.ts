import { describe, expect, it } from "vitest";

import { buildOccurrences, occurrenceKey, type RecurrenceRow, type TransactionRow } from "./occurrences";

const aluguel: RecurrenceRow = {
  id: "r1",
  categoryId: "moradia-aluguel",
  amountCents: 280000,
  note: null,
  frequency: "mensal",
  startDate: "2026-01-10",
  endDate: null,
  excludedDates: ["2026-03-10"],
};

const tx = (t: Partial<TransactionRow>): TransactionRow => ({
  id: "t1",
  categoryId: "lazer",
  amountCents: 5000,
  date: "2026-02-15",
  paid: true,
  note: null,
  recurrenceId: null,
  recurrenceDate: null,
  ...t,
});

const range = { from: "2026-01-01", to: "2026-04-30" };

describe("buildOccurrences", () => {
  it("expande a série, desconta exclusões e mistura avulsos em ordem de data", () => {
    const occ = buildOccurrences({ transactions: [tx({})], recurrences: [aluguel], ...range });
    expect(occ.map((o) => [o.date, o.kind, o.amountCents])).toEqual([
      ["2026-01-10", "recorrente", 280000],
      ["2026-02-10", "recorrente", 280000],
      ["2026-02-15", "avulso", 5000],
      ["2026-04-10", "recorrente", 280000],
    ]);
    const virtual = occ[0];
    expect(virtual).toMatchObject({ transactionId: null, paid: false, edited: false, recurrenceDate: "2026-01-10" });
    expect(occ[2].key).toBe("t:t1");
  });

  it("ocorrência editada substitui a calculada e mantém a mesma chave", () => {
    const override = tx({
      id: "o1",
      categoryId: aluguel.categoryId,
      amountCents: 295000,
      date: "2026-02-12",
      paid: true,
      note: "pago com atraso",
      recurrenceId: "r1",
      recurrenceDate: "2026-02-10",
    });
    const occ = buildOccurrences({ transactions: [override], recurrences: [aluguel], ...range });
    const feb = occ.filter((o) => o.date.startsWith("2026-02"));
    expect(feb).toHaveLength(1);
    expect(feb[0]).toMatchObject({
      key: occurrenceKey("r1", "2026-02-10"),
      transactionId: "o1",
      amountCents: 295000,
      date: "2026-02-12",
      paid: true,
      edited: true,
      kind: "recorrente",
    });
  });

  it("ocorrência movida para fora do período some do período original e aparece no novo", () => {
    const moved = tx({ id: "o2", date: "2026-05-02", recurrenceId: "r1", recurrenceDate: "2026-04-10", categoryId: aluguel.categoryId });
    const abril = buildOccurrences({ transactions: [moved], recurrences: [aluguel], from: "2026-04-01", to: "2026-04-30" });
    expect(abril).toEqual([]);
    const maio = buildOccurrences({ transactions: [moved], recurrences: [aluguel], from: "2026-05-01", to: "2026-05-31" });
    expect(maio.map((o) => [o.date, o.key])).toEqual([
      ["2026-05-02", occurrenceKey("r1", "2026-04-10")],
      ["2026-05-10", occurrenceKey("r1", "2026-05-10")],
    ]);
  });

  it("período vazio e série que começa depois", () => {
    expect(buildOccurrences({ transactions: [], recurrences: [aluguel], from: "2025-01-01", to: "2025-12-31" })).toEqual([]);
  });
});
