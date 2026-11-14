import { describe, expect, it } from "vitest";

import { buildBackup, parseBackup, planRestore, type Backup, type ExistingData } from "./backup";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const data = (): Backup["data"] => ({
  categories: [
    { id: U(1), parentId: null, name: "Moradia", kind: "despesa", monthlyLimitCents: 300000, sortOrder: 0, archivedAt: null },
    { id: U(2), parentId: U(1), name: "Aluguel", kind: "despesa", monthlyLimitCents: null, sortOrder: 0, archivedAt: null },
    { id: U(3), parentId: null, name: "Renda", kind: "receita", monthlyLimitCents: null, sortOrder: 0, archivedAt: "2026-01-01T00:00:00.000Z" },
  ],
  recurrences: [
    { id: U(10), categoryId: U(2), amountCents: 280000, frequency: "mensal", startDate: "2026-01-10", endDate: null, excludedDates: ["2026-03-10"], note: null },
  ],
  transactions: [
    { id: U(20), categoryId: U(3), amountCents: 850000, date: "2026-01-05", paid: true, note: "salário", recurrenceId: null, recurrenceDate: null },
    { id: U(21), categoryId: U(2), amountCents: 290000, date: "2026-02-12", paid: true, note: null, recurrenceId: U(10), recurrenceDate: "2026-02-10" },
  ],
});

const json = (d = data()) => JSON.stringify(buildBackup(d, "2026-11-14T10:00:00.000Z"));

const empty = (): ExistingData => ({
  categories: [],
  recurrenceIds: new Set(),
  transactionIds: new Set(),
  overrideKeys: new Set(),
  takenIds: new Set(),
});

let seq = 0;
const newId = () => U(9000 + ++seq);

describe("parseBackup", () => {
  it("aceita o próprio formato, com contagens", () => {
    const r = parseBackup(json());
    expect(r.ok).toBe(true);
    expect(JSON.parse(json()).counts).toEqual({ categories: 3, recurrences: 1, transactions: 2 });
  });

  it.each([
    ["não é JSON", "{oops", "não é um JSON válido"],
    ["outro app", JSON.stringify({ app: "x" }), "não é um backup do milafin"],
    ["protótipo v2", JSON.stringify({ app: "controle_financeiro", version: 2 }), "protótipo antigo"],
    ["protótipo v1 (lista)", "[]", "protótipo antigo"],
    ["versão futura", JSON.stringify({ app: "milafin", version: 99 }), "Versão de backup não suportada"],
  ])("recusa %s", (_, text, msg) => {
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain(msg);
  });

  it("recusa tipos inválidos com o caminho do erro", () => {
    const d = data();
    d.transactions[0].amountCents = 0;
    const r = parseBackup(json(d));
    expect(!r.ok && r.error).toMatch(/data\.transactions\.0\.amountCents/);
  });

  it.each([
    ["id repetido", (d: Backup["data"]) => void (d.transactions[1].id = U(20)), "identificador repetido"],
    ["subcategoria órfã", (d: Backup["data"]) => void (d.categories[1].parentId = U(99)), "não está no arquivo"],
    ["natureza diferente da mãe", (d: Backup["data"]) => void (d.categories[1].kind = "receita"), "natureza diferente"],
    ["categoria repetida", (d: Backup["data"]) => void (d.categories[2].name = "moradia", d.categories[2].kind = "despesa"), "categoria repetida"],
    ["série que termina antes", (d: Backup["data"]) => void (d.recurrences[0].endDate = "2025-01-01"), "termina antes"],
    ["lançamento sem série", (d: Backup["data"]) => void (d.transactions[1].recurrenceId = U(98)), "série que não está"],
    ["vínculo incompleto", (d: Backup["data"]) => void (d.transactions[1].recurrenceDate = null), "incompleto"],
  ])("recusa backup inconsistente: %s", (_, mutate, msg) => {
    const d = data();
    mutate(d);
    const r = parseBackup(json(d));
    expect(!r.ok && r.error).toContain(msg);
  });
});

describe("planRestore", () => {
  const backup = () => (parseBackup(json()) as { ok: true; backup: Backup }).backup;

  it("conta vazia: insere tudo com os mesmos ids", () => {
    const p = planRestore(backup(), empty(), newId);
    expect([p.categories.length, p.recurrences.length, p.transactions.length]).toEqual([3, 1, 2]);
    expect(p.categories.map((c) => c.id)).toEqual([U(1), U(3), U(2)]); // mães antes das filhas
    expect(p.skipped).toEqual({ categories: 0, recurrences: 0, transactions: 0 });
  });

  it("restaurar o mesmo arquivo de novo não duplica nada", () => {
    const b = backup();
    const existing: ExistingData = {
      categories: b.data.categories,
      recurrenceIds: new Set([U(10)]),
      transactionIds: new Set([U(20), U(21)]),
      overrideKeys: new Set([`${U(10)}|2026-02-10`]),
      takenIds: new Set(),
    };
    const p = planRestore(b, existing, newId);
    expect([p.categories, p.recurrences, p.transactions]).toEqual([[], [], []]);
    expect(p.skipped).toEqual({ categories: 3, recurrences: 1, transactions: 2 });
  });

  it("mescla categorias pelo nome (ignorando maiúsculas) e reaponta tudo para a existente", () => {
    const existing = { ...empty(), categories: [{ id: U(500), parentId: null, name: "MORADIA", kind: "despesa" as const }] };
    const p = planRestore(backup(), existing, newId);
    expect(p.categories.map((c) => c.name)).toEqual(["Renda", "Aluguel"]);
    expect(p.categories.find((c) => c.name === "Aluguel")!.parentId).toBe(U(500));
    expect(p.skipped.categories).toBe(1);
  });

  it("mesmo nome com natureza diferente: cria renomeada (índice único é por nome)", () => {
    const existing = { ...empty(), categories: [{ id: U(501), parentId: null, name: "Renda", kind: "despesa" as const }] };
    const p = planRestore(backup(), existing, newId);
    expect(p.categories.find((c) => c.kind === "receita")!.name).toBe("Renda (receita)");
  });

  it("ids usados por outro usuário ganham id novo e as referências acompanham", () => {
    const p = planRestore(backup(), { ...empty(), takenIds: new Set([U(2), U(10), U(21)]) }, newId);
    const alu = p.categories.find((c) => c.name === "Aluguel")!;
    const rec = p.recurrences[0];
    const ov = p.transactions.find((t) => t.recurrenceDate)!;
    expect(alu.id).not.toBe(U(2));
    expect(rec.id).not.toBe(U(10));
    expect(rec.categoryId).toBe(alu.id);
    expect(ov.id).not.toBe(U(21));
    expect(ov.recurrenceId).toBe(rec.id);
    expect(ov.categoryId).toBe(alu.id);
  });

  it("ocorrência já editada na conta (mesma série e data) não entra de novo", () => {
    const existing = { ...empty(), recurrenceIds: new Set([U(10)]), overrideKeys: new Set([`${U(10)}|2026-02-10`]) };
    const p = planRestore(backup(), existing, newId);
    expect(p.transactions.map((t) => t.id)).toEqual([U(20)]);
  });
});
