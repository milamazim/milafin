import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";

import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Medidor de orçamento (C2): gasto previsto do mês × limite.
 * Trilha num tom claro da mesma rampa; o preenchimento indica a situação e
 * vem SEMPRE com ícone + texto (cor nunca sozinha):
 *   < 80% normal · 80–100% "perto do limite" · > 100% "estourou".
 */
export function BudgetMeter({
  name,
  usedCents,
  paidCents,
  limitCents,
}: {
  name: string;
  usedCents: number;
  paidCents: number;
  limitCents: number;
}) {
  const ratio = limitCents ? usedCents / limitCents : 0;
  const state = ratio > 1 ? "over" : ratio >= 0.8 ? "near" : "ok";
  const pct = Math.round(ratio * 100);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{name}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">{formatBRL(usedCents)}</span> de {formatBRL(limitCents)}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-meter-track"
        role="meter"
        aria-label={`${name}: ${pct}% do limite`}
        aria-valuemin={0}
        aria-valuemax={limitCents}
        aria-valuenow={usedCents}
        aria-valuetext={`${formatBRL(usedCents)} de ${formatBRL(limitCents)} (${pct}%)`}
      >
        <div
          className={cn(
            "h-full rounded-full",
            state === "ok" && "bg-receita",
            state === "near" && "bg-status-warning",
            state === "over" && "bg-status-critical",
          )}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {state === "over" && (
            <>
              <CircleAlertIcon className="size-3.5 text-status-critical" aria-hidden />
              <span className="font-medium text-foreground">Estourou {formatBRL(usedCents - limitCents)}</span>
            </>
          )}
          {state === "near" && (
            <>
              <TriangleAlertIcon className="size-3.5 text-status-warning" aria-hidden />
              <span className="font-medium text-foreground">Perto do limite</span>
            </>
          )}
          {state === "ok" && <span>Restam {formatBRL(limitCents - usedCents)}</span>}
        </span>
        <span className="tabular-nums">
          {pct}% · pago {formatBRL(paidCents)}
        </span>
      </div>
    </div>
  );
}
