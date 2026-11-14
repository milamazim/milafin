import "server-only";

import { DomainError } from "@/domain/errors";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

/** Código de erro do Postgres, mesmo quando o Drizzle embrulha o erro original. */
export function pgCode(e: unknown): string | undefined {
  for (let cur: unknown = e, i = 0; cur && i < 5; cur = (cur as { cause?: unknown }).cause, i++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

/**
 * Executa a ação e converte erros esperados em mensagem para o usuário.
 * Erros inesperados são registrados no servidor e viram mensagem genérica.
 */
export async function run<T>(
  fn: () => Promise<T>,
  messages: Partial<Record<"unique" | "foreignKey" | "check", string>> = {},
): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof DomainError) return fail(e.message);
    // redirect()/notFound() do Next precisam continuar propagando
    if (e instanceof Error && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    switch (pgCode(e)) {
      case "23505":
        return fail(messages.unique ?? "Já existe um registro igual.");
      case "23503":
        return fail(messages.foreignKey ?? "Este registro está em uso.");
      case "23514":
        return fail(messages.check ?? "Dados inválidos.");
    }
    console.error(e);
    return fail("Não foi possível salvar. Tente novamente.");
  }
}
