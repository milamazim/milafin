/**
 * Valida o destino pós-login (`?next=`): só caminhos internos, para evitar
 * open redirect (ex.: `//site-malicioso.com`).
 */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/") {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}
