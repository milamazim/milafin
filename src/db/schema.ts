/**
 * Schema do banco (Postgres/Supabase) — fonte da verdade para as migrações.
 * Depois de alterar este arquivo: `npm run db:generate` e `npm run db:reset`.
 *
 * Convenções:
 * - Valores em centavos inteiros (`*_cents`), sempre > 0. Só BRL (B8).
 * - Datas de lançamento como `date` (dia/mês/ano, sem fuso) (B7).
 * - Todo registro tem `user_id`; RLS garante que cada usuário só vê os seus (A3).
 *   O servidor (Drizzle) conecta com um papel privilegiado e também filtra por
 *   `user_id` — a RLS é a segunda camada de segurança (F3).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

/* ---------------------------------------------------------------- enums */

/** Natureza da categoria: define se soma ou subtrai do saldo (B1). */
export const categoryKind = pgEnum("category_kind", ["receita", "despesa"]);

/** Frequências de recorrência (B6). */
export const recurrenceFrequency = pgEnum("recurrence_frequency", [
  "semanal",
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
]);

/* -------------------------------------------------------------- helpers */

const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" });

const cents = (name: string) => bigint(name, { mode: "number" });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Política única: o usuário autenticado só lê/escreve as próprias linhas. */
const ownerPolicy = (table: string, col: AnyPgColumn) =>
  pgPolicy(`${table}_owner`, {
    as: "permissive",
    for: "all",
    to: authenticatedRole,
    using: sql`${col} = ${authUid}`,
    withCheck: sql`${col} = ${authUid}`,
  });

/* ----------------------------------------------------------- categories */

/**
 * Categorias e subcategorias (B1), em dois níveis:
 * - categoria: `parent_id` nulo (ex.: Moradia);
 * - subcategoria: `parent_id` aponta para a categoria (ex.: Aluguel). Ela
 *   substitui o "item" do protótipo e é a linha da grade anual.
 * A subcategoria herda a natureza (`kind`) da categoria — validado na aplicação.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    kind: categoryKind("kind").notNull(),
    /** Limite mensal simples (C2). Nulo = sem orçamento. */
    monthlyLimitCents: cents("monthly_limit_cents"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Arquivada: some dos cadastros, mas mantém o histórico. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }).onDelete("restrict"),
    uniqueIndex("categories_user_parent_name_uq").on(
      t.userId,
      sql`coalesce(${t.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`lower(${t.name})`,
    ),
    index("categories_user_idx").on(t.userId),
    check("categories_name_not_blank", sql`btrim(${t.name}) <> ''`),
    check("categories_not_self_parent", sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
    check(
      "categories_limit_positive",
      sql`${t.monthlyLimitCents} is null or ${t.monthlyLimitCents} > 0`,
    ),
    ownerPolicy("categories", t.userId),
  ],
);

/* ---------------------------------------------------------- recurrences */

/**
 * Série recorrente (B6): uma REGRA, não cópias mês a mês.
 * As ocorrências são calculadas a partir de `start_date` + `frequency`; o dia
 * de `start_date` é o dia de vencimento (ajustado ao fim do mês quando preciso).
 * - `end_date` nulo = sem fim.
 * - `excluded_dates`: ocorrências excluídas ("excluir só esta").
 * - Uma ocorrência editada isoladamente vira uma linha em `transactions`
 *   apontando para a série (ver `recurrence_date`).
 * - "Deste em diante" divide a série: esta termina antes, outra começa ali.
 */
export const recurrences = pgTable(
  "recurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    amountCents: cents("amount_cents").notNull(),
    frequency: recurrenceFrequency("frequency").notNull().default("mensal"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    excludedDates: date("excluded_dates", { mode: "string" })
      .array()
      .notNull()
      .default(sql`'{}'::date[]`),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("recurrences_user_idx").on(t.userId),
    check("recurrences_amount_positive", sql`${t.amountCents} > 0`),
    check("recurrences_end_after_start", sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
    ownerPolicy("recurrences", t.userId),
  ],
);

/* --------------------------------------------------------- transactions */

/**
 * Lançamentos (avulsos ou ocorrências materializadas de uma série).
 * - `paid`: status pago/recebido (B2).
 * - `note`: observação livre (C4).
 * - Se `recurrence_id` estiver preenchido, a linha SUBSTITUI a ocorrência da
 *   série na data original `recurrence_date` (ex.: valor diferente só naquele
 *   mês, ou a ocorrência marcada como paga).
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    amountCents: cents("amount_cents").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    paid: boolean("paid").notNull().default(false),
    note: text("note"),
    recurrenceId: uuid("recurrence_id").references(() => recurrences.id, {
      onDelete: "cascade",
    }),
    recurrenceDate: date("recurrence_date", { mode: "string" }),
    ...timestamps,
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.date),
    index("transactions_category_idx").on(t.categoryId),
    uniqueIndex("transactions_recurrence_occurrence_uq").on(t.recurrenceId, t.recurrenceDate),
    check("transactions_amount_positive", sql`${t.amountCents} > 0`),
    check(
      "transactions_recurrence_pair",
      sql`(${t.recurrenceId} is null) = (${t.recurrenceDate} is null)`,
    ),
    ownerPolicy("transactions", t.userId),
  ],
);

/* ---------------------------------------------------------------- types */

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Recurrence = typeof recurrences.$inferSelect;
export type NewRecurrence = typeof recurrences.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
