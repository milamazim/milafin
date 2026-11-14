/** Tela inicial do app (E1). Redirecionamentos internos vão direto para cá. */
export const HOME = "/lancamentos";

/**
 * Valida o destino pós-login (`?next=`): só caminhos internos, para evitar
 * open redirect (ex.: `//site-malicioso.com`). A raiz `/` vira {@link HOME}.
 */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = HOME) {
  const s = typeof value === "string" ? value : "";
  if (s === "/") return HOME;
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}
