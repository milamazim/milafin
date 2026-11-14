"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string; email?: string } | undefined;

const email = z.email("Informe um e-mail válido.").trim().toLowerCase();
const password = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .regex(/[A-Za-z]/, "A senha precisa ter pelo menos uma letra.")
  .regex(/\d/, "A senha precisa ter pelo menos um número.");

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Dados inválidos.";

/** Traduz os erros mais comuns do Supabase Auth. */
function authError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com este e-mail.";
    case "weak_password":
      return "Senha fraca: use pelo menos 8 caracteres, com letras e números.";
    case "same_password":
      return "A nova senha precisa ser diferente da atual.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    default:
      return fallback;
  }
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Informe a senha.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: firstIssue(parsed.error), email: String(formData.get("email") ?? "") };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authError(error.code, "Não foi possível entrar."), email: parsed.data.email };

  redirect(safeNext(formData.get("next")));
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "As senhas não conferem." })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });
  if (!parsed.success) return { error: firstIssue(parsed.error), email: String(formData.get("email") ?? "") };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: authError(error.code, "Não foi possível criar a conta."), email: parsed.data.email };

  // Com confirmação de e-mail desligada, o Supabase já devolve a sessão.
  if (data.session) redirect("/");

  return {
    message: `Enviamos um link de confirmação para ${parsed.data.email}. Abra o e-mail para ativar sua conta.`,
  };
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data);
  if (error && error.code?.startsWith("over_")) {
    return { error: authError(error.code, ""), email: parsed.data };
  }

  // Mesma resposta exista ou não a conta, para não revelar e-mails cadastrados.
  return {
    message: `Se houver uma conta para ${parsed.data}, você receberá um link para criar uma nova senha.`,
  };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "As senhas não conferem." })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authError(error.code, "Não foi possível alterar a senha. Peça um novo link.") };

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
