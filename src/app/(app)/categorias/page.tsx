import type { Metadata } from "next";
import { Suspense } from "react";

import { requireUser } from "@/lib/auth";
import { categoryUsage, listCategories } from "@/server/queries";

import { CategoriesManager } from "./categories-manager";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriasPage() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          Organize receitas e despesas em categorias e subcategorias. Defina limites mensais para acompanhar o orçamento.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <CategoriesContent />
      </Suspense>
    </div>
  );
}

async function CategoriesContent() {
  const user = await requireUser();
  const [categories, usage] = await Promise.all([listCategories(user.id), categoryUsage(user.id)]);
  return <CategoriesManager categories={categories} usage={Object.fromEntries(usage)} />;
}
