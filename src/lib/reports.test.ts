import { describe, expect, it } from "vitest";

import type { Occurrence } from "@/domain/occurrences";
import { summarizeYear } from "@/domain/summary";

import type { CategoryLike } from "./category-tree";
import { compareYears, expensesByCategory, topExpenses, upcomingBills } from "./reports";

const c = (id: string, name: string, parentId: string | null, kind: "receita" | "despesa" = "despesa"): CategoryLike => ({
  id,
  name,
  parentId,
  kind,
  archivedAt: null,
  monthlyLimitCents: null,
});

const cats = [
  c("mor", "Moradia", null),
  c("alu", "Aluguel", "mor"),
  c("luz", "Luz", "mor"),
  c("ali", "Alimentação", null),
  c("mer", "Mercado", "ali"),
  c("laz", "Lazer", null),
  c("sal", "Salário", null, "receita"),
];

let n = 0;
const o = (categoryId: string, reais: number, date: string, paid = false): Occurrence => ({
  key: `k${++n}`,
  kind: "avulso",
  transactionId: `t${n}`,
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
  o("alu", 2800, "2026-03-10", true),
  o("luz", 200, "2026-03-20"),
  o("mor", 50, "2026-03-25"), // direto na categoria-mãe
  o("mer", 900, "2026-03-15"),
  o("mer", 300, "2026-03-28"),
  o("laz", 750, "2026-03-05"),
  o("sal", 8500, "2026-03-05"),
  o("alu", 2800, "2026-04-10"),
];

describe("expensesByCategory", () => {
  const r = expensesByCategory(occ, cats, "2026-03-01", "2026-03-31");

  it("total do período só com despesas", () => expect(r.total).toBe(500000));

  it("ordena categorias da maior para a menor, com participação", () => {
    expect(r.items.map((i) => [i.name, i.cents / 100, Math.round(i.share * 100)])).toEqual([
      ["Moradia", 3050, 61],
      ["Alimentação", 1200, 24],
      ["Lazer", 750, 15],
    ]);
  });

  it("detalha subcategorias, com 'Geral' para lançamento direto na mãe", () => {
    expect(r.items[0].children.map((i) => [i.name, i.cents / 100])).toEqual([
      ["Aluguel", 2800],
      ["Luz", 200],
      ["Geral", 50],
    ]);
    expect(r.items[2].children).toEqual([]); // Lazer não tem subcategorias
  });

  it("período sem despesas", () => {
    expect(expensesByCategory(occ, cats, "2025-01-01", "2025-12-31")).toEqual({ total: 0, items: [] });
  });
});

describe("topExpenses", () => {
  it("maiores despesas do período, sem receitas", () => {
    expect(topExpenses(occ, cats, "2026-03-01", "2026-03-31", 3).map((x) => x.amountCents / 100)).toEqual([2800, 900, 750]);
  });
});

describe("upcomingBills", () => {
  const b = upcomingBills(occ, cats, "2026-03-21", 10);

  it("atrasadas: não pagas antes de hoje, sem receitas e sem as pagas", () => {
    expect(b.overdue.map((x) => [x.date, x.amountCents / 100])).toEqual([
      ["2026-03-05", 750],
      ["2026-03-15", 900],
      ["2026-03-20", 200],
    ]);
    expect(b.overdueCents).toBe(185000);
  });

  it("a vencer: de hoje até hoje + N dias", () => {
    expect(b.upcoming.map((x) => x.date)).toEqual(["2026-03-25", "2026-03-28"]);
    expect(upcomingBills(occ, cats, "2026-03-21", 30).upcoming.map((x) => x.date)).toContain("2026-04-10");
  });
});

describe("compareYears", () => {
  const catsInfo = cats.map((x) => ({ id: x.id, parentId: x.parentId, kind: x.kind, monthlyLimitCents: null }));
  const cur = summarizeYear(2026, occ, catsInfo).previsto;
  const prev = summarizeYear(2025, [o("alu", 2500, "2025-03-10"), o("sal", 8000, "2025-03-05")], catsInfo).previsto;

  it("mês a mês e totais", () => {
    const r = compareYears(cur, prev, "despesas");
    expect(r.rows[2]).toEqual({ month0: 2, current: 500000, previous: 250000, diff: 250000 });
    expect(r.totalCurrent).toBe(780000);
    expect(r.pct).toBeCloseTo(2.12, 2);
  });

  it("sem ano anterior: variação percentual indefinida", () => {
    const empty = summarizeYear(2024, [], catsInfo).previsto;
    expect(compareYears(cur, empty, "receitas").pct).toBeNull();
  });
});
