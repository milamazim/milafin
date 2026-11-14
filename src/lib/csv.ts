/**
 * CSV para o Excel em português: separador `;`, vírgula decimal, UTF-8 com
 * BOM e quebra de linha CRLF (o Excel abre direto, com acentos certos).
 */
import { parseISO } from "@/domain/dates";
import type { Occurrence } from "@/domain/occurrences";

import type { CategoryLike } from "./category-tree";
import { MONTHS_SHORT } from "./format";

const BOM = "﻿";

/**
 * Aspas em tudo e aspas internas dobradas. Texto que começa com = + - @ (ou
 * tab/CR) recebe um apóstrofo na frente: sem isso o Excel o executaria como
 * fórmula ("CSV injection").
 */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCSV(rows: (string | number)[][]): string {
  return BOM + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

/** 123456 → "1234,56" (sem separador de milhar: o Excel entende como número). */
export const centsToCsv = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export const CSV_HEADER = ["Data", "Ano", "Mês", "Tipo", "Categoria", "Subcategoria", "Valor", "Pago", "Origem", "Observação"];

/** Uma linha por ocorrência do período (séries já expandidas), em ordem de data. */
export function occurrencesToCsv(occurrences: readonly Occurrence[], categories: readonly CategoryLike[]): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows = occurrences.map((o) => {
    const c = byId.get(o.categoryId);
    const parent = c?.parentId ? byId.get(c.parentId) : undefined;
    const { y, m, d } = parseISO(o.date);
    return [
      `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`,
      String(y),
      MONTHS_SHORT[m - 1],
      c?.kind === "receita" ? "Receita" : "Despesa",
      parent ? parent.name : (c?.name ?? ""),
      parent ? (c?.name ?? "") : "",
      centsToCsv(o.amountCents),
      o.paid ? "Sim" : "Não",
      o.recurrenceId ? "Recorrente" : "Avulso",
      o.note ?? "",
    ];
  });
  return toCSV([CSV_HEADER, ...rows]);
}
