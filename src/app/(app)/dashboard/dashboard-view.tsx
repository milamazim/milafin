"use client";

import { CircleAlertIcon, PiggyBankIcon } from "lucide-react";
import Link from "next/link";

import { ChartCard, DataTable } from "@/components/charts/chart-card";
import { ColumnChart, Legend } from "@/components/charts/column-chart";
import { BudgetMeter } from "@/components/charts/meter";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Category } from "@/db/schema";
import type { BudgetUsage, YearSummary } from "@/domain/summary";
import { categoryPath } from "@/lib/category-tree";
import { formatDayShort, MONTHS, MONTHS_SHORT } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import type { UpcomingBills } from "@/lib/reports";
import { cn } from "@/lib/utils";

const RECEITA = "var(--receita)";
const DESPESA = "var(--despesa)";

export function DashboardView({
  year,
  month0,
  currentMonth0,
  summary,
  budget,
  bills,
  categories,
  hasCategories,
}: {
  year: number;
  month0: number;
  currentMonth0: number | null;
  summary: YearSummary;
  budget: (BudgetUsage & { name: string })[];
  bills: UpcomingBills;
  categories: Category[];
  hasCategories: boolean;
}) {
  if (!hasCategories) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nada para mostrar ainda</CardTitle>
          <CardDescription>Cadastre categorias e lançamentos para ver o resumo do ano.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/categorias" className={buttonVariants()}>
            Ir para Categorias
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { previsto, realizado, totalPrevisto: tp, totalRealizado: tr } = summary;

  return (
    <>
      {/* KPIs do ano: números, não gráfico */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label={`Receitas em ${year}`} value={tp.receitas} realized={tr.receitas} />
        <StatTile label={`Despesas em ${year}`} value={tp.despesas} realized={tr.despesas} />
        <StatTile label={`Saldo de ${year}`} value={tp.saldo} realized={tr.saldo} signed />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Receitas e despesas por mês"
          description="Previsto: inclui o que ainda não foi pago."
          legend={
            <Legend
              items={[
                { name: "Receitas", color: RECEITA },
                { name: "Despesas", color: DESPESA },
              ]}
            />
          }
          chart={
            <ColumnChart
              ariaLabel={`Receitas e despesas por mês em ${year}`}
              labels={MONTHS_SHORT}
              fullLabels={MONTHS}
              highlightIndex={currentMonth0}
              formatValue={formatBRL}
              series={[
                { id: "r", name: "Receitas", values: previsto.map((m) => m.receitas), color: RECEITA },
                { id: "d", name: "Despesas", values: previsto.map((m) => m.despesas), color: DESPESA },
              ]}
            />
          }
          table={
            <DataTable
              head={["Mês", "Receitas", "Despesas", "Saldo"]}
              rows={previsto.map((m, i) => [MONTHS[i], formatBRL(m.receitas), formatBRL(m.despesas), formatBRL(m.saldo)])}
              foot={["Total", formatBRL(tp.receitas), formatBRL(tp.despesas), formatBRL(tp.saldo)]}
            />
          }
        />

        <ChartCard
          title="Saldo do mês"
          description="Quanto sobrou (acima de zero) ou faltou (abaixo) em cada mês."
          legend={
            <Legend
              items={[
                { name: "Sobrou", color: RECEITA },
                { name: "Faltou", color: DESPESA },
              ]}
            />
          }
          chart={
            <ColumnChart
              ariaLabel={`Saldo de cada mês em ${year}`}
              labels={MONTHS_SHORT}
              fullLabels={MONTHS}
              highlightIndex={currentMonth0}
              formatValue={formatBRL}
              series={[
                {
                  id: "s",
                  name: "Saldo",
                  values: previsto.map((m) => m.saldo),
                  color: (v) => (v < 0 ? DESPESA : RECEITA),
                },
              ]}
            />
          }
          table={
            <DataTable
              head={["Mês", "Saldo previsto", "Acumulado", "Saldo realizado"]}
              rows={previsto.map((m, i) => [MONTHS[i], formatBRL(m.saldo), formatBRL(m.acumulado), formatBRL(realizado[i].saldo)])}
            />
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Orçamento de {MONTHS[month0].toLowerCase()}</CardTitle>
            <CardDescription>Gasto previsto no mês em relação ao limite de cada categoria.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            {budget.length === 0 ? (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <PiggyBankIcon className="mt-0.5 size-4 shrink-0" />
                <p>
                  Nenhum limite definido. Em{" "}
                  <Link href="/categorias" className="underline underline-offset-2">
                    Categorias
                  </Link>
                  , use “Limite mensal” nas despesas que quer acompanhar.
                </p>
              </div>
            ) : (
              [...budget]
                .sort((a, b) => b.ratio - a.ratio)
                .map((b) => (
                  <BudgetMeter key={b.categoryId} name={b.name} usedCents={b.usedCents} paidCents={b.paidCents} limitCents={b.limitCents} />
                ))
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Contas a pagar</CardTitle>
            <CardDescription>Atrasadas e dos próximos 7 dias, a partir de hoje.</CardDescription>
            <CardAction>
              <Link href="/relatorios#contas" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Ver todas
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            {bills.overdue.length > 0 && (
              <p className="flex items-center gap-1.5 text-sm">
                <CircleAlertIcon className="size-4 text-status-critical" aria-hidden />
                <span>
                  <strong>{bills.overdue.length}</strong> atrasada{bills.overdue.length > 1 ? "s" : ""}, somando{" "}
                  <strong>{formatBRL(bills.overdueCents)}</strong>
                </span>
              </p>
            )}
            {bills.upcoming.length === 0 && bills.overdue.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma conta pendente nos próximos 7 dias. 🎉</p>
            )}
            {bills.upcoming.length > 0 && (
              <ul className="divide-y rounded-lg border text-sm">
                {bills.upcoming.slice(0, 6).map((o) => (
                  <li key={o.key} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">{formatDayShort(o.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{categoryPath(categories, o.categoryId)}</span>
                    <span className="font-medium tabular-nums">{formatBRL(o.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatTile({ label, value, realized, signed }: { label: string; value: number; realized: number; signed?: boolean }) {
  return (
    <Card className="min-w-0 gap-1 py-4">
      <CardContent className="grid grid-cols-1 gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={cn(
            "truncate text-2xl font-semibold sm:text-3xl",
            signed && value < 0 && "text-despesa-ink",
          )}
        >
          {formatBRL(value)}
        </p>
        <p className="truncate text-xs text-muted-foreground">realizado (só pagos): {formatBRL(realized)}</p>
      </CardContent>
    </Card>
  );
}
