/**
 * Dinheiro é sempre inteiro em centavos (B8: só BRL). Conversão para reais
 * só na exibição — evita erros como 0,1 + 0,2 ≠ 0,3.
 */

/**
 * Converte texto digitado em centavos. Aceita `1.234,56`, `1234,56`,
 * `1234.56`, `1.234` (milhar) e `R$ 50`. Retorna `null` se inválido.
 * Não valida o sinal: quem chama decide se zero é aceito.
 */
export function parseBRL(input: string | null | undefined): number | null {
  let s = String(input ?? "")
    .trim()
    .replace(/^R\$/i, "")
    .replace(/\s/g, "");
  if (!s) return null;

  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, frac = ""] = s.split(".");
  const cents = Number(int) * 100 + Number((frac + "00").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 123456 → "R$ 1.234,56" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** 123456 → "1.234,56" (para preencher campos de formulário). */
export function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
