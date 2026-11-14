"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { AnnualGrid } from "@/lib/annual-grid";
import { formatNumber, formatWhole, MONTHS, MONTHS_SHORT } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

/* Preferência "centavos" no navegador (padrão: não). Se o armazenamento estiver
   indisponível (ex.: modo privado restrito), vale só enquanto a página está aberta. */
const CENTS_KEY = "milafin:grade:centavos";
const centsListeners = new Set<() => void>();
let centsMemory: boolean | null = null;

function readCents(): boolean {
  if (centsMemory !== null) return centsMemory;
  try {
    return localStorage.getItem(CENTS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCents(value: boolean) {
  centsMemory = value;
  try {
    localStorage.setItem(CENTS_KEY, value ? "1" : "0");
  } catch {
    /* fica só em memória */
  }
  centsListeners.forEach((l) => l());
}

function subscribeCents(cb: () => void) {
  centsListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CENTS_KEY) {
      centsMemory = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    centsListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Grade anual estilo planilha: clique numa célula para ver/editar/adicionar.
 *
 * Densidade (tabela financeira):
 * - números em 13 px, alinhados à direita, com algarismos de largura fixa;
 * - por padrão em reais inteiros (visão geral do ano); "Centavos" mostra o
 *   valor completo, que também aparece na dica, no leitor de tela e no clique;
 * - colunas de largura fixa: os 12 meses iguais, total mais largo;
 * - rolagem própria, com cabeçalho dos meses, coluna de categorias e linhas de
 *   saldo fixos;
 * - em tela estreita, abre já rolada no mês atual.
 */
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
  const showCents = useSyncExternalStore(subscribeCents, readCents, () => false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totals = grid[mode];
  const fmt = showCents ? formatNumber : formatWhole;
  const colClass = (m: number) => cn(m === currentMonth0 && "bg-primary/5");
  const toggleCents = () => writeCents(!showCents);

  // tela estreita: abre com o mês atual visível
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || currentMonth0 === null || box.scrollWidth <= box.clientWidth) return;
    const th = box.querySelector<HTMLElement>(`[data-month="${currentMonth0}"]`);
    const first = box.querySelector<HTMLElement>("[data-col=categoria]");
    if (!th || !first) return;
    const target = th.offsetLeft - first.offsetWidth - th.offsetWidth; // deixa o mês anterior à vista
    box.scrollLeft = Math.max(0, target);
  }, [currentMonth0]);

  const monthW = showCents ? "w-[5.75rem]" : "w-[4.5rem]";
  const totalW = showCents ? "w-[7rem]" : "w-[5.5rem]";
  // largura mínima = soma das colunas (em rem), para a tabela não espremer
  const minWidth = `${(showCents ? 5.75 : 4.5) * 12 + (showCents ? 7 : 5.5) + 11}rem`;

  return (
    <div className="grid grid-cols-1 gap-2">
      <div
        ref={scrollRef}
        className="max-h-[calc(100dvh-17rem)] min-h-80 overflow-auto overscroll-x-contain rounded-lg border md:max-h-[calc(100dvh-13rem)]"
      >
        <table className="w-full table-fixed border-separate border-spacing-0 text-[13px] tabular-nums" style={{ minWidth }}>
          <colgroup>
            <col className="w-[8.5rem] md:w-[11rem]" />
            {MONTHS_SHORT.map((m) => (
              <col key={m} className={monthW} />
            ))}
            <col className={totalW} />
          </colgroup>

          <thead className="sticky top-0 z-20">
            <tr className="text-xs text-muted-foreground">
              <th data-col="categoria" className="sticky left-0 z-30 border-b bg-muted px-2 py-2 text-left font-medium md:px-3">
                Categoria
              </th>
              {MONTHS_SHORT.map((m, i) => (
                <th
                  key={m}
                  data-month={i}
                  title={MONTHS[i]}
                  aria-current={i === currentMonth0 ? "date" : undefined}
                  className={cn(
                    "border-b bg-muted px-2 py-2 text-right font-medium",
                    i === currentMonth0 && "text-foreground",
                  )}
                >
                  {m}
                </th>
              ))}
              <th className="border-b bg-muted px-2 py-2 text-right font-medium md:px-3">Total</th>
            </tr>
          </thead>

          {grid.sections.map((section) => (
            <tbody key={section.kind}>
              <tr>
                <th
                  colSpan={14}
                  className={cn(
                    "border-b bg-background pt-4 pb-1 text-left text-xs font-semibold tracking-wide uppercase",
                    section.kind === "receita" ? "text-receita-ink" : "text-despesa-ink",
                  )}
                >
                  {/* a célula ocupa a largura toda; fixar só o texto mantém o título à vista ao rolar */}
                  <span className="sticky left-0 inline-block px-2 md:px-3">{section.label}</span>
                </th>
              </tr>
              {section.rows.length === 0 && (
                <tr>
                  <td colSpan={14} className="border-b py-2 text-muted-foreground">
                    <span className="sticky left-0 inline-block px-3">Nenhuma categoria de {section.label.toLowerCase()}.</span>
                  </td>
                </tr>
              )}
              {/* categoria principal (com ou sem subcategorias) tem estilo de cabeçalho */}
              {section.rows.map((row) => (
                <tr key={row.key} className={cn(row.depth === 0 && "bg-muted/30 font-medium")}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 truncate border-b px-2 py-1.5 text-left font-normal md:px-3",
                      row.depth === 0 ? "bg-muted font-medium" : "bg-background",
                      row.depth === 1 && "pl-4 md:pl-7",
                      row.archived && "text-muted-foreground italic",
                    )}
                    title={row.label}
                  >
                    {row.label}
                  </th>
                  {row.months.map((cents, m) => (
                    <td key={m} className={cn("border-b p-0 text-right", colClass(m))}>
                      {row.categoryId ? (
                        <button
                          type="button"
                          onClick={() => onCellClick(row.categoryId!, m)}
                          title={cents ? formatBRL(cents) : undefined}
                          className="w-full truncate px-2 py-1.5 text-right hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                          aria-label={`${row.label}, ${MONTHS[m]}: ${cents ? formatBRL(cents) : "sem lançamentos"}`}
                        >
                          <Amount cents={cents} count={row.counts[m]} fmt={fmt} />
                        </button>
                      ) : (
                        <span className="block truncate px-2 py-1.5" title={cents ? formatBRL(cents) : undefined}>
                          <Amount cents={cents} fmt={fmt} />
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="truncate border-b px-2 py-1.5 text-right font-medium md:px-3" title={row.total ? formatBRL(row.total) : undefined}>
                    {row.total ? fmt(row.total) : "–"}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="sticky left-0 z-10 truncate border-b bg-muted px-2 py-1.5 text-left md:px-3">
                  Total {section.label.toLowerCase()}
                </th>
                {section.months.map((c, m) => (
                  <td key={m} className={cn("truncate border-b bg-muted/50 px-2 py-1.5 text-right", colClass(m))} title={c ? formatBRL(c) : undefined}>
                    {c ? fmt(c) : "–"}
                  </td>
                ))}
                <td className="truncate border-b bg-muted/50 px-2 py-1.5 text-right md:px-3" title={formatBRL(section.total)}>
                  {fmt(section.total)}
                </td>
              </tr>
            </tbody>
          ))}

          {/* saldos sempre à vista no rodapé da grade */}
          <tfoot className="sticky bottom-0 z-20">
            <BalanceRow
              label="Saldo do mês"
              values={totals.map((t) => t.saldo)}
              total={totals.reduce((a, t) => a + t.saldo, 0)}
              fmt={fmt}
              currentMonth0={currentMonth0}
              first
            />
            <BalanceRow label="Acumulado no ano" values={totals.map((t) => t.acumulado)} fmt={fmt} currentMonth0={currentMonth0} />
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
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
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showCents}
          onClick={toggleCents}
          className={cn("rounded-md border px-2 py-1", showCents ? "bg-muted font-medium text-foreground" : "hover:text-foreground")}
        >
          Centavos: {showCents ? "sim" : "não"}
        </button>
        <span className="hidden md:ml-auto md:inline">Clique numa célula para ver, editar ou adicionar lançamentos.</span>
      </div>
    </div>
  );
}

function Amount({ cents, count = 0, fmt }: { cents: number; count?: number; fmt: (c: number) => string }) {
  if (!cents) return <span className="text-muted-foreground/50">–</span>;
  return (
    <>
      {fmt(cents)}
      {count > 1 && <sup className="ml-0.5 text-[10px] text-muted-foreground">{count}</sup>}
    </>
  );
}

function BalanceRow({
  label,
  values,
  total,
  fmt,
  currentMonth0,
  first,
}: {
  label: string;
  values: number[];
  total?: number;
  fmt: (c: number) => string;
  currentMonth0: number | null;
  first?: boolean;
}) {
  const tone = (v: number) => (v < 0 ? "text-despesa-ink" : v > 0 ? "text-receita-ink" : "");
  const cell = cn("bg-background py-2 font-semibold", first && "border-t-2");
  return (
    <tr>
      <th scope="row" className={cn(cell, "sticky left-0 z-10 truncate px-2 text-left md:px-3")}>
        {label}
      </th>
      {values.map((v, m) => (
        <td
          key={m}
          className={cn(cell, "truncate px-2 text-right", tone(v), m === currentMonth0 && "bg-[color-mix(in_oklch,var(--primary)_5%,var(--background))]")}
          title={formatBRL(v)}
        >
          {fmt(v)}
        </td>
      ))}
      <td className={cn(cell, "truncate px-2 text-right md:px-3", total !== undefined && tone(total))} title={total !== undefined ? formatBRL(total) : undefined}>
        {total !== undefined ? fmt(total) : ""}
      </td>
    </tr>
  );
}
