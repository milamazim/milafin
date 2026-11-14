"use client";

import { ChartColumnIcon, TableIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Cartão de gráfico com alternância gráfico ↔ tabela: a tabela é a versão
 * acessível equivalente (todo valor do gráfico também está nela).
 */
export function ChartCard({
  title,
  description,
  legend,
  chart,
  table,
}: {
  title: string;
  description?: string;
  legend?: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            title={asTable ? "Ver gráfico" : "Ver como tabela"}
          >
            {asTable ? <ChartColumnIcon /> : <TableIcon />}
            <span className="hidden sm:inline">{asTable ? "Gráfico" : "Tabela"}</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3">
        {!asTable && legend}
        {asTable ? <div className="overflow-x-auto">{table}</div> : chart}
      </CardContent>
    </Card>
  );
}

/** Tabela simples e compacta para a visão em tabela dos gráficos. */
export function DataTable({ head, rows, foot }: { head: string[]; rows: React.ReactNode[][]; foot?: React.ReactNode[] }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="border-b text-xs text-muted-foreground">
          {head.map((h, i) => (
            <th key={h} className={i === 0 ? "py-1.5 pr-3 text-left font-medium" : "py-1.5 pl-3 text-right font-medium"}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b last:border-0">
            {r.map((cell, ci) => (
              <td key={ci} className={ci === 0 ? "py-1.5 pr-3" : "py-1.5 pl-3 text-right"}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr className="border-t font-semibold">
            {foot.map((cell, ci) => (
              <td key={ci} className={ci === 0 ? "py-1.5 pr-3" : "py-1.5 pl-3 text-right"}>
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
