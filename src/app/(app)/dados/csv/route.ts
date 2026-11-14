import type { NextRequest } from "next/server";

import { yearRange } from "@/domain/dates";
import { requireUser } from "@/lib/auth";
import { occurrencesToCsv } from "@/lib/csv";
import { listCategories, loadPeriod } from "@/server/queries";

/** Download do CSV (Excel) de um ano: `/dados/csv?ano=2026`. */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const year = Number(request.nextUrl.searchParams.get("ano"));
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    return new Response("Ano inválido.", { status: 400 });
  }
  const { from, to } = yearRange(year);
  const [categories, period] = await Promise.all([listCategories(user.id), loadPeriod(user.id, from, to)]);
  return new Response(occurrencesToCsv(period.occurrences, categories), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financas_${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
