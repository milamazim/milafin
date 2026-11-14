import { describe, expect, it } from "vitest";

import { buildTree, categoryOptions, categoryPath, type CategoryLike } from "./category-tree";

const c = (id: string, name: string, parentId: string | null = null, extra: Partial<CategoryLike> = {}): CategoryLike => ({
  id,
  name,
  parentId,
  kind: "despesa",
  archivedAt: null,
  monthlyLimitCents: null,
  ...extra,
});

const cats: CategoryLike[] = [
  c("mor", "Moradia"),
  c("alu", "Aluguel", "mor"),
  c("luz", "Luz", "mor"),
  c("agua", "Água", "mor", { archivedAt: "2026-01-01" }),
  c("laz", "Lazer"),
  c("ant", "Antiga", null, { archivedAt: "2026-01-01" }),
  c("ant1", "Filha da antiga", "ant"),
  c("ren", "Renda", null, { kind: "receita" }),
  c("sal", "Salário", "ren", { kind: "receita" }),
];

describe("category-tree", () => {
  it("árvore ativa por natureza, ordenada por nome (com acento)", () => {
    const t = buildTree(cats);
    expect(t.despesa.map((n) => [n.category.name, n.children.map((x) => x.name)])).toEqual([
      ["Lazer", []],
      ["Moradia", ["Aluguel", "Luz"]],
    ]);
    expect(t.receita[0].children[0].name).toBe("Salário");
  });

  it("com arquivadas, mostra tudo", () => {
    const t = buildTree(cats, { includeArchived: true });
    expect(t.despesa.map((n) => n.category.name)).toEqual(["Antiga", "Lazer", "Moradia"]);
    expect(t.despesa[2].children.map((x) => x.name)).toEqual(["Água", "Aluguel", "Luz"]);
  });

  it("opções de lançamento: subcategorias ativas e categorias sem filhas", () => {
    // categoria sem subcategorias (Lazer) vira um grupo próprio, em ordem alfabética
    expect(categoryOptions(cats)).toEqual([
      { label: "Lazer", kind: "despesa", options: [{ id: "laz", label: "Lazer" }] },
      { label: "Moradia", kind: "despesa", options: [{ id: "alu", label: "Aluguel" }, { id: "luz", label: "Luz" }] },
      { label: "Renda", kind: "receita", options: [{ id: "sal", label: "Salário" }] },
    ]);
  });

  it("mantém a categoria arquivada do lançamento em edição", () => {
    const opts = categoryOptions(cats, "agua").find((g) => g.label === "Moradia")!;
    expect(opts.options.map((o) => o.id)).toEqual(["agua", "alu", "luz"]);
    const filhaDeArquivada = categoryOptions(cats, "ant1").find((g) => g.label === "Antiga")!;
    expect(filhaDeArquivada.options.map((o) => o.id)).toEqual(["ant1"]);
  });

  it("caminho da categoria", () => {
    expect(categoryPath(cats, "alu")).toBe("Moradia › Aluguel");
    expect(categoryPath(cats, "laz")).toBe("Lazer");
    expect(categoryPath(cats, "x")).toBe("—");
  });
});
