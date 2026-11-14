"use client";

import { useState } from "react";

import type { AnnualGrid } from "@/lib/annual-grid";
import { formatNumber, MONTHS, MONTHS_SHORT } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Grade anual estilo planilha: clique numa célula para ver/editar/adicionar. */
export function AnnualGridTable({
  grid,
  currentMonth0,
  onCellClick,
}: {
  grid: AnnualGrid;
  /** Mês atual (destacado), ou null se o ano exibido não é o atual. */
  currentMonth0: number | null;
  onCellClick: (categoryId: string, month0: number) => void;
}) {
  const [mode, setMode] = useState<"previsto" | "realizado">("previsto");
  const totals = grid[mode];
  const colClass = (m: number) => cn(m === currentMonth0 && "bg-primary/5");

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1100px] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 w-48 bg-muted px-3 py-2 text-left font-medium">Categoria</th>
              {MONTHS_SHORT.map((m, i) => (
                <th key={m} title={MONTHS[i]} className={cn("px-2 py-2 text-right font-medium", colClass(i))}>
                  {m}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>

          {grid.sections.map((section) => (
            <tbody key={section.kind}>
              <tr className="border-b">
                <th
                  colSpan={14}
                  className={cn(
                    "sticky left-0 bg-background px-3 pt-4 pb-1 text-left text-xs font-semibold tracking-wide uppercase",
                    section.kind === "receita" ? "text-receita-ink" : "text-despesa-ink",
                  )}
                >
                  {section.label}
                </th>
              </tr>
              {section.rows.length === 0 && (
                <tr>
                  <td colSpan={14} className="sticky left-0 px-3 py-2 text-muted-foreground">
                    Nenhuma categoria de {section.label.toLowerCase()}.
                  </td>
                </tr>
              )}
              {section.rows.map((row) => (
                <tr key={row.key} className={cn("border-b last:border-0", row.subtotal && "bg-muted/30 font-medium")}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 max-w-48 truncate px-3 py-1.5 text-left font-normal",
                      row.subtotal ? "bg-muted font-medium" : "bg-background",
                      row.depth === 1 && "pl-7",
                      row.archived && "text-muted-foreground italic",
                    )}
                    title={row.label}
                  >
                    {row.label}
                  </th>
                  {row.months.map((cents, m) => (
                    <td key={m} className={cn("p-0 text-right", colClass(m))}>
                      {row.categoryId ? (
                        <button
                          type="button"
                          onClick={() => onCellClick(row.categoryId!, m)}
                          className="w-full px-2 py-1.5 text-right hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                          aria-label={`${row.label}, ${MONTHS[m]}: ${cents ? formatNumber(cents) : "sem lançamentos"}`}
                        >
                          <Amount cents={cents} count={row.counts[m]} />
                        </button>
                      ) : (
                        <span className="block px-2 py-1.5">
                          <Amount cents={cents} />
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-medium">{row.total ? formatNumber(row.total) : "–"}</td>
                </tr>
              ))}
              <tr className="border-y bg-muted/50 font-semibold">
                <th scope="row" className="sticky left-0 z-10 bg-muted px-3 py-1.5 text-left">
                  Total {section.label.toLowerCase()}
                </th>
                {section.months.map((c, m) => (
                  <td key={m} className={cn("px-2 py-1.5 text-right", colClass(m))}>
                    {c ? formatNumber(c) : "–"}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right">{formatNumber(section.total)}</td>
              </tr>
            </tbody>
          ))}

          <tfoot className="border-t-2">
            <BalanceRow label="Saldo do mês" values={totals.map((t) => t.saldo)} colClass={colClass} total={totals.reduce((a, t) => a + t.saldo, 0)} />
            <BalanceRow label="Acumulado no ano" values={totals.map((t) => t.acumulado)} colClass={colClass} />
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Saldos:</span>
        <div className="inline-flex rounded-md border p-0.5" role="radiogroup" aria-label="Tipo de saldo">
          {(["previsto", "realizado"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn("rounded px-2 py-0.5", mode === m ? "bg-muted font-medium text-foreground" : "hover:text-foreground")}
            >
              {m === "previsto" ? "Previsto (tudo)" : "Realizado (só pagos)"}
            </button>
          ))}
        </div>
        <span className="ml-auto">Clique numa célula para ver, editar ou adicionar lançamentos.</span>
      </div>
    </div>
  );
}

function Amount({ cents, count = 0 }: { cents: number; count?: number }) {
  if (!cents) return <span className="text-muted-foreground/50">–</span>;
  return (
    <>
      {formatNumber(cents)}
      {count > 1 && <sup className="ml-0.5 text-[10px] text-muted-foreground">{count}</sup>}
    </>
  );
}

function BalanceRow({
  label,
  values,
  total,
  colClass,
}: {
  label: string;
  values: number[];
  total?: number;
  colClass: (m: number) => string | undefined;
}) {
  const tone = (v: number) => (v < 0 ? "text-despesa-ink" : v > 0 ? "text-receita-ink" : "");
  return (
    <tr className="border-b font-semibold">
      <th scope="row" className="sticky left-0 z-10 bg-background px-3 py-2 text-left">
        {label}
      </th>
      {values.map((v, m) => (
        <td key={m} className={cn("px-2 py-2 text-right", tone(v), colClass(m))}>
          {formatNumber(v)}
        </td>
      ))}
      <td className={cn("px-3 py-2 text-right", total !== undefined && tone(total))}>
        {total !== undefined ? formatNumber(total) : ""}
      </td>
    </tr>
  );
}
