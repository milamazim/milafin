import { describe, expect, it } from "vitest";

import { budgetUsage, summarizeYear, totalsByCategory, type Amount, type CategoryInfo } from "./summary";

const categories: CategoryInfo[] = [
  { id: "renda", parentId: null, kind: "receita", monthlyLimitCents: null },
  { id: "salario", parentId: "renda", kind: "receita", monthlyLimitCents: null },
  { id: "moradia", parentId: null, kind: "despesa", monthlyLimitCents: 350000 },
  { id: "aluguel", parentId: "moradia", kind: "despesa", monthlyLimitCents: null },
  { id: "luz", parentId: "moradia", kind: "despesa", monthlyLimitCents: 30000 },
  { id: "lazer", parentId: null, kind: "despesa", monthlyLimitCents: null },
];

const a = (categoryId: string, reais: number, date: string, paid = true): Amount => ({
  categoryId,
  amountCents: Math.round(reais * 100),
  date,
  paid,
});

const occ: Amount[] = [
  a("salario", 8500, "2026-01-05"),
  a("aluguel", 2800, "2026-01-10"),
  a("luz", 210.35, "2026-01-20"),
  a("salario", 8500, "2026-02-05"),
  a("aluguel", 2800, "2026-02-10", false),
  a("lazer", 600, "2026-02-14"),
  a("aluguel", 2800, "2025-12-10"), // outro ano: ignorado
  a("salario", 0.1, "2026-03-01"),
  a("salario", 0.2, "2026-03-02"),
];

describe("summarizeYear", () => {
  const s = summarizeYear(2026, occ, categories);

  it("saldo do mês e acumulado no ano (previsto)", () => {
    expect(s.previsto[0]).toEqual({ receitas: 850000, despesas: 301035, saldo: 548965, acumulado: 548965 });
    expect(s.previsto[1]).toEqual({ receitas: 850000, despesas: 340000, saldo: 510000, acumulado: 1058965 });
    expect(s.previsto[2].receitas).toBe(30); // 0,1 + 0,2 = 0,30 exato em centavos
    expect(s.previsto[11].acumulado).toBe(1058995);
  });

  it("realizado conta só o que foi pago", () => {
    expect(s.realizado[1]).toEqual({ receitas: 850000, despesas: 60000, saldo: 790000, acumulado: 548965 + 790000 });
  });

  it("totais do ano e outros anos ignorados", () => {
    expect(s.totalPrevisto).toEqual({ receitas: 1700030, despesas: 641035, saldo: 1058995 });
    expect(summarizeYear(2025, occ, categories).totalPrevisto.despesas).toBe(280000);
  });

  it("acumulado recomeça em janeiro (cada ano é independente)", () => {
    expect(summarizeYear(2027, occ, categories).previsto[0].acumulado).toBe(0);
  });

  it("categoria desconhecida é erro de integridade", () => {
    expect(() => summarizeYear(2026, [a("sumiu", 1, "2026-01-01")], categories)).toThrow("Categoria desconhecida");
  });
});

describe("totalsByCategory", () => {
  it("soma na subcategoria e no subtotal da categoria-mãe", () => {
    const t = totalsByCategory(2026, occ, categories);
    expect(t.get("aluguel")!.slice(0, 2)).toEqual([280000, 280000]);
    expect(t.get("luz")![0]).toBe(21035);
    expect(t.get("moradia")!.slice(0, 2)).toEqual([301035, 280000]);
    expect(t.get("lazer")![1]).toBe(60000);
    expect(t.has("renda")).toBe(true);
  });
});

describe("budgetUsage", () => {
  it("limite mensal por categoria, incluindo subcategorias", () => {
    const jan = budgetUsage(2026, 0, occ, categories);
    expect(jan).toEqual([
      { categoryId: "moradia", limitCents: 350000, usedCents: 301035, paidCents: 301035, remainingCents: 48965, ratio: 301035 / 350000 },
      { categoryId: "luz", limitCents: 30000, usedCents: 21035, paidCents: 21035, remainingCents: 8965, ratio: 21035 / 30000 },
    ]);
  });

  it("previsto × pago e estouro", () => {
    const fev = budgetUsage(2026, 1, [...occ, a("luz", 900, "2026-02-20", false)], categories);
    const moradia = fev.find((b) => b.categoryId === "moradia")!;
    expect(moradia).toMatchObject({ usedCents: 370000, paidCents: 0, remainingCents: -20000 });
    expect(moradia.ratio).toBeGreaterThan(1);
  });

  it("mês sem gastos mostra 0% usado", () => {
    expect(budgetUsage(2026, 6, occ, categories).map((b) => b.usedCents)).toEqual([0, 0]);
  });
});
