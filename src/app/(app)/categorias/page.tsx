import type { Metadata } from "next";

import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriasPage() {
  return (
    <Placeholder
      title="Categorias"
      stage="etapa 3"
      items={["Cadastro de categorias (receita/despesa) e subcategorias", "Renomear, mesclar e arquivar", "Limite mensal por categoria"]}
    />
  );
}
