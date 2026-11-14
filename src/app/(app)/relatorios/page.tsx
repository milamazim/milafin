import type { Metadata } from "next";
import { Suspense } from "react";

import { PeriodFilter } from "@/components/period-filter";
import { addDays, monthRange, yearRange } from "@/domain/dates";
import { summarizeYear } from "@/domain/summary";
import { requireUser } from "@/lib/auth";
import { MONTHS, todayISO } from "@/lib/format";
import { expensesByCategory, topExpenses, upcomingBills } from "@/lib/reports";
import { listCategories, loadPeriod } from "@/server/queries";

import { ReportsView } from "./reports-view";

export const metadata: Metadata = { title: "Relatórios" };

const intParam = (v: string | string[] | undefined, min: number, max: number) => {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export default function RelatoriosPage({ searchParams }: PageProps<"/relatorios">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando relatórios…</p>}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportsContent({ searchParams }: Pick<PageProps<"/relatorios">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const year = intParam(params.ano, 1900, 2200) ?? thisYear;
  const mes = intParam(params.mes, 1, 12);
  const month0 = mes === null ? null : mes - 1;
  const range = month0 === null ? yearRange(year) : monthRange(year, month0);
  const periodLabel = month0 === null ? `${year}` : `${MONTHS[month0].toLowerCase()} de ${year}`;

  const [categories, current, previous, recent] = await Promise.all([
    listCategories(user.id),
    loadPeriod(user.id, yearRange(year).from, yearRange(year).to),
    loadPeriod(user.id, yearRange(year - 1).from, yearRange(year - 1).to),
    loadPeriod(user.id, addDays(today, -365), addDays(today, 30)),
  ]);
  const info = categories.map((c) => ({ id: c.id, parentId: c.parentId, kind: c.kind, monthlyLimitCents: c.monthlyLimitCents }));

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold tracking-tight">Relatórios</h1>
        <PeriodFilter basePath="/relatorios" year={year} month0={month0} allowYear thisYear={thisYear} />
      </div>
      <ReportsView
        year={year}
        periodLabel={periodLabel}
        today={today}
        categories={categories}
        byCategory={expensesByCategory(current.occurrences, categories, range.from, range.to)}
        top={topExpenses(current.occurrences, categories, range.from, range.to, 10)}
        bills={upcomingBills(recent.occurrences, categories, today, 30)}
        currentYear={summarizeYear(year, current.occurrences, info).previsto}
        previousYear={summarizeYear(year - 1, previous.occurrences, info).previsto}
      />
    </div>
  );
}
