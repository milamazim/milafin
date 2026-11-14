"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  type FormState,
} from "./actions";

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Input> & { name: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} required {...props} />
    </div>
  );
}

function Feedback({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state?.message)
    return (
      <p role="status" className="rounded-md bg-muted p-3 text-sm">
        {state.message}
      </p>
    );
  return null;
}

const passwordHint = "Mínimo de 8 caracteres, com letras e números.";

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field label="E-mail" name="email" type="email" autoComplete="email" defaultValue={state?.email} />
      <Field label="Senha" name="password" type="password" autoComplete="current-password" />
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/esqueci-senha" className="text-muted-foreground hover:underline">
          Esqueci minha senha
        </Link>
        <Link href="/cadastro" className="hover:underline">
          Criar conta
        </Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, undefined);
  if (state?.message) return <Feedback state={state} />;
  return (
    <form action={action} className="grid gap-4">
      <Field label="E-mail" name="email" type="email" autoComplete="email" defaultValue={state?.email} />
      <Field label="Senha" name="password" type="password" autoComplete="new-password" minLength={8} />
      <Field label="Confirme a senha" name="confirm" type="password" autoComplete="new-password" />
      <p className="text-xs text-muted-foreground">{passwordHint}</p>
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Criando conta…" : "Criar conta"}
      </Button>
      <p className="text-center text-sm">
        Já tem conta?{" "}
        <Link href="/entrar" className="hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="grid gap-4">
      {!state?.message && (
        <>
          <Field label="E-mail" name="email" type="email" autoComplete="email" defaultValue={state?.email} />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Enviando…" : "Enviar link"}
          </Button>
        </>
      )}
      <Feedback state={state} />
      <Link href="/entrar" className="text-center text-sm hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field label="Nova senha" name="password" type="password" autoComplete="new-password" minLength={8} />
      <Field label="Confirme a nova senha" name="confirm" type="password" autoComplete="new-password" />
      <p className="text-xs text-muted-foreground">{passwordHint}</p>
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
