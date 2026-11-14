/**
 * Totais da grade anual, do dashboard e do orçamento.
 *
 * - Saldo do mês = receitas − despesas.
 * - Saldo acumulado: soma de janeiro até o mês e recomeça a cada ano (B4).
 * - Duas visões (B2): PREVISTO (todos os lançamentos) e REALIZADO
 *   (só os marcados como pagos/recebidos).
 */
import { month0Of, yearOf, type ISODate } from "./dates";
import { DomainError } from "./errors";

export type CategoryKind = "receita" | "despesa";

export interface CategoryInfo {
  id: string;
  parentId: string | null;
  kind: CategoryKind;
  monthlyLimitCents: number | null;
}

/** O mínimo de uma ocorrência que os totais precisam. */
export interface Amount {
  categoryId: string;
  amountCents: number;
  date: ISODate;
  paid: boolean;
}

export interface MonthTotals {
  receitas: number;
  despesas: number;
  /** receitas − despesas */
  saldo: number;
  /** saldo acumulado no ano até este mês */
  acumulado: number;
}

export interface YearSummary {
  year: number;
  /** 12 meses (0 = janeiro), todos os lançamentos */
  previsto: MonthTotals[];
  /** 12 meses, só pagos/recebidos */
  realizado: MonthTotals[];
  totalPrevisto: Omit<MonthTotals, "acumulado">;
  totalRealizado: Omit<MonthTotals, "acumulado">;
}

const months = () => Array.from({ length: 12 }, () => 0);

function kindIndex(categories: readonly CategoryInfo[]) {
  const map = new Map(categories.map((c) => [c.id, c]));
  return (categoryId: string) => {
    const c = map.get(categoryId);
    if (!c) throw new DomainError(`Categoria desconhecida: ${categoryId}`);
    return c.kind;
  };
}

function totalsFor(receitas: number[], despesas: number[]): MonthTotals[] {
  let acumulado = 0;
  return receitas.map((r, i) => {
    const saldo = r - despesas[i];
    acumulado += saldo;
    return { receitas: r, despesas: despesas[i], saldo, acumulado };
  });
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Resumo do ano. Ocorrências de outros anos são ignoradas. */
export function summarizeYear(
  year: number,
  occurrences: readonly Amount[],
  categories: readonly CategoryInfo[],
): YearSummary {
  const kindOf = kindIndex(categories);
  const prev = { receita: months(), despesa: months() };
  const real = { receita: months(), despesa: months() };

  for (const o of occurrences) {
    if (yearOf(o.date) !== year) continue;
    const kind = kindOf(o.categoryId);
    const m = month0Of(o.date);
    prev[kind][m] += o.amountCents;
    if (o.paid) real[kind][m] += o.amountCents;
  }

  const total = (r: number[], d: number[]) => ({ receitas: sum(r), despesas: sum(d), saldo: sum(r) - sum(d) });
  return {
    year,
    previsto: totalsFor(prev.receita, prev.despesa),
    realizado: totalsFor(real.receita, real.despesa),
    totalPrevisto: total(prev.receita, prev.despesa),
    totalRealizado: total(real.receita, real.despesa),
  };
}

/**
 * Valores por categoria e mês (linhas da grade anual): cada ocorrência
 * conta na própria (sub)categoria e também na categoria-mãe (subtotal).
 */
export function totalsByCategory(
  year: number,
  occurrences: readonly Amount[],
  categories: readonly CategoryInfo[],
): Map<string, number[]> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out = new Map<string, number[]>();
  const add = (id: string, m: number, cents: number) => {
    let row = out.get(id);
    if (!row) out.set(id, (row = months()));
    row[m] += cents;
  };

  for (const o of occurrences) {
    if (yearOf(o.date) !== year) continue;
    const c = byId.get(o.categoryId);
    if (!c) throw new DomainError(`Categoria desconhecida: ${o.categoryId}`);
    const m = month0Of(o.date);
    add(c.id, m, o.amountCents);
    if (c.parentId) add(c.parentId, m, o.amountCents);
  }
  return out;
}

export interface BudgetUsage {
  categoryId: string;
  limitCents: number;
  /** Previsto no mês (todos os lançamentos da categoria e subcategorias). */
  usedCents: number;
  /** Só o que já foi pago. */
  paidCents: number;
  /** limite − previsto (negativo = estourou) */
  remainingCents: number;
  /** previsto / limite (1 = 100%) */
  ratio: number;
}

/** Orçamento simples por categoria (C2): limite mensal × gasto do mês. */
export function budgetUsage(
  year: number,
  month0: number,
  occurrences: readonly Amount[],
  categories: readonly CategoryInfo[],
): BudgetUsage[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const used = new Map<string, { used: number; paid: number }>();

  for (const o of occurrences) {
    if (yearOf(o.date) !== year || month0Of(o.date) !== month0) continue;
    const c = byId.get(o.categoryId);
    if (!c || c.kind !== "despesa") continue;
    for (const id of c.parentId ? [c.id, c.parentId] : [c.id]) {
      const u = used.get(id) ?? { used: 0, paid: 0 };
      u.used += o.amountCents;
      if (o.paid) u.paid += o.amountCents;
      used.set(id, u);
    }
  }

  return categories
    .filter((c) => c.kind === "despesa" && c.monthlyLimitCents !== null && c.monthlyLimitCents > 0)
    .map((c) => {
      const u = used.get(c.id) ?? { used: 0, paid: 0 };
      const limit = c.monthlyLimitCents!;
      return {
        categoryId: c.id,
        limitCents: limit,
        usedCents: u.used,
        paidCents: u.paid,
        remainingCents: limit - u.used,
        ratio: u.used / limit,
      };
    });
}
