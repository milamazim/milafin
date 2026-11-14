"use client";

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, RepeatIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Category } from "@/db/schema";
import { daysInMonth, month0Of, parseISO, toISO, type ISODate } from "@/domain/dates";
import type { Occurrence, RecurrenceRow } from "@/domain/occurrences";
import type { AnnualGrid } from "@/lib/annual-grid";
import { categoryPath } from "@/lib/category-tree";
import { formatDate, MONTHS } from "@/lib/format";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

import { AnnualGridTable } from "./annual-grid-table";
import { EntryDialog, type EntryDialogState } from "./entry-dialog";
import { MonthList } from "./month-list";

type View = "grade" | "lista";

/** Tela larga (≥ md) mostra a grade por padrão; celular mostra a lista (E1). */
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
}

/** Dia sugerido para um novo lançamento no mês: hoje, ou o mesmo dia ajustado ao mês. */
function suggestedDate(year: number, month0: number, today: ISODate): ISODate {
  const t = parseISO(today);
  if (t.y === year && t.m === month0 + 1) return today;
  return toISO(year, month0 + 1, Math.min(t.d, daysInMonth(year, month0 + 1)));
}

export function LancamentosView({
  year,
  today,
  initialMonth0,
  initialView,
  categories,
  occurrences,
  recurrences,
  grid,
}: {
  year: number;
  today: ISODate;
  initialMonth0: number;
  initialView: View | null;
  categories: Category[];
  occurrences: Occurrence[];
  recurrences: RecurrenceRow[];
  grid: AnnualGrid;
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [chosenView, setChosenView] = useState<View | null>(initialView);
  const [month0, setMonth0] = useState(initialMonth0);
  const [entry, setEntry] = useState<EntryDialogState>(null);
  const [cell, setCell] = useState<{ categoryId: string; month0: number } | null>(null);

  const view: View = chosenView ?? (isDesktop ? "grade" : "lista");
  const thisYear = Number(today.slice(0, 4));

  const href = (p: { ano?: number; mes?: number; visao?: View | null }) => {
    const q = new URLSearchParams();
    q.set("ano", String(p.ano ?? year));
    const v = p.visao === undefined ? chosenView : p.visao;
    if (v) q.set("visao", v);
    if (p.mes) q.set("mes", String(p.mes));
    return `/lancamentos?${q}`;
  };
  // atualiza a URL sem recarregar (aba e mês sobrevivem ao recarregar/compartilhar)
  const sync = (v: View | null, m: number) => window.history.replaceState(null, "", href({ visao: v, mes: m + 1 }));

  const chooseView = (v: View) => {
    setChosenView(v);
    sync(v, month0);
  };
  const goMonth = (m: number) => {
    if (m < 0) return router.push(href({ ano: year - 1, mes: 12 }));
    if (m > 11) return router.push(href({ ano: year + 1, mes: 1 }));
    setMonth0(m);
    sync(chosenView, m);
  };

  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao milafin 👋</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p className="text-muted-foreground">
            Para lançar receitas e despesas, primeiro crie suas categorias. Há um conjunto sugerido para começar rápido.
          </p>
          <Link href="/categorias" className={cn(buttonVariants(), "w-fit")}>
            Ir para Categorias
          </Link>
        </CardContent>
      </Card>
    );
  }

  const cellItems = cell
    ? occurrences.filter((o) => o.categoryId === cell.categoryId && month0Of(o.date) === cell.month0)
    : [];

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold tracking-tight">Lançamentos</h1>
        <nav aria-label="Ano" className="flex items-center gap-1">
          <Link href={href({ ano: year - 1, mes: month0 + 1 })} aria-label="Ano anterior" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ChevronLeftIcon />
          </Link>
          <Link
            href={href({ ano: thisYear })}
            title="Voltar para o ano atual"
            className={cn(buttonVariants({ variant: "ghost" }), "px-2 text-base font-semibold tabular-nums")}
          >
            {year}
          </Link>
          <Link href={href({ ano: year + 1, mes: month0 + 1 })} aria-label="Próximo ano" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ChevronRightIcon />
          </Link>
        </nav>
        <Button onClick={() => setEntry({ mode: "create", date: suggestedDate(year, month0, today) })}>
          <PlusIcon /> Novo lançamento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border p-0.5 text-sm" role="tablist" aria-label="Visão">
          {(
            [
              ["grade", "Grade anual"],
              ["lista", "Lista do mês"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => chooseView(v)}
              className={cn("rounded px-3 py-1", view === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "lista" && (
          <nav aria-label="Mês" className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => goMonth(month0 - 1)}>
              <ChevronLeftIcon />
            </Button>
            <span className="min-w-28 text-center font-medium">
              {MONTHS[month0]} {year}
            </span>
            <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => goMonth(month0 + 1)}>
              <ChevronRightIcon />
            </Button>
          </nav>
        )}
      </div>

      {view === "grade" ? (
        <AnnualGridTable
          grid={grid}
          currentMonth0={year === thisYear ? Number(today.slice(5, 7)) - 1 : null}
          onCellClick={(categoryId, m) => setCell({ categoryId, month0: m })}
        />
      ) : (
        <MonthList
          year={year}
          month0={month0}
          today={today}
          categories={categories}
          occurrences={occurrences}
          onOpen={(o) => setEntry({ mode: "edit", occurrence: o })}
        />
      )}

      <Dialog open={cell !== null} onOpenChange={(o) => !o && setCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cell && categoryPath(categories, cell.categoryId)}</DialogTitle>
            <DialogDescription>{cell && `${MONTHS[cell.month0]} de ${year}`}</DialogDescription>
          </DialogHeader>
          {cellItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {cellItems.map((o) => (
                <li key={o.key}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setCell(null);
                      setEntry({ mode: "edit", occurrence: o });
                    }}
                  >
                    <span className="w-20 text-muted-foreground tabular-nums">{formatDate(o.date).slice(0, 5)}</span>
                    {o.recurrenceId && <RepeatIcon className="size-3.5 text-muted-foreground" aria-label="Recorrente" />}
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.note}</span>
                    {o.paid && <span className="text-xs text-muted-foreground">pago</span>}
                    <span className="font-medium tabular-nums">{formatBRL(o.amountCents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                const c = cell!;
                setCell(null);
                setEntry({ mode: "create", date: suggestedDate(year, c.month0, today), categoryId: c.categoryId });
              }}
            >
              <PlusIcon /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EntryDialog state={entry} onClose={() => setEntry(null)} categories={categories} recurrences={recurrences} />
    </div>
  );
}
