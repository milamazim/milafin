import { describe, expect, it } from "vitest";

import type { Occurrence } from "@/domain/occurrences";

import type { CategoryLike } from "./category-tree";
import { centsToCsv, csvCell, occurrencesToCsv, toCSV } from "./csv";

describe("csv", () => {
  it("aspas em tudo, aspas internas dobradas", () => {
    expect(csvCell('Diz "oi"; ok')).toBe('"Diz ""oi""; ok"');
    expect(csvCell(12)).toBe('"12"');
  });

  it("neutraliza fórmulas (CSV injection)", () => {
    for (const s of ["=HYPERLINK(\"x\")", "+1", "-2+3", "@SUM(A1)", "\t=1"]) {
      expect(csvCell(s).startsWith(`"'`)).toBe(true);
    }
    expect(csvCell("Mercado")).toBe('"Mercado"');
  });

  it("BOM, separador ; e CRLF", () => {
    const out = toCSV([["a", "b"], ["c", "d"]]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.slice(1)).toBe('"a";"b"\r\n"c";"d"\r\n');
  });

  it("valor com vírgula decimal e sem milhar", () => {
    expect(centsToCsv(123456)).toBe("1234,56");
    expect(centsToCsv(5)).toBe("0,05");
  });

  it("linhas de ocorrências com categoria e subcategoria", () => {
    const cats: CategoryLike[] = [
      { id: "m", parentId: null, name: "Moradia", kind: "despesa", archivedAt: null, monthlyLimitCents: null },
      { id: "a", parentId: "m", name: "Aluguel", kind: "despesa", archivedAt: null, monthlyLimitCents: null },
      { id: "s", parentId: null, name: "Salário", kind: "receita", archivedAt: null, monthlyLimitCents: null },
    ];
    const o = (categoryId: string, cents: number, date: string, extra: Partial<Occurrence> = {}): Occurrence => ({
      key: date,
      kind: "avulso",
      transactionId: "t",
      recurrenceId: null,
      recurrenceDate: null,
      categoryId,
      amountCents: cents,
      date,
      paid: false,
      note: null,
      edited: false,
      ...extra,
    });
    const lines = occurrencesToCsv(
      [o("a", 280000, "2026-03-10", { recurrenceId: "r", paid: true }), o("s", 850000, "2026-03-05", { note: "=cmd" })],
      cats,
    )
      .slice(1)
      .trimEnd()
      .split("\r\n");
    expect(lines[0]).toBe('"Data";"Ano";"Mês";"Tipo";"Categoria";"Subcategoria";"Valor";"Pago";"Origem";"Observação"');
    expect(lines[1]).toBe('"10/03/2026";"2026";"Mar";"Despesa";"Moradia";"Aluguel";"2800,00";"Sim";"Recorrente";""');
    expect(lines[2]).toBe('"05/03/2026";"2026";"Mar";"Receita";"Salário";"";"8500,00";"Não";"Avulso";"\'=cmd"');
  });
});
