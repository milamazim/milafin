import type { Metadata } from "next";
import { Suspense } from "react";

import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { dataStatus } from "@/server/queries";

import { DataManager } from "./data-manager";

export const metadata: Metadata = { title: "Dados" };

export default function DadosPage() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dados e backup</h1>
        <p className="text-sm text-muted-foreground">
          Seus dados ficam guardados na nuvem. Aqui você baixa uma cópia, restaura um backup ou exporta para o Excel.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <DadosContent />
      </Suspense>
    </div>
  );
}

async function DadosContent() {
  const user = await requireUser();
  const status = await dataStatus(user.id);
  const thisYear = Number(todayISO().slice(0, 4));
  const first = Math.min(status.firstYear ?? thisYear, thisYear);
  const last = Math.max(status.lastYear ?? thisYear, thisYear);
  const years = Array.from({ length: last - first + 1 }, (_, i) => last - i);
  return <DataManager status={status} years={years} thisYear={thisYear} />;
}
