import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Dados" };

export default function DadosPage() {
  return (
    <Placeholder
      title="Dados e backup"
      stage="etapa 5"
      items={["Backup completo em .json (exportar e restaurar)", "Exportação CSV para o Excel"]}
    />
  );
}
