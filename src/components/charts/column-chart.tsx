"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Gráfico de colunas (agrupadas ou de uma série), em SVG próprio.
 * Specs (skill dataviz): colunas ≤ 24px, ponta arredondada 4px e base reta,
 * 2px de vão entre colunas vizinhas, grade em linha fina, um único eixo Y.
 * Valores negativos crescem para baixo a partir do zero (divergente).
 * Interação: cada mês é um alvo (mouse e teclado) com uma dica listando
 * todas as séries; a tabela equivalente fica no ChartCard.
 */

export interface ColumnSeries {
  id: string;
  name: string;
  values: number[];
  /** cor CSS (var(--…)) ou função do valor (ex.: positivo/negativo) */
  color: string | ((v: number) => string);
}

const HEIGHT = 240;
const M = { top: 12, right: 8, bottom: 26, left: 52 };
const MAX_BAR = 24;
const GAP = 2;
const R = 4;

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Coluna com a ponta (lado oposto ao zero) arredondada e a base reta. */
function columnPath(x: number, w: number, yZero: number, yValue: number): string {
  const h = Math.abs(yZero - yValue);
  if (h < 0.5) return "";
  const r = Math.min(R, w / 2, h);
  if (yValue < yZero) {
    // positiva: arredonda em cima
    return `M${x},${yZero}V${yValue + r}Q${x},${yValue} ${x + r},${yValue}H${x + w - r}Q${x + w},${yValue} ${x + w},${yValue + r}V${yZero}Z`;
  }
  // negativa: arredonda embaixo
  return `M${x},${yZero}V${yValue - r}Q${x},${yValue} ${x + r},${yValue}H${x + w - r}Q${x + w},${yValue} ${x + w},${yValue - r}V${yZero}Z`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function ColumnChart({
  labels,
  fullLabels = labels,
  series,
  formatValue,
  highlightIndex,
  ariaLabel,
}: {
  labels: string[];
  /** rótulos completos para dica/leitor de tela (ex.: "Março") */
  fullLabels?: string[];
  series: ColumnSeries[];
  formatValue: (v: number) => string;
  /** coluna destacada (ex.: mês atual) */
  highlightIndex?: number | null;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const all = series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const y = (v: number) => M.top + ((yMax - v) / (yMax - yMin)) * plotH;
  const band = plotW / labels.length;
  const n = series.length;
  const barW = Math.max(2, Math.min(MAX_BAR, (band * 0.72 - GAP * (n - 1)) / n));
  const groupW = barW * n + GAP * (n - 1);
  const colorOf = (s: ColumnSeries, v: number) => (typeof s.color === "function" ? s.color(v) : s.color);
  const showEvery = band < 30 ? 2 : 1; // em telas estreitas, rótulo sim/não

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="group" aria-label={ariaLabel} className="block overflow-visible">
          {/* grade e eixo Y */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? "stroke-viz-axis" : "stroke-viz-grid"}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {compact.format(t / 100)}
              </text>
            </g>
          ))}

          {labels.map((label, i) => {
            const x0 = M.left + i * band;
            const gx = x0 + (band - groupW) / 2;
            const summary = `${fullLabels[i]}: ${series.map((s) => `${s.name} ${formatValue(s.values[i])}`).join(", ")}`;
            return (
              <g key={label + i}>
                {/* faixa do mês: destaque e alvo de mouse/teclado (maior que as colunas) */}
                <rect
                  x={x0}
                  y={M.top}
                  width={band}
                  height={plotH}
                  className={cn(
                    "fill-transparent outline-none",
                    (active === i || highlightIndex === i) && "fill-muted/60",
                  )}
                  tabIndex={0}
                  role="img"
                  aria-label={summary}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                />
                {series.map((s, si) => (
                  <path
                    key={s.id}
                    d={columnPath(gx + si * (barW + GAP), barW, y(0), y(s.values[i]))}
                    fill={colorOf(s, s.values[i])}
                    className="pointer-events-none"
                    opacity={active === null || active === i ? 1 : 0.55}
                  />
                ))}
                {i % showEvery === 0 && (
                  <text
                    x={x0 + band / 2}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className={cn(
                      "pointer-events-none fill-muted-foreground text-[11px]",
                      highlightIndex === i && "fill-foreground font-medium",
                    )}
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {width === 0 && <div style={{ height: HEIGHT }} />}

      {active !== null && width > 0 && (
        <Tooltip
          left={Math.min(Math.max(M.left + (active + 0.5) * band, 90), width - 90)}
          title={fullLabels[active]}
          rows={series.map((s) => ({ name: s.name, value: formatValue(s.values[active]), color: colorOf(s, s.values[active]) }))}
        />
      )}
    </div>
  );
}

function Tooltip({ left, title, rows }: { left: number; title: string; rows: { name: string; value: string; color: string }[] }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
      style={{ left }}
      role="presentation"
    >
      <p className="mb-1 text-muted-foreground">{title}</p>
      {rows.map((r) => (
        <p key={r.name} className="flex items-center gap-2">
          {/* chave em linha curta, não caixa */}
          <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} />
          <span className="font-semibold tabular-nums">{r.value}</span>
          <span className="text-muted-foreground">{r.name}</span>
        </p>
      ))}
    </div>
  );
}

/** Legenda (≥ 2 séries): amostra retangular + nome em cor de texto. */
export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.name}
        </li>
      ))}
    </ul>
  );
}
