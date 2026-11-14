import type { Metadata } from "next";
import { Suspense } from "react";

import { PeriodFilter } from "@/components/period-filter";
import { addDays, yearRange } from "@/domain/dates";
import { budgetUsage, summarizeYear } from "@/domain/summary";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { upcomingBills } from "@/lib/reports";
import { listCategories, loadPeriod } from "@/server/queries";

import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

const intParam = (v: string | string[] | undefined, min: number, max: number) => {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando dashboard…</p>}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const year = intParam(params.ano, 1900, 2200) ?? thisYear;
  const month0 = (intParam(params.mes, 1, 12) ?? (year === thisYear ? Number(today.slice(5, 7)) : 1)) - 1;

  const { from, to } = yearRange(year);
  const [categories, period, recent] = await Promise.all([
    listCategories(user.id),
    loadPeriod(user.id, from, to),
    // contas a vencer são sempre relativas a hoje
    loadPeriod(user.id, addDays(today, -365), addDays(today, 7)),
  ]);
  const info = categories.map((c) => ({ id: c.id, parentId: c.parentId, kind: c.kind, monthlyLimitCents: c.monthlyLimitCents }));
  const summary = summarizeYear(year, period.occurrences, info);
  const budget = budgetUsage(year, month0, period.occurrences, info);
  const bills = upcomingBills(recent.occurrences, categories, today, 7);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold tracking-tight">Dashboard</h1>
        <PeriodFilter basePath="/dashboard" year={year} month0={month0} thisYear={thisYear} />
      </div>
      <DashboardView
        year={year}
        month0={month0}
        currentMonth0={year === thisYear ? Number(today.slice(5, 7)) - 1 : null}
        summary={summary}
        budget={budget.map((b) => ({ ...b, name: categories.find((c) => c.id === b.categoryId)?.name ?? "—" }))}
        bills={bills}
        categories={categories}
        hasCategories={categories.length > 0}
      />
    </div>
  );
}
