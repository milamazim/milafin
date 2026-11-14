import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Relatórios" };

export default function RelatoriosPage() {
  return (
    <Placeholder
      title="Relatórios"
      stage="etapa 4"
      items={["Despesas por categoria", "Comparação entre anos", "Maiores gastos do período", "Contas a vencer"]}
    />
  );
}
