/**
 * Edição e exclusão de uma ocorrência de série (B6).
 *
 * As funções aqui não gravam nada: devolvem um PLANO (lista ordenada de
 * operações) que a camada de dados executa numa única transação, NA ORDEM.
 * A ordem importa (ex.: reapontar substituições antes de apagar a série
 * antiga, cujo `ON DELETE CASCADE` as levaria junto).
 *
 * Alcances:
 * - "este" (PADRÃO): só esta ocorrência muda — vira uma substituição.
 * - "deste-em-diante": a série é dividida. A antiga termina antes desta data
 *   e uma nova começa com os novos dados. O passado não muda (ex.: reajuste
 *   do aluguel). Permite mudar a frequência.
 * - "toda": muda a série inteira, inclusive o passado. Mudar a data move o
 *   vencimento de todas as ocorrências.
 *
 * Substituições (ocorrências editadas isoladamente) são escolhas explícitas
 * do usuário e são preservadas: nunca recebem os novos valores da série.
 */
import {
  addDays,
  addMonthsClamped,
  isValidISODate,
  parseISO,
  type ISODate,
} from "./dates";
import { DomainError } from "./errors";
import type { RecurrenceRow, TransactionRow } from "./occurrences";
import {
  indexOf,
  isOccurrence,
  isScheduled,
  lastScheduledDate,
  monthStepOf,
  nthDate,
  occurrenceDates,
  validateRule,
  type Frequency,
  type RecurrenceRule,
} from "./recurrence";

export type EditScope = "este" | "deste-em-diante" | "toda";

export const DEFAULT_EDIT_SCOPE: EditScope = "este";

export const EDIT_SCOPE_LABEL: Record<EditScope, string> = {
  este: "Só este lançamento",
  "deste-em-diante": "Deste em diante",
  toda: "Toda a série",
};

/** Novos dados digitados no formulário da ocorrência. */
export interface OccurrenceEdit {
  categoryId: string;
  amountCents: number;
  /** Nova data desta ocorrência. */
  date: ISODate;
  paid: boolean;
  note: string | null;
  /** Só em "deste em diante": nova frequência a partir daqui. */
  frequency?: Frequency;
}

type TxValues = Omit<TransactionRow, "id">;

export type SeriesOp =
  | { type: "createRecurrence"; values: RecurrenceRow }
  | { type: "updateRecurrence"; id: string; patch: Partial<Omit<RecurrenceRow, "id">> }
  | { type: "deleteRecurrence"; id: string }
  /** Cria ou substitui a linha única de (recurrenceId, recurrenceDate). */
  | { type: "upsertOverride"; values: TxValues & { recurrenceId: string; recurrenceDate: ISODate } }
  | { type: "updateTransaction"; id: string; patch: Partial<TxValues> }
  | { type: "deleteTransaction"; id: string };

interface Target {
  series: RecurrenceRow;
  /** Todas as substituições desta série (transactions com recurrenceId = série). */
  overrides: readonly TransactionRow[];
  /** Data original da ocorrência na série. */
  recurrenceDate: ISODate;
}

/* ------------------------------------------------------------- validação */

function validateTarget({ series, overrides, recurrenceDate }: Target) {
  if (!isOccurrence(series, recurrenceDate)) {
    throw new DomainError("Esta ocorrência não existe mais na série. Recarregue a tela.");
  }
  if (overrides.some((o) => o.recurrenceId !== series.id)) {
    throw new DomainError("Substituição de outra série recebida por engano.");
  }
}

function validateEdit(edit: OccurrenceEdit) {
  if (!Number.isSafeInteger(edit.amountCents) || edit.amountCents <= 0) {
    throw new DomainError("O valor precisa ser maior que zero.");
  }
  if (!isValidISODate(edit.date)) throw new DomainError("Data inválida.");
}

const overrideAt = (overrides: readonly TransactionRow[], date: ISODate) =>
  overrides.find((o) => o.recurrenceDate === date);

const overrideValues = (seriesId: string, recurrenceDate: ISODate, edit: OccurrenceEdit) => ({
  recurrenceId: seriesId,
  recurrenceDate,
  categoryId: edit.categoryId,
  amountCents: edit.amountCents,
  date: edit.date,
  paid: edit.paid,
  note: edit.note,
});

/* ----------------------------------------------------------------- editar */

export function planEditOccurrence(
  input: Target & { edit: OccurrenceEdit; scope: EditScope; newId?: () => string },
): SeriesOp[] {
  validateTarget(input);
  validateEdit(input.edit);
  const { scope, edit } = input;

  if (scope === "este") {
    return [{ type: "upsertOverride", values: overrideValues(input.series.id, input.recurrenceDate, edit) }];
  }

  if (scope === "deste-em-diante") {
    return planSplit(input, input.newId ?? (() => crypto.randomUUID()));
  }

  if (edit.frequency && edit.frequency !== input.series.frequency) {
    throw new DomainError("Para mudar a frequência, edite “deste em diante”.");
  }
  return edit.date === input.recurrenceDate ? planUpdateAll(input) : planReschedule(input);
}

/** "toda", mesma data: muda os dados da série; o pago vale para esta ocorrência. */
function planUpdateAll({ series, overrides, recurrenceDate, edit }: Target & { edit: OccurrenceEdit }): SeriesOp[] {
  const ops: SeriesOp[] = [
    {
      type: "updateRecurrence",
      id: series.id,
      patch: { categoryId: edit.categoryId, amountCents: edit.amountCents, note: edit.note },
    },
  ];
  const existing = overrideAt(overrides, recurrenceDate);
  if (edit.paid) ops.push({ type: "upsertOverride", values: overrideValues(series.id, recurrenceDate, edit) });
  else if (existing) ops.push({ type: "deleteTransaction", id: existing.id });
  return ops;
}

/**
 * "toda", data diferente: desloca o vencimento da série inteira. A k-ésima
 * ocorrência continua sendo a k-ésima (exclusões, substituições e o fim
 * acompanham pela posição).
 */
function planReschedule({ series, overrides, recurrenceDate, edit }: Target & { edit: OccurrenceEdit }): SeriesOp[] {
  const k = indexOf(series, recurrenceDate)!;
  const step = monthStepOf(series.frequency);
  const newStart =
    step === null ? addDays(edit.date, -7 * k) : addMonthsClamped(edit.date, -k * step, parseISO(edit.date).d);
  const moved: RecurrenceRule = { ...series, startDate: newStart };
  if (nthDate(moved, k) !== edit.date) {
    throw new DomainError(
      "Não dá para mover toda a série para esse dia: o primeiro mês dela não tem esse dia. Use “deste em diante”.",
    );
  }
  const remap = (d: ISODate) => {
    const i = indexOf(series, d);
    return i === null ? null : nthDate(moved, i);
  };

  const last = lastScheduledDate(series);
  const newEnd = last === null ? null : remap(last);
  const excludedDates = series.excludedDates.map(remap).filter((d): d is ISODate => d !== null);

  const ops: SeriesOp[] = [];
  const existing = overrideAt(overrides, recurrenceDate);
  if (existing) ops.push({ type: "deleteTransaction", id: existing.id });

  ops.push({
    type: "updateRecurrence",
    id: series.id,
    patch: {
      startDate: newStart,
      endDate: newEnd,
      excludedDates,
      categoryId: edit.categoryId,
      amountCents: edit.amountCents,
      note: edit.note,
    },
  });

  // Reaponta as substituições. Ordem evita colisão na chave única
  // (recurrence_id, recurrence_date): adiantando, das últimas para as primeiras.
  const forward = edit.date > recurrenceDate;
  const others = overrides
    .filter((o) => o !== existing && o.recurrenceDate !== null && remap(o.recurrenceDate) !== null)
    .sort((a, b) => (a.recurrenceDate! < b.recurrenceDate! ? -1 : 1));
  if (forward) others.reverse();
  for (const o of others) {
    const newRd = remap(o.recurrenceDate!)!;
    const patch: Partial<TxValues> = { recurrenceDate: newRd };
    if (o.date === o.recurrenceDate) patch.date = newRd; // não tinha sido movida: acompanha
    ops.push({ type: "updateTransaction", id: o.id, patch });
  }

  if (edit.paid) ops.push({ type: "upsertOverride", values: overrideValues(series.id, edit.date, edit) });
  return ops;
}

/** "deste em diante": divide a série nesta ocorrência. */
function planSplit(
  { series, overrides, recurrenceDate, edit }: Target & { edit: OccurrenceEdit },
  newId: () => string,
): SeriesOp[] {
  const k = indexOf(series, recurrenceDate)!;
  if (k > 0 && edit.date <= nthDate(series, k - 1)) {
    throw new DomainError("A nova data precisa ser depois da ocorrência anterior da série.");
  }

  const id = newId();
  const rule: RecurrenceRule = {
    frequency: edit.frequency ?? series.frequency,
    startDate: edit.date,
    endDate: series.endDate === null ? null : series.endDate >= edit.date ? series.endDate : edit.date,
    excludedDates: [],
  };
  validateRule(rule);
  rule.excludedDates = series.excludedDates.filter((d) => d > recurrenceDate && isScheduled(rule, d));

  const ops: SeriesOp[] = [];
  const existing = overrideAt(overrides, recurrenceDate);
  if (existing) ops.push({ type: "deleteTransaction", id: existing.id });

  ops.push({
    type: "createRecurrence",
    values: { id, ...rule, categoryId: edit.categoryId, amountCents: edit.amountCents, note: edit.note },
  });

  // Substituições futuras passam para a série nova; se a data não existir
  // mais nela, viram lançamentos avulsos (nada se perde).
  for (const o of overrides) {
    if (o === existing || o.recurrenceDate === null || o.recurrenceDate <= recurrenceDate) continue;
    ops.push(
      isScheduled(rule, o.recurrenceDate)
        ? { type: "updateTransaction", id: o.id, patch: { recurrenceId: id } }
        : { type: "updateTransaction", id: o.id, patch: { recurrenceId: null, recurrenceDate: null } },
    );
  }

  ops.push(
    k === 0
      ? { type: "deleteRecurrence", id: series.id }
      : {
          type: "updateRecurrence",
          id: series.id,
          patch: {
            endDate: addDays(recurrenceDate, -1),
            excludedDates: series.excludedDates.filter((d) => d < recurrenceDate),
          },
        },
  );

  if (edit.paid) ops.push({ type: "upsertOverride", values: overrideValues(id, edit.date, edit) });
  return ops;
}

/* ------------------------------------------- marcar anteriores como pagas */

/**
 * Marca como pagas todas as ocorrências da série com data efetiva ANTERIOR a
 * `before` (normalmente hoje) que ainda não estão pagas. Útil ao começar a
 * usar o app com séries que vêm do passado.
 * - ocorrência calculada → vira substituição com os valores da série + pago;
 * - ocorrência editada não paga → só recebe `paid: true` (valores mantidos);
 * - exclusões, ocorrências já pagas e as movidas para hoje ou depois ficam
 *   como estão.
 */
export function planMarkPaidBefore(input: {
  series: RecurrenceRow;
  overrides: readonly TransactionRow[];
  before: ISODate;
}): SeriesOp[] {
  const { series, overrides, before } = input;
  if (!isValidISODate(before)) throw new DomainError("Data inválida.");
  if (overrides.some((o) => o.recurrenceId !== series.id)) {
    throw new DomainError("Substituição de outra série recebida por engano.");
  }
  const ops: SeriesOp[] = [];

  // ocorrências editadas (podem ter sido movidas de data)
  for (const o of overrides) {
    if (!o.paid && o.date < before) ops.push({ type: "updateTransaction", id: o.id, patch: { paid: true } });
  }

  // ocorrências calculadas sem substituição
  if (before > series.startDate) {
    const overridden = new Set(overrides.map((o) => o.recurrenceDate));
    for (const date of occurrenceDates(series, series.startDate, addDays(before, -1))) {
      if (overridden.has(date)) continue;
      ops.push({
        type: "upsertOverride",
        values: {
          recurrenceId: series.id,
          recurrenceDate: date,
          categoryId: series.categoryId,
          amountCents: series.amountCents,
          date,
          paid: true,
          note: series.note,
        },
      });
    }
  }
  return ops;
}

/* ---------------------------------------------------------------- excluir */

export function planDeleteOccurrence(input: Target & { scope: EditScope }): SeriesOp[] {
  validateTarget(input);
  const { series, overrides, recurrenceDate, scope } = input;

  if (scope === "toda" || (scope === "deste-em-diante" && recurrenceDate === series.startDate)) {
    return [{ type: "deleteRecurrence", id: series.id }];
  }

  if (scope === "este") {
    const ops: SeriesOp[] = [];
    const existing = overrideAt(overrides, recurrenceDate);
    if (existing) ops.push({ type: "deleteTransaction", id: existing.id });
    ops.push({
      type: "updateRecurrence",
      id: series.id,
      patch: { excludedDates: [...new Set([...series.excludedDates, recurrenceDate])].sort() },
    });
    return ops;
  }

  // deste em diante
  return [
    ...overrides
      .filter((o) => o.recurrenceDate !== null && o.recurrenceDate >= recurrenceDate)
      .map((o): SeriesOp => ({ type: "deleteTransaction", id: o.id })),
    {
      type: "updateRecurrence",
      id: series.id,
      patch: {
        endDate: addDays(recurrenceDate, -1),
        excludedDates: series.excludedDates.filter((d) => d < recurrenceDate),
      },
    },
  ];
}
