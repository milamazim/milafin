import { parseISO, type ISODate } from "@/domain/dates";
import { FREQUENCY_LABEL, type Frequency } from "@/domain/recurrence";

export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const num = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123456 → "1.234,56" (sem "R$", para a grade). */
export const formatNumber = (cents: number) => num.format(cents / 100);

const whole = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** 123456 → "1.235" (reais inteiros, arredondados; visão compacta da grade). */
export const formatWhole = (cents: number) => whole.format(Math.round(cents / 100));

/** "2026-03-05" → "05/03/2026" */
export function formatDate(iso: ISODate): string {
  const { y, m, d } = parseISO(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** "2026-03-05" → "qui, 05/03" */
export function formatDayShort(iso: ISODate): string {
  const { y, m, d } = parseISO(iso);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()].slice(0, 3);
  return `${wd}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Descrição da regra: "Mensal, todo dia 10, desde 10/01/2026, até 10/12/2026". */
export function describeRule(rule: { frequency: Frequency; startDate: ISODate; endDate: ISODate | null }): string {
  const { y, m, d } = parseISO(rule.startDate);
  const when =
    rule.frequency === "semanal"
      ? `toda ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`
      : rule.frequency === "anual"
        ? `todo dia ${d} de ${MONTHS[m - 1].toLowerCase()}`
        : `todo dia ${d}`;
  const end = rule.endDate ? `, até ${formatDate(rule.endDate)}` : ", sem fim";
  return `${FREQUENCY_LABEL[rule.frequency]}, ${when}, desde ${formatDate(rule.startDate)}${end}`;
}

/** Data de hoje no fuso do Brasil (o app é só BRL; evita virar o dia às 21h no UTC). */
export function todayISO(timeZone = "America/Sao_Paulo"): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
