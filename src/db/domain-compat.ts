/**
 * Checagem em tempo de compilação: as linhas do banco (Drizzle) precisam
 * caber nos tipos do domínio. Se uma coluna mudar de tipo/nome em
 * `schema.ts`, o `npm run typecheck` falha aqui. Não gera código.
 */
import type { RecurrenceRow, TransactionRow } from "@/domain/occurrences";
import type { CategoryInfo } from "@/domain/summary";

import type { Category, Recurrence, Transaction } from "./schema";

type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;

export type RecurrenceFitsDomain = Assert<Extends<Recurrence, RecurrenceRow>>;
export type TransactionFitsDomain = Assert<Extends<Transaction, TransactionRow>>;
export type CategoryFitsDomain = Assert<Extends<Category, CategoryInfo>>;
