"use client";

import { RepeatIcon } from "lucide-react";
import { startTransition, useOptimistic, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Category } from "@/db/schema";
import { month0Of } from "@/domain/dates";
import type { Occurrence } from "@/domain/occurrences";
import { summarizeYear } from "@/domain/summary";
import { categoryPath } from "@/lib/category-tree";
import { formatDayShort } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

import { setPaid } from "./actions";

type Filter = "todos" | "pendentes" | "pagos";

/** Lista/extrato do mês (E1): visão principal no celular. */
export function MonthList({
  year,
  month0,
  today,
  categories,
  occurrences,
  onOpen,
}: {
  year: number;
  month0: number;
  today: string;
  categories: Category[];
  occurrences: Occurrence[];
  onOpen: (o: Occurrence) => void;
}) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [optimistic, setOptimisticPaid] = useOptimistic(
    occurrences,
    (state, change: { key: string; paid: boolean }) => state.map((o) => (o.key === change.key ? { ...o, paid: change.paid } : o)),
  );

  const kindOf = (id: string) => categories.find((c) => c.id === id)?.kind ?? "despesa";
  const month = optimistic.filter((o) => month0Of(o.date) === month0);
  const summary = summarizeYear(
    year,
    month,
    categories.map((c) => ({ id: c.id, parentId: c.parentId, kind: c.kind, monthlyLimitCents: c.monthlyLimitCents })),
  );
  const prev = summary.previsto[month0];
  const real = summary.realizado[month0];

  const visible = month.filter((o) => (filter === "pendentes" ? !o.paid : filter === "pagos" ? o.paid : true));
  const byDay = new Map<string, Occurrence[]>();
  for (const o of visible) byDay.set(o.date, [...(byDay.get(o.date) ?? []), o]);

  function togglePaid(o: Occurrence, paid: boolean) {
    startTransition(async () => {
      setOptimisticPaid({ key: o.key, paid });
      const r = await setPaid(
        o.transactionId && !o.recurrenceId
          ? { transactionId: o.transactionId, paid }
          : { recurrenceId: o.recurrenceId!, recurrenceDate: o.recurrenceDate!, paid },
      );
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Receitas" value={prev.receitas} sub={real.receitas} tone="pos" />
        <Stat label="Despesas" value={prev.despesas} sub={real.despesas} tone="neg" />
        <Stat label="Saldo" value={prev.saldo} sub={real.saldo} tone={prev.saldo < 0 ? "neg" : "pos"} />
      </div>

      <div className="inline-flex w-fit rounded-md border p-0.5 text-sm" role="radiogroup" aria-label="Filtro">
        {(
          [
            ["todos", "Todos"],
            ["pendentes", "A pagar/receber"],
            ["pagos", "Pagos/recebidos"],
          ] as const
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={cn("rounded px-2.5 py-1", filter === f ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {month.length === 0 ? "Nenhum lançamento neste mês." : "Nada com este filtro."}
        </p>
      )}

      {[...byDay.entries()].map(([day, items]) => (
        <section key={day} aria-label={formatDayShort(day)}>
          <h3 className={cn("mb-1 text-xs font-medium text-muted-foreground uppercase", day === today && "text-primary")}>
            {formatDayShort(day)}
            {day === today && " · hoje"}
          </h3>
          <ul className="divide-y rounded-lg border">
            {items.map((o) => {
              const receita = kindOf(o.categoryId) === "receita";
              const overdue = !o.paid && o.date < today;
              return (
                <li key={o.key} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox
                    checked={o.paid}
                    onCheckedChange={(v) => togglePaid(o, Boolean(v))}
                    aria-label={`${receita ? "Recebido" : "Pago"}: ${categoryPath(categories, o.categoryId)}`}
                  />
                  <button type="button" onClick={() => onOpen(o)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", o.paid && "text-muted-foreground")}>
                        {categoryPath(categories, o.categoryId)}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {o.recurrenceId && <RepeatIcon className="size-3" aria-label="Recorrente" />}
                        {o.edited && <span>editado</span>}
                        {o.note && <span className="truncate">{o.note}</span>}
                      </span>
                    </span>
                    {overdue && <Badge variant="destructive">Atrasado</Badge>}
                    <span
                      className={cn(
                        "text-sm font-medium whitespace-nowrap tabular-nums",
                        receita ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400",
                        o.paid && "opacity-60",
                      )}
                    >
                      {receita ? "+" : "−"} {formatBRL(o.amountCents)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number; sub: number; tone: "pos" | "neg" }) {
  return (
    <div className="min-w-0 rounded-lg border p-2.5 sm:p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "truncate text-sm font-semibold tabular-nums sm:text-lg",
          tone === "pos" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400",
        )}
      >
        {formatBRL(value)}
      </p>
      <p className="truncate text-xs text-muted-foreground tabular-nums" title="Só pagos/recebidos">
        realizado {formatBRL(sub)}
      </p>
    </div>
  );
}
