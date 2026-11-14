/**
 * Categorias em dois níveis (B1): categoria (ex.: Moradia) e subcategorias
 * (ex.: Aluguel, Luz). Regras de uso:
 * - lançamentos vão para subcategorias, ou para uma categoria sem
 *   subcategorias ativas;
 * - arquivar a categoria-mãe arquiva, na prática, as filhas.
 */
import type { CategoryKind } from "@/domain/summary";

export interface CategoryLike {
  id: string;
  parentId: string | null;
  name: string;
  kind: CategoryKind;
  archivedAt: Date | string | null;
  monthlyLimitCents: number | null;
}

export interface CategoryNode<C extends CategoryLike = CategoryLike> {
  category: C;
  children: C[];
}

export const KIND_LABEL: Record<CategoryKind, string> = { receita: "Receitas", despesa: "Despesas" };

const byName = (a: CategoryLike, b: CategoryLike) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

export function isActive<C extends CategoryLike>(c: C, all: readonly C[]): boolean {
  if (c.archivedAt) return false;
  if (!c.parentId) return true;
  const parent = all.find((p) => p.id === c.parentId);
  return !parent?.archivedAt;
}

/** Árvore por natureza, ordenada por nome. */
export function buildTree<C extends CategoryLike>(
  all: readonly C[],
  opts: { includeArchived?: boolean } = {},
): Record<CategoryKind, CategoryNode<C>[]> {
  const keep = (c: C) => opts.includeArchived || isActive(c, all);
  const tree: Record<CategoryKind, CategoryNode<C>[]> = { receita: [], despesa: [] };
  for (const parent of all.filter((c) => !c.parentId && keep(c)).sort(byName)) {
    tree[parent.kind].push({
      category: parent,
      children: all.filter((c) => c.parentId === parent.id && keep(c)).sort(byName),
    });
  }
  return tree;
}

export interface CategoryOptionGroup {
  label: string;
  kind: CategoryKind;
  options: { id: string; label: string }[];
}

/**
 * Opções do campo "Categoria" de um lançamento, agrupadas pela categoria-mãe.
 * `keepId` mantém visível a categoria atual de um lançamento sendo editado,
 * mesmo que ela tenha sido arquivada.
 */
export function categoryOptions<C extends CategoryLike>(all: readonly C[], keepId?: string): CategoryOptionGroup[] {
  const groups: CategoryOptionGroup[] = [];
  for (const kind of ["despesa", "receita"] as const) {
    for (const node of buildTree(all, { includeArchived: true })[kind]) {
      const parentActive = isActive(node.category, all);
      const activeChildren = node.children.filter((c) => isActive(c, all));
      const options = node.children
        .filter((c) => isActive(c, all) || c.id === keepId)
        .map((c) => ({ id: c.id, label: c.name }));
      // categoria sem subcategorias ativas recebe lançamentos direto: entra no
      // próprio grupo, na mesma ordem alfabética das outras categorias
      if ((parentActive && activeChildren.length === 0) || node.category.id === keepId) {
        options.unshift({ id: node.category.id, label: node.category.name });
      }
      if (options.length > 0) groups.push({ label: node.category.name, kind, options });
    }
  }
  return groups;
}

/** "Moradia › Aluguel" */
export function categoryPath(all: readonly CategoryLike[], id: string): string {
  const c = all.find((x) => x.id === id);
  if (!c) return "—";
  const parent = c.parentId ? all.find((x) => x.id === c.parentId) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}
