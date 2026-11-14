import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Placeholder
      title="Dashboard"
      stage="etapa 4"
      items={["Cards de receitas, despesas e saldo do ano", "Despesas × receita por mês", "Orçamento mensal por categoria"]}
    />
  );
}
