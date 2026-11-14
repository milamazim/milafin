"use client";

import { ChevronRightIcon, CircleAlertIcon, RepeatIcon } from "lucide-react";
import { startTransition, useOptimistic, useState } from "react";
import { toast } from "sonner";

import { ChartCard, DataTable } from "@/components/charts/chart-card";
import { ColumnChart, Legend } from "@/components/charts/column-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { Category } from "@/db/schema";
import type { Occurrence } from "@/domain/occurrences";
import type { MonthTotals } from "@/domain/summary";
import { categoryPath } from "@/lib/category-tree";
import { formatDate, formatDayShort, MONTHS, MONTHS_SHORT } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { compareYears, type CategoryShare, type CompareMeasure, type UpcomingBills } from "@/lib/reports";
import { cn } from "@/lib/utils";

import { setPaid } from "../lancamentos/actions";
import { MarkPastPaidButton } from "../lancamentos/mark-past-paid";

const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1, signDisplay: "always" });

export function ReportsView({
  year,
  periodLabel,
  today,
  categories,
  byCategory,
  top,
  bills,
  currentYear,
  previousYear,
}: {
  year: number;
  periodLabel: string;
  today: string;
  categories: Category[];
  byCategory: { total: number; items: CategoryShare[] };
  top: Occurrence[];
  bills: UpcomingBills;
  currentYear: MonthTotals[];
  previousYear: MonthTotals[];
}) {
  return (
    <>
      <Bills bills={bills} categories={categories} today={today} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ByCategory data={byCategory} periodLabel={periodLabel} />
        <TopExpenses top={top} categories={categories} periodLabel={periodLabel} />
      </div>
      <Comparison year={year} current={currentYear} previous={previousYear} />
    </>
  );
}

/* --------------------------------------------------------- contas a vencer */

function Bills({ bills, categories, today }: { bills: UpcomingBills; categories: Category[]; today: string }) {
  const all = [...bills.overdue, ...bills.upcoming];
  const overdueRecurring = bills.overdue.filter((o) => o.recurrenceId).length;
  const [items, setOptimisticPaid] = useOptimistic(all, (state, key: string) =>
    state.map((o) => (o.key === key ? { ...o, paid: true } : o)),
  );

  function pay(o: Occurrence) {
    startTransition(async () => {
      setOptimisticPaid(o.key);
      const r = await setPaid(
        o.transactionId && !o.recurrenceId
          ? { transactionId: o.transactionId, paid: true }
          : { recurrenceId: o.recurrenceId!, recurrenceDate: o.recurrenceDate!, paid: true },
      );
      if (r.ok) toast.success("Marcado como pago.");
      else toast.error(r.error);
    });
  }

  return (
    <Card id="contas" className="min-w-0 scroll-mt-20">
      <CardHeader>
        <CardTitle>Contas a vencer</CardTitle>
        <CardDescription>
          Despesas não pagas: atrasadas e dos próximos 30 dias (a partir de hoje, independente do filtro).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5">
            {bills.overdue.length > 0 && <CircleAlertIcon className="size-4 text-status-critical" aria-hidden />}
            Atrasadas: <strong>{formatBRL(bills.overdueCents)}</strong> ({bills.overdue.length})
          </span>
          <span>
            Próximos 30 dias: <strong>{formatBRL(bills.upcomingCents)}</strong> ({bills.upcoming.length})
          </span>
        </div>
        {overdueRecurring > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <span>
              {overdueRecurring} {overdueRecurring === 1 ? "atrasada vem" : "atrasadas vêm"} de lançamentos recorrentes. Se já
              foram pagas antes de você usar o app, marque todas de uma vez.
            </span>
            <MarkPastPaidButton label={`Marcar séries atrasadas como pagas (${overdueRecurring})`} />
          </div>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta pendente. 🎉</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((o) => {
              const overdue = o.date < today;
              return (
                <li key={o.key} className={cn("flex items-center gap-3 px-3 py-2 text-sm", o.paid && "opacity-50")}>
                  <Checkbox
                    checked={o.paid}
                    disabled={o.paid}
                    onCheckedChange={() => pay(o)}
                    aria-label={`Marcar como pago: ${categoryPath(categories, o.categoryId)} de ${formatDate(o.date)}`}
                  />
                  <span className={cn("w-24 shrink-0 text-xs", overdue ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {formatDayShort(o.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {categoryPath(categories, o.categoryId)}
                    {o.recurrenceId && <RepeatIcon className="ml-1.5 inline size-3 text-muted-foreground" aria-label="Recorrente" />}
                  </span>
                  {overdue && (
                    <span className="hidden items-center gap-1 text-xs sm:flex">
                      <CircleAlertIcon className="size-3.5 text-status-critical" aria-hidden /> Atrasada
                    </span>
                  )}
                  <span className="font-medium tabular-nums">{formatBRL(o.amountCents)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------- despesas por categoria */

/** Barras horizontais ordenadas, um só tom (não pizza): comparar partes. */
function ByCategory({ data, periodLabel }: { data: { total: number; items: CategoryShare[] }; periodLabel: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const max = data.items[0]?.cents ?? 0;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Despesas por categoria</CardTitle>
        <CardDescription>
          {periodLabel} · total {formatBRL(data.total)}. Toque numa categoria para ver as subcategorias.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa no período.</p>
        ) : (
          <ul className="grid gap-1">
            {data.items.map((item) => {
              const expandable = item.children.length > 0;
              const isOpen = open === item.categoryId;
              return (
                <li key={item.categoryId}>
                  <button
                    type="button"
                    disabled={!expandable}
                    aria-expanded={expandable ? isOpen : undefined}
                    onClick={() => setOpen(isOpen ? null : item.categoryId)}
                    className="grid w-full gap-1 rounded-md px-1.5 py-1.5 text-left enabled:hover:bg-muted"
                  >
                    <ShareRow name={item.name} cents={item.cents} share={item.share} max={max} chevron={expandable ? (isOpen ? "open" : "closed") : "none"} />
                  </button>
                  {isOpen && (
                    <ul className="mb-2 ml-4 grid gap-1 border-l pl-3">
                      {item.children.map((ch) => (
                        <li key={ch.categoryId} className="px-1.5 py-1">
                          <ShareRow name={ch.name} cents={ch.cents} share={ch.share} max={max} small />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ShareRow({
  name,
  cents,
  share,
  max,
  small,
  chevron,
}: {
  name: string;
  cents: number;
  share: number;
  max: number;
  small?: boolean;
  chevron?: "open" | "closed" | "none";
}) {
  return (
    <span className="grid gap-1">
      <span className={cn("flex items-baseline gap-2", small ? "text-xs" : "text-sm")}>
        {chevron === "none" && <span className="size-3.5 shrink-0" aria-hidden />}
        {chevron && chevron !== "none" && (
          <ChevronRightIcon className={cn("size-3.5 self-center text-muted-foreground transition-transform", chevron === "open" && "rotate-90")} />
        )}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className="font-medium tabular-nums">{formatBRL(cents)}</span>
        <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{pct.format(share)}</span>
      </span>
      <span className={cn("block w-full", small ? "h-1.5" : "h-2.5")}>
        <span
          className="block h-full rounded-r-[4px] bg-despesa"
          style={{ width: `${max ? Math.max(0.5, (cents / max) * 100) : 0}%`, opacity: small ? 0.7 : 1 }}
        />
      </span>
    </span>
  );
}

/* ------------------------------------------------------------ maiores gastos */

function TopExpenses({ top, categories, periodLabel }: { top: Occurrence[]; categories: Category[]; periodLabel: string }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Maiores gastos</CardTitle>
        <CardDescription>Os 10 maiores lançamentos de despesa em {periodLabel}.</CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa no período.</p>
        ) : (
          <ol className="divide-y text-sm">
            {top.map((o, i) => (
              <li key={o.key} className="flex items-center gap-3 py-2">
                <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{categoryPath(categories, o.categoryId)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDate(o.date)}
                    {o.note && ` · ${o.note}`}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{formatBRL(o.amountCents)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------- comparação de anos */

const MEASURES: { id: CompareMeasure; label: string }[] = [
  { id: "despesas", label: "Despesas" },
  { id: "receitas", label: "Receitas" },
  { id: "saldo", label: "Saldo" },
];

/** Ênfase: o ano escolhido na cor da medida, o anterior em cinza. */
function Comparison({ year, current, previous }: { year: number; current: MonthTotals[]; previous: MonthTotals[] }) {
  const [measure, setMeasure] = useState<CompareMeasure>("despesas");
  const cmp = compareYears(current, previous, measure);
  const accent = measure === "receitas" ? "var(--receita)" : measure === "despesas" ? "var(--despesa)" : (v: number) => (v < 0 ? "var(--despesa)" : "var(--receita)");
  const legendAccent = measure === "despesas" ? "var(--despesa)" : "var(--receita)";
  const better = measure === "despesas" ? cmp.diff < 0 : cmp.diff > 0;

  return (
    <ChartCard
      title={`Comparação: ${year} × ${year - 1}`}
      description={
        cmp.pct === null
          ? `Sem dados de ${year - 1} para comparar.`
          : `${MEASURES.find((m) => m.id === measure)!.label} no ano: ${formatBRL(cmp.totalCurrent)} (${pct1.format(cmp.pct)} em relação a ${year - 1}${cmp.diff === 0 ? "" : better ? ", melhor" : ", pior"}).`
      }
      legend={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-md border p-0.5 text-sm" role="radiogroup" aria-label="Medida">
            {MEASURES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={measure === m.id}
                onClick={() => setMeasure(m.id)}
                className={cn("rounded px-2.5 py-0.5", measure === m.id ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Legend
            items={[
              { name: String(year), color: legendAccent },
              { name: String(year - 1), color: "var(--viz-deemph)" },
            ]}
          />
        </div>
      }
      chart={
        <ColumnChart
          ariaLabel={`${measure} por mês, ${year} comparado a ${year - 1}`}
          labels={MONTHS_SHORT}
          fullLabels={MONTHS}
          formatValue={formatBRL}
          series={[
            { id: "cur", name: String(year), values: cmp.rows.map((r) => r.current), color: accent },
            { id: "prev", name: String(year - 1), values: cmp.rows.map((r) => r.previous), color: "var(--viz-deemph)" },
          ]}
        />
      }
      table={
        <DataTable
          head={["Mês", String(year), String(year - 1), "Diferença"]}
          rows={cmp.rows.map((r) => [MONTHS[r.month0], formatBRL(r.current), formatBRL(r.previous), formatBRL(r.diff)])}
          foot={["Total", formatBRL(cmp.totalCurrent), formatBRL(cmp.totalPrevious), formatBRL(cmp.diff)]}
        />
      }
    />
  );
}
