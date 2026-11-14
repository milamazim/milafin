import type { Metadata } from "next";
import { Suspense } from "react";

import { yearRange } from "@/domain/dates";
import { buildAnnualGrid } from "@/lib/annual-grid";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { listCategories, loadPeriod } from "@/server/queries";

import { LancamentosView } from "./view";

export const metadata: Metadata = { title: "Lançamentos" };

export default function LancamentosPage({ searchParams }: PageProps<"/lancamentos">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando lançamentos…</p>}>
      <LancamentosContent searchParams={searchParams} />
    </Suspense>
  );
}

const intParam = (v: string | string[] | undefined, min: number, max: number) => {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

async function LancamentosContent({ searchParams }: Pick<PageProps<"/lancamentos">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const year = intParam(params.ano, 1900, 2200) ?? Number(today.slice(0, 4));
  const month = intParam(params.mes, 1, 12);
  const view = params.visao === "lista" || params.visao === "grade" ? params.visao : null;

  const { from, to } = yearRange(year);
  const [categories, period] = await Promise.all([listCategories(user.id), loadPeriod(user.id, from, to)]);
  const grid = buildAnnualGrid(year, categories, period.occurrences);

  return (
    <LancamentosView
      key={year} // trocar de ano recomeça o estado (mês, diálogos)
      year={year}
      today={today}
      initialMonth0={month !== null ? month - 1 : year === Number(today.slice(0, 4)) ? Number(today.slice(5, 7)) - 1 : 0}
      initialView={view}
      categories={categories}
      occurrences={period.occurrences}
      recurrences={period.recurrences}
      grid={grid}
    />
  );
}
