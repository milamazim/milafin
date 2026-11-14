import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "../auth-card";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <AuthCard title="Entrar" description="Acesse seu controle financeiro.">
      <Suspense fallback={<SignInForm />}>
        <SignInFromParams searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignInFromParams({ searchParams }: Pick<PageProps<"/entrar">, "searchParams">) {
  const { next, erro } = await searchParams;
  return <SignInForm next={typeof next === "string" ? next : undefined} linkError={erro === "link"} />;
}
