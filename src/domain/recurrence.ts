/**
 * Séries recorrentes (B6): a série é uma REGRA, não cópias mês a mês.
 * As datas são calculadas a partir de `startDate` + `frequency`:
 * - semanal: a cada 7 dias a partir do início;
 * - mensal/bimestral/…/anual: a cada N meses, no dia de `startDate`
 *   (dia de vencimento), ajustado ao fim do mês quando não existe.
 *   O ajuste não "contamina" os meses seguintes: dia 31 → 28/fev → 31/mar.
 *
 * "Agendada" = gerada pela regra (dentro de início/fim), mesmo se excluída.
 * "Ocorrência" = agendada e não excluída.
 */
import { addDays, addMonthsClamped, diffDays, monthIndex, parseISO, type ISODate } from "./dates";
import { DomainError } from "./errors";

export const FREQUENCIES = ["semanal", "mensal", "bimestral", "trimestral", "semestral", "anual"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

/** Passo em meses de cada frequência (semanal é tratada à parte). */
const MONTH_STEP: Record<Exclude<Frequency, "semanal">, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Passo em meses da frequência, ou `null` para semanal. */
export function monthStepOf(frequency: Frequency): number | null {
  return frequency === "semanal" ? null : MONTH_STEP[frequency];
}

export interface RecurrenceRule {
  frequency: Frequency;
  startDate: ISODate;
  /** `null` = sem fim */
  endDate: ISODate | null;
  excludedDates: readonly ISODate[];
}

/** Limite de segurança contra laços enormes (≈ 190 anos semanais). */
const MAX_ITERATIONS = 10_000;

export function validateRule(rule: RecurrenceRule): void {
  parseISO(rule.startDate);
  if (rule.endDate !== null) {
    parseISO(rule.endDate);
    if (rule.endDate < rule.startDate) {
      throw new DomainError("A data final da série não pode ser anterior à inicial.");
    }
  }
  if (!FREQUENCIES.includes(rule.frequency)) {
    throw new DomainError(`Frequência inválida: ${rule.frequency}`);
  }
}

/** k-ésima data agendada (k ≥ 0), ignorando fim e exclusões. */
export function nthDate(rule: Pick<RecurrenceRule, "frequency" | "startDate">, k: number): ISODate {
  if (rule.frequency === "semanal") return addDays(rule.startDate, 7 * k);
  return addMonthsClamped(rule.startDate, k * MONTH_STEP[rule.frequency]);
}

/** Menor k tal que `nthDate(k) >= date`. */
export function indexOnOrAfter(rule: Pick<RecurrenceRule, "frequency" | "startDate">, date: ISODate): number {
  if (date <= rule.startDate) return 0;
  if (rule.frequency === "semanal") return Math.ceil(diffDays(rule.startDate, date) / 7);
  const step = MONTH_STEP[rule.frequency];
  let k = Math.max(0, Math.floor((monthIndex(date) - monthIndex(rule.startDate)) / step));
  while (nthDate(rule, k) < date) k++;
  return k;
}

const withinEnd = (rule: RecurrenceRule, date: ISODate) => rule.endDate === null || date <= rule.endDate;

/** Datas agendadas em [from, to] (inclusive), sem descontar exclusões. */
export function scheduledDates(rule: RecurrenceRule, from: ISODate, to: ISODate): ISODate[] {
  if (from > to) return [];
  const out: ISODate[] = [];
  for (let k = indexOnOrAfter(rule, from), i = 0; i < MAX_ITERATIONS; k++, i++) {
    const date = nthDate(rule, k);
    if (date > to || !withinEnd(rule, date)) break;
    out.push(date);
  }
  return out;
}

/** Ocorrências em [from, to]: agendadas e não excluídas. */
export function occurrenceDates(rule: RecurrenceRule, from: ISODate, to: ISODate): ISODate[] {
  const excluded = new Set(rule.excludedDates);
  return scheduledDates(rule, from, to).filter((d) => !excluded.has(d));
}

/** A data é gerada pela regra (dentro de início/fim)? Ignora exclusões. */
export function isScheduled(rule: RecurrenceRule, date: ISODate): boolean {
  if (date < rule.startDate || !withinEnd(rule, date)) return false;
  return nthDate(rule, indexOnOrAfter(rule, date)) === date;
}

/** A data é uma ocorrência ativa (agendada e não excluída)? */
export function isOccurrence(rule: RecurrenceRule, date: ISODate): boolean {
  return isScheduled(rule, date) && !rule.excludedDates.includes(date);
}

/** Posição (k) de uma data agendada, ou `null` se não for agendada. */
export function indexOf(rule: RecurrenceRule, date: ISODate): number | null {
  return isScheduled(rule, date) ? indexOnOrAfter(rule, date) : null;
}

/** Última data agendada da série, ou `null` se ela não tem fim. */
export function lastScheduledDate(rule: RecurrenceRule): ISODate | null {
  if (rule.endDate === null) return null;
  const k = indexOnOrAfter(rule, rule.endDate);
  return nthDate(rule, nthDate(rule, k) === rule.endDate ? k : k - 1);
}
