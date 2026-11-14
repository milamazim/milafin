import type { Metadata } from "next";

import { AuthCard } from "../auth-card";
import { ForgotPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Esqueci minha senha"
      description="Informe seu e-mail e enviaremos um link para criar uma nova senha."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
