import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "../auth-card";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Entrar" };

/**
 * O formulário fica FORA do <Suspense>: se ele dependesse dos searchParams,
 * a versão da casca estática seria trocada pela versão final e o que já foi
 * digitado (e o estado da action) se perderia. O `?next=` é lido pela própria
 * action, a partir da URL da página que enviou o formulário.
 */
export default function SignInPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <AuthCard title="Entrar" description="Acesse seu controle financeiro.">
      <div className="grid gap-4">
        <Suspense fallback={null}>
          <LinkErrorNotice searchParams={searchParams} />
        </Suspense>
        <SignInForm />
      </div>
    </AuthCard>
  );
}

async function LinkErrorNotice({ searchParams }: Pick<PageProps<"/entrar">, "searchParams">) {
  const { erro } = await searchParams;
  if (erro !== "link") return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      O link é inválido ou expirou. Tente novamente.
    </p>
  );
}
