/**
 * Modelo da grade anual (E1): meses nas colunas, categorias nas linhas.
 * Para cada natureza (Receitas, Despesas):
 * - categoria com subcategorias → linha de subtotal + uma linha por filha
 *   (e uma linha "Geral" se houver lançamento direto na categoria-mãe);
 * - categoria sem subcategorias → uma linha simples.
 * No fim: saldo do mês e saldo acumulado no ano (previsto e realizado).
 */
import { month0Of, yearOf } from "@/domain/dates";
import type { Occurrence } from "@/domain/occurrences";
import { summarizeYear, type CategoryKind, type MonthTotals } from "@/domain/summary";

import { buildTree, isActive, KIND_LABEL, type CategoryLike } from "./category-tree";

export interface GridRow {
  key: string;
  label: string;
  /** Categoria que recebe os lançamentos da linha (null = subtotal). */
  categoryId: string | null;
  depth: 0 | 1;
  subtotal: boolean;
  months: number[];
  total: number;
  /** Quantos lançamentos há em cada célula. */
  counts: number[];
  archived: boolean;
}

export interface GridSection {
  kind: CategoryKind;
  label: string;
  rows: GridRow[];
  months: number[];
  total: number;
}

export interface AnnualGrid {
  year: number;
  sections: GridSection[];
  previsto: MonthTotals[];
  realizado: MonthTotals[];
}

const zeros = () => Array.from({ length: 12 }, () => 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function buildAnnualGrid(
  year: number,
  categories: readonly CategoryLike[],
  occurrences: readonly Occurrence[],
): AnnualGrid {
  const cell = new Map<string, { months: number[]; counts: number[] }>();
  for (const o of occurrences) {
    if (yearOf(o.date) !== year) continue;
    let c = cell.get(o.categoryId);
    if (!c) cell.set(o.categoryId, (c = { months: zeros(), counts: zeros() }));
    const m = month0Of(o.date);
    c.months[m] += o.amountCents;
    c.counts[m] += 1;
  }
  const hasValues = (id: string) => cell.has(id);
  const leafRow = (c: CategoryLike, depth: 0 | 1, label = c.name, key = c.id): GridRow => {
    const v = cell.get(c.id) ?? { months: zeros(), counts: zeros() };
    return {
      key,
      label,
      categoryId: c.id,
      depth,
      subtotal: false,
      months: v.months,
      total: sum(v.months),
      counts: v.counts,
      archived: !isActive(c, categories),
    };
  };

  const tree = buildTree(categories, { includeArchived: true });
  const sections: GridSection[] = (["receita", "despesa"] as const).map((kind) => {
    const rows: GridRow[] = [];
    for (const { category: parent, children } of tree[kind]) {
      // arquivadas só aparecem se tiverem valores no ano
      const visibleChildren = children.filter((c) => isActive(c, categories) || hasValues(c.id));
      const parentVisible = isActive(parent, categories) || hasValues(parent.id) || visibleChildren.length > 0;
      if (!parentVisible) continue;

      if (visibleChildren.length === 0) {
        rows.push(leafRow(parent, 0));
        continue;
      }
      const childRows = visibleChildren.map((c) => leafRow(c, 1));
      if (hasValues(parent.id)) childRows.unshift(leafRow(parent, 1, "Geral", `${parent.id}:geral`));
      const months = zeros().map((_, m) => sum(childRows.map((r) => r.months[m])));
      rows.push({
        key: `${parent.id}:subtotal`,
        label: parent.name,
        categoryId: null,
        depth: 0,
        subtotal: true,
        months,
        total: sum(months),
        counts: zeros().map((_, m) => sum(childRows.map((r) => r.counts[m]))),
        archived: !isActive(parent, categories),
      });
      rows.push(...childRows);
    }
    const leaves = rows.filter((r) => !r.subtotal);
    const months = zeros().map((_, m) => sum(leaves.map((r) => r.months[m])));
    return { kind, label: KIND_LABEL[kind], rows, months, total: sum(months) };
  });

  const summary = summarizeYear(
    year,
    occurrences,
    categories.map((c) => ({ id: c.id, parentId: c.parentId, kind: c.kind, monthlyLimitCents: c.monthlyLimitCents })),
  );
  return { year, sections, previsto: summary.previsto, realizado: summary.realizado };
}
