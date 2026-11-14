/**
 * Backup completo em JSON (D2): exportar, validar e planejar a restauração.
 * Funções puras (rodam no servidor e no navegador, para a prévia).
 *
 * Formato (versão 1):
 *   { app: "milafin", version: 1, exportedAt, counts, data: { categories, recurrences, transactions } }
 * Não contém `user_id`: o backup pertence a quem o restaura.
 */
import { z } from "zod";

import { isValidISODate } from "@/domain/dates";
import { FREQUENCIES } from "@/domain/recurrence";

export const BACKUP_APP = "milafin";
export const BACKUP_VERSION = 1;

const isoDate = z.string().refine(isValidISODate, "data inválida");
const cents = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const note = z.string().max(500).nullable();

const categorySchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["receita", "despesa"]),
  monthlyLimitCents: cents.nullable(),
  sortOrder: z.number().int().default(0),
  archivedAt: z.iso.datetime({ offset: true }).nullable(),
});

const recurrenceSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  amountCents: cents,
  frequency: z.enum(FREQUENCIES),
  startDate: isoDate,
  endDate: isoDate.nullable(),
  excludedDates: z.array(isoDate),
  note,
});

const transactionSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  amountCents: cents,
  date: isoDate,
  paid: z.boolean(),
  note,
  recurrenceId: z.uuid().nullable(),
  recurrenceDate: isoDate.nullable(),
});

const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  data: z.object({
    categories: z.array(categorySchema),
    recurrences: z.array(recurrenceSchema),
    transactions: z.array(transactionSchema),
  }),
});

export type BackupCategory = z.infer<typeof categorySchema>;
export type BackupRecurrence = z.infer<typeof recurrenceSchema>;
export type BackupTransaction = z.infer<typeof transactionSchema>;
export type Backup = z.infer<typeof backupSchema>;

/* ------------------------------------------------------------- exportar */

export function buildBackup(data: Backup["data"], exportedAt = new Date().toISOString()) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt,
    counts: {
      categories: data.categories.length,
      recurrences: data.recurrences.length,
      transactions: data.transactions.length,
    },
    data,
  } satisfies Backup & { counts: unknown };
}

/* ------------------------------------------------------------- validar */

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Lê e valida o arquivo: formato, tipos e integridade das referências. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "O arquivo não é um JSON válido." };
  }
  const r = raw as { app?: unknown; version?: unknown } | unknown[];
  if (Array.isArray(r) || (r && typeof r === "object" && (r as { app?: unknown }).app === "controle_financeiro")) {
    return {
      ok: false,
      error: "Este arquivo é um backup do protótipo antigo (HTML). A versão nova não importa esse formato.",
    };
  }
  if (!r || typeof r !== "object" || (r as { app?: unknown }).app !== BACKUP_APP) {
    return { ok: false, error: "Este arquivo não é um backup do milafin." };
  }
  if ((r as { version?: unknown }).version !== BACKUP_VERSION) {
    return { ok: false, error: "Versão de backup não suportada. Atualize o app e tente de novo." };
  }

  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Backup inválido em ${issue.path.join(".")}: ${issue.message}` };
  }
  const integrity = checkIntegrity(parsed.data.data);
  return integrity ? { ok: false, error: `Backup inconsistente: ${integrity}` } : { ok: true, backup: parsed.data };
}

function checkIntegrity({ categories, recurrences, transactions }: Backup["data"]): string | null {
  const dupe = (ids: string[]) => ids.find((id, i) => ids.indexOf(id) !== i);
  const d = dupe([...categories, ...recurrences, ...transactions].map((x) => x.id));
  if (d) return `identificador repetido (${d}).`;

  const cats = new Map(categories.map((c) => [c.id, c]));
  const names = new Set<string>();
  for (const c of categories) {
    if (c.parentId) {
      const p = cats.get(c.parentId);
      if (!p) return `a subcategoria “${c.name}” aponta para uma categoria que não está no arquivo.`;
      if (p.parentId) return `“${c.name}” está em mais de dois níveis.`;
      if (p.kind !== c.kind) return `“${c.name}” tem natureza diferente da categoria “${p.name}”.`;
    }
    const key = `${c.parentId ?? ""}|${c.name.toLocaleLowerCase("pt-BR")}`;
    if (names.has(key)) return `categoria repetida “${c.name}”.`;
    names.add(key);
  }

  const recs = new Map(recurrences.map((r) => [r.id, r]));
  for (const r of recurrences) {
    if (!cats.has(r.categoryId)) return "uma série aponta para uma categoria que não está no arquivo.";
    if (r.endDate !== null && r.endDate < r.startDate) return "uma série termina antes de começar.";
  }
  const occKeys = new Set<string>();
  for (const t of transactions) {
    if (!cats.has(t.categoryId)) return "um lançamento aponta para uma categoria que não está no arquivo.";
    if ((t.recurrenceId === null) !== (t.recurrenceDate === null)) return "lançamento com vínculo de série incompleto.";
    if (t.recurrenceId) {
      if (!recs.has(t.recurrenceId)) return "um lançamento aponta para uma série que não está no arquivo.";
      const k = `${t.recurrenceId}|${t.recurrenceDate}`;
      if (occKeys.has(k)) return "a mesma ocorrência de série aparece duas vezes.";
      occKeys.add(k);
    }
  }
  return null;
}

/* --------------------------------------------------- planejar restauração */

export type RestoreMode = "mesclar" | "substituir";

export interface ExistingData {
  /** categorias atuais do usuário (vazio no modo substituir) */
  categories: { id: string; parentId: string | null; name: string; kind: "receita" | "despesa" }[];
  recurrenceIds: ReadonlySet<string>;
  transactionIds: ReadonlySet<string>;
  /** "recurrenceId|recurrenceDate" das substituições atuais */
  overrideKeys: ReadonlySet<string>;
  /** ids do arquivo já usados por OUTRO usuário (precisam de id novo) */
  takenIds: ReadonlySet<string>;
}

export interface RestorePlan {
  categories: BackupCategory[];
  recurrences: BackupRecurrence[];
  transactions: BackupTransaction[];
  skipped: { categories: number; recurrences: number; transactions: number };
}

/**
 * O que inserir para restaurar `backup` sobre os dados existentes.
 * Mesclar: o que já existe (mesmo id, ou categoria de mesmo nome no mesmo
 * lugar) é aproveitado e não duplica; restaurar o mesmo arquivo duas vezes
 * não muda nada na segunda. Ids usados por outro usuário ganham id novo.
 */
export function planRestore(backup: Backup, existing: ExistingData, newId: () => string): RestorePlan {
  const { categories, recurrences, transactions } = backup.data;
  const idMap = new Map<string, string>();
  const freshId = (id: string) => (existing.takenIds.has(id) ? newId() : id);
  const skipped = { categories: 0, recurrences: 0, transactions: 0 };
  const lower = (s: string) => s.toLocaleLowerCase("pt-BR");

  // categorias: mães antes das filhas
  const outCats: BackupCategory[] = [];
  const known = [...existing.categories];
  const ordered = [...categories.filter((c) => !c.parentId), ...categories.filter((c) => c.parentId)];
  for (const c of ordered) {
    const parentId = c.parentId ? idMap.get(c.parentId)! : null;
    const sameId = known.find((k) => k.id === c.id);
    const sameName = known.find((k) => k.parentId === parentId && lower(k.name) === lower(c.name));
    if (sameId) {
      idMap.set(c.id, c.id);
      skipped.categories++;
    } else if (sameName && sameName.kind === c.kind) {
      idMap.set(c.id, sameName.id);
      skipped.categories++;
    } else {
      const id = freshId(c.id);
      // mesmo nome com natureza diferente: o índice único é por nome, então renomeia
      const name = sameName ? `${c.name} (${c.kind})`.slice(0, 60) : c.name;
      idMap.set(c.id, id);
      const row = { ...c, id, parentId, name };
      outCats.push(row);
      known.push(row);
    }
  }

  const outRecs: BackupRecurrence[] = [];
  for (const r of recurrences) {
    if (existing.recurrenceIds.has(r.id)) {
      idMap.set(r.id, r.id);
      skipped.recurrences++;
      continue;
    }
    const id = freshId(r.id);
    idMap.set(r.id, id);
    outRecs.push({ ...r, id, categoryId: idMap.get(r.categoryId)! });
  }

  const outTx: BackupTransaction[] = [];
  for (const t of transactions) {
    const recurrenceId = t.recurrenceId ? idMap.get(t.recurrenceId)! : null;
    if (
      existing.transactionIds.has(t.id) ||
      (recurrenceId && existing.overrideKeys.has(`${recurrenceId}|${t.recurrenceDate}`))
    ) {
      skipped.transactions++;
      continue;
    }
    outTx.push({ ...t, id: freshId(t.id), categoryId: idMap.get(t.categoryId)!, recurrenceId });
  }

  return { categories: outCats, recurrences: outRecs, transactions: outTx, skipped };
}
