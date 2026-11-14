import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Lançamentos" };

export default function LancamentosPage() {
  return (
    <Placeholder
      title="Lançamentos"
      stage="etapa 3"
      items={[
        "Grade anual por categoria e subcategoria, com subtotais e saldo do mês/acumulado no ano",
        "Lista do mês (extrato) com filtros e marcação de pago/recebido",
        "Séries recorrentes: frequências, dia de vencimento, editar só este ou deste em diante",
      ]}
    />
  );
}
