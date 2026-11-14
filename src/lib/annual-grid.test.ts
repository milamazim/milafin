import { describe, expect, it } from "vitest";

import type { Occurrence } from "@/domain/occurrences";

import { buildAnnualGrid } from "./annual-grid";
import type { CategoryLike } from "./category-tree";

const c = (id: string, name: string, parentId: string | null, kind: "receita" | "despesa", archived = false): CategoryLike => ({
  id,
  name,
  parentId,
  kind,
  archivedAt: archived ? "2026-01-01" : null,
  monthlyLimitCents: null,
});

const cats: CategoryLike[] = [
  c("ren", "Renda", null, "receita"),
  c("sal", "Salário", "ren", "receita"),
  c("mor", "Moradia", null, "despesa"),
  c("alu", "Aluguel", "mor", "despesa"),
  c("luz", "Luz", "mor", "despesa"),
  c("velha", "Internet antiga", "mor", "despesa", true),
  c("nada", "Arquivada sem uso", null, "despesa", true),
  c("laz", "Lazer", null, "despesa"),
];

const o = (categoryId: string, reais: number, date: string, paid = false): Occurrence => ({
  key: `${categoryId}${date}${reais}`,
  kind: "avulso",
  transactionId: "t",
  recurrenceId: null,
  recurrenceDate: null,
  categoryId,
  amountCents: reais * 100,
  date,
  paid,
  note: null,
  edited: false,
});

const occ = [
  o("sal", 8500, "2026-01-05", true),
  o("alu", 2800, "2026-01-10", true),
  o("alu", 100, "2026-01-20"), // 2 lançamentos na mesma célula
  o("velha", 99, "2026-02-01"),
  o("mor", 50, "2026-03-03"), // direto na categoria-mãe
  o("laz", 300, "2026-02-14"),
  o("laz", 999, "2025-12-31"), // outro ano
];

describe("buildAnnualGrid", () => {
  const g = buildAnnualGrid(2026, cats, occ);
  const desp = g.sections.find((s) => s.kind === "despesa")!;

  it("seções na ordem Receitas, Despesas", () => {
    expect(g.sections.map((s) => s.label)).toEqual(["Receitas", "Despesas"]);
  });

  it("linhas: subtotal + filhas, 'Geral' para lançamento direto, arquivada só com valores", () => {
    expect(desp.rows.map((r) => [r.label, r.subtotal, r.depth])).toEqual([
      ["Lazer", false, 0],
      ["Moradia", true, 0],
      ["Geral", false, 1],
      ["Aluguel", false, 1],
      ["Internet antiga", false, 1],
      ["Luz", false, 1],
    ]);
    expect(desp.rows.find((r) => r.label === "Internet antiga")!.archived).toBe(true);
  });

  it("valores, contagens e subtotais", () => {
    const alu = desp.rows.find((r) => r.label === "Aluguel")!;
    expect(alu.months[0]).toBe(290000);
    expect(alu.counts[0]).toBe(2);
    const mor = desp.rows.find((r) => r.subtotal)!;
    expect(mor.months.slice(0, 3)).toEqual([290000, 9900, 5000]);
    expect(mor.categoryId).toBeNull();
    expect(desp.months.slice(0, 3)).toEqual([290000, 39900, 5000]);
    expect(desp.total).toBe(290000 + 39900 + 5000);
  });

  it("saldo do mês e acumulado, previsto e realizado", () => {
    expect(g.previsto[0]).toMatchObject({ receitas: 850000, despesas: 290000, saldo: 560000, acumulado: 560000 });
    expect(g.previsto[1]).toMatchObject({ saldo: -39900, acumulado: 520100 });
    expect(g.realizado[0]).toMatchObject({ despesas: 280000, saldo: 570000 });
  });

  it("categoria ativa sem lançamentos aparece zerada", () => {
    const luz = desp.rows.find((r) => r.label === "Luz")!;
    expect(luz.total).toBe(0);
  });
});
