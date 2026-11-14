import type { Metadata } from "next";
import { Suspense } from "react";

import { requireUser } from "@/lib/auth";

import { AuthCard } from "../auth-card";
import { ResetPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Nova senha" };

/** Aberta pelo link do e-mail de recuperação, que já cria a sessão. */
export default function ResetPasswordPage() {
  return (
    <AuthCard title="Criar nova senha">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <ResetForUser />
      </Suspense>
    </AuthCard>
  );
}

async function ResetForUser() {
  const user = await requireUser();
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{user.email}</p>
      <ResetPasswordForm />
    </div>
  );
}
