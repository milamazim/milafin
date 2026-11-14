import type { Metadata } from "next";

import { AuthCard } from "../auth-card";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <AuthCard title="Criar conta" description="Você vai receber um e-mail para confirmar o cadastro.">
      <SignUpForm />
    </AuthCard>
  );
}
