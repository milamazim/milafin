/**
 * Cálculos dos relatórios (C3) e do dashboard. Funções puras: recebem as
 * ocorrências já montadas (`buildOccurrences`) e as categorias.
 */
import { addDays, type ISODate } from "@/domain/dates";
import type { Occurrence } from "@/domain/occurrences";
import type { MonthTotals } from "@/domain/summary";

import type { CategoryLike } from "./category-tree";

const inRange = (o: Occurrence, from: ISODate, to: ISODate) => o.date >= from && o.date <= to;

/* --------------------------------------------- despesas por categoria */

export interface CategoryShare {
  categoryId: string;
  name: string;
  cents: number;
  /** fração do total do período (0–1) */
  share: number;
  /** subcategorias (vazio quando a categoria não tem) */
  children: CategoryShare[];
}

/**
 * Despesas do período agrupadas pela categoria principal, da maior para a
 * menor, com o detalhe por subcategoria. Lançamento direto na categoria-mãe
 * aparece como a subcategoria "Geral".
 */
export function expensesByCategory(
  occurrences: readonly Occurrence[],
  categories: readonly CategoryLike[],
  from: ISODate,
  to: ISODate,
): { total: number; items: CategoryShare[] } {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parents = new Map<string, { cents: number; children: Map<string, number> }>();
  let total = 0;

  for (const o of occurrences) {
    if (!inRange(o, from, to)) continue;
    const c = byId.get(o.categoryId);
    if (!c || c.kind !== "despesa") continue;
    const parentId = c.parentId ?? c.id;
    const p = parents.get(parentId) ?? { cents: 0, children: new Map() };
    p.cents += o.amountCents;
    p.children.set(c.id, (p.children.get(c.id) ?? 0) + o.amountCents);
    parents.set(parentId, p);
    total += o.amountCents;
  }

  const share = (cents: number) => (total ? cents / total : 0);
  const sortDesc = (a: CategoryShare, b: CategoryShare) => b.cents - a.cents || a.name.localeCompare(b.name, "pt-BR");

  const items = [...parents.entries()].map(([id, p]): CategoryShare => {
    const parent = byId.get(id)!;
    const hasSubcats = categories.some((c) => c.parentId === id);
    const children = hasSubcats
      ? [...p.children.entries()]
          .map(([cid, cents]) => ({
            categoryId: cid,
            name: cid === id ? "Geral" : byId.get(cid)!.name,
            cents,
            share: share(cents),
            children: [],
          }))
          .sort(sortDesc)
      : [];
    return { categoryId: id, name: parent.name, cents: p.cents, share: share(p.cents), children };
  });

  return { total, items: items.sort(sortDesc) };
}

/* ------------------------------------------------------ maiores gastos */

/** Os N maiores lançamentos de despesa do período. */
export function topExpenses(
  occurrences: readonly Occurrence[],
  categories: readonly CategoryLike[],
  from: ISODate,
  to: ISODate,
  limit = 10,
): Occurrence[] {
  const kind = new Map(categories.map((c) => [c.id, c.kind]));
  return occurrences
    .filter((o) => inRange(o, from, to) && kind.get(o.categoryId) === "despesa")
    .sort((a, b) => b.amountCents - a.amountCents || (a.date < b.date ? -1 : 1))
    .slice(0, limit);
}

/* ------------------------------------------------------ contas a vencer */

export interface UpcomingBills {
  /** não pagas com data anterior a hoje (mais antigas primeiro) */
  overdue: Occurrence[];
  /** não pagas de hoje até hoje + `days` */
  upcoming: Occurrence[];
  overdueCents: number;
  upcomingCents: number;
}

/** Despesas não pagas: atrasadas e as dos próximos `days` dias (C3). */
export function upcomingBills(
  occurrences: readonly Occurrence[],
  categories: readonly CategoryLike[],
  today: ISODate,
  days = 30,
): UpcomingBills {
  const kind = new Map(categories.map((c) => [c.id, c.kind]));
  const until = addDays(today, days);
  const unpaid = occurrences
    .filter((o) => !o.paid && kind.get(o.categoryId) === "despesa")
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.amountCents - a.amountCents));
  const overdue = unpaid.filter((o) => o.date < today);
  const upcoming = unpaid.filter((o) => o.date >= today && o.date <= until);
  const sum = (xs: Occurrence[]) => xs.reduce((a, o) => a + o.amountCents, 0);
  return { overdue, upcoming, overdueCents: sum(overdue), upcomingCents: sum(upcoming) };
}

/* ------------------------------------------------- comparação entre anos */

export type CompareMeasure = "despesas" | "receitas" | "saldo";

export interface YearComparisonRow {
  month0: number;
  current: number;
  previous: number;
  /** current − previous */
  diff: number;
}

/** Mês a mês de dois anos, para uma medida (previsto). */
export function compareYears(
  current: readonly MonthTotals[],
  previous: readonly MonthTotals[],
  measure: CompareMeasure,
): { rows: YearComparisonRow[]; totalCurrent: number; totalPrevious: number; diff: number; pct: number | null } {
  const rows = current.map((c, m) => ({
    month0: m,
    current: c[measure],
    previous: previous[m][measure],
    diff: c[measure] - previous[m][measure],
  }));
  const totalCurrent = rows.reduce((a, r) => a + r.current, 0);
  const totalPrevious = rows.reduce((a, r) => a + r.previous, 0);
  const diff = totalCurrent - totalPrevious;
  return { rows, totalCurrent, totalPrevious, diff, pct: totalPrevious ? diff / Math.abs(totalPrevious) : null };
}
