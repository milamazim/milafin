"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { MONTHS } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Filtros de período numa linha acima do conteúdo (valem para tudo abaixo).
 * `month0 = null` com `allowYear` significa "ano inteiro".
 */
export function PeriodFilter({
  basePath,
  year,
  month0,
  allowYear = false,
  thisYear,
}: {
  basePath: string;
  year: number;
  month0: number | null;
  allowYear?: boolean;
  thisYear: number;
}) {
  const router = useRouter();
  const href = (y: number, m: number | null) => {
    const q = new URLSearchParams({ ano: String(y) });
    if (m !== null) q.set("mes", String(m + 1));
    return `${basePath}?${q}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Ano" className="flex items-center">
        <Link href={href(year - 1, month0)} aria-label="Ano anterior" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ChevronLeftIcon />
        </Link>
        <Link
          href={href(thisYear, month0)}
          title="Voltar para o ano atual"
          className={cn(buttonVariants({ variant: "ghost" }), "px-2 text-base font-semibold tabular-nums")}
        >
          {year}
        </Link>
        <Link href={href(year + 1, month0)} aria-label="Próximo ano" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ChevronRightIcon />
        </Link>
      </nav>
      <NativeSelect
        aria-label="Mês"
        value={month0 === null ? "" : String(month0)}
        onChange={(e) => router.push(href(year, e.target.value === "" ? null : Number(e.target.value)))}
      >
        {allowYear && <NativeSelectOption value="">Ano inteiro</NativeSelectOption>}
        {MONTHS.map((m, i) => (
          <NativeSelectOption key={m} value={i}>
            {m}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
