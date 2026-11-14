/**
 * Datas de calendário (B7) como texto ISO `YYYY-MM-DD`, sem hora nem fuso:
 * é o formato da coluna `date` do Postgres. Texto ISO ordena corretamente
 * com `<`/`>`, então comparações não precisam converter.
 * Meses nesta API são 1–12 (como no texto ISO), exceto onde indicado.
 */
import { DomainError } from "./errors";

export type ISODate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export interface YMD {
  y: number;
  /** 1–12 */
  m: number;
  d: number;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== "string") return false;
  const match = ISO_RE.exec(s);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function parseISO(iso: ISODate): YMD {
  if (!isValidISODate(iso)) throw new DomainError(`Data inválida: ${iso}`);
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function toISO(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toUTC(iso: ISODate): number {
  const { y, m, d } = parseISO(iso);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromUTC(toUTC(iso) + n * DAY_MS);
}

/** Dias de `a` até `b` (positivo se `b` vem depois). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** Índice absoluto do mês (`ano*12 + mês0`), como no protótipo. */
export function monthIndex(iso: ISODate): number {
  const { y, m } = parseISO(iso);
  return y * 12 + (m - 1);
}

/**
 * Soma `n` meses mantendo o dia de vencimento `dueDay`, ajustado ao último
 * dia do mês quando ele não existe (31 → 28/29 em fevereiro, 30 em abril…).
 */
export function addMonthsClamped(iso: ISODate, n: number, dueDay = parseISO(iso).d): ISODate {
  const idx = monthIndex(iso) + n;
  const y = Math.floor(idx / 12);
  const m = idx - y * 12 + 1;
  return toISO(y, m, Math.min(dueDay, daysInMonth(y, m)));
}

/** Ano da data. */
export function yearOf(iso: ISODate): number {
  return parseISO(iso).y;
}

/** Mês da data, 0–11 (índice de coluna da grade anual). */
export function month0Of(iso: ISODate): number {
  return parseISO(iso).m - 1;
}

export function yearRange(year: number): { from: ISODate; to: ISODate } {
  return { from: toISO(year, 1, 1), to: toISO(year, 12, 31) };
}

/** Primeiro e último dia do mês (`month0` 0–11). */
export function monthRange(year: number, month0: number): { from: ISODate; to: ISODate } {
  const m = month0 + 1;
  return { from: toISO(year, m, 1), to: toISO(year, m, daysInMonth(year, m)) };
}
