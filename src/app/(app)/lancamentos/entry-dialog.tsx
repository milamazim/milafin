"use client";

import { RepeatIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { MoneyInput } from "@/components/money-input";
import { useAction } from "@/components/use-action";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { Category } from "@/db/schema";
import { isValidISODate, type ISODate } from "@/domain/dates";
import type { Occurrence, RecurrenceRow } from "@/domain/occurrences";
import { FREQUENCIES, FREQUENCY_LABEL, type Frequency } from "@/domain/recurrence";
import { DEFAULT_EDIT_SCOPE, EDIT_SCOPE_LABEL, type EditScope } from "@/domain/series-edit";
import { categoryOptions, categoryPath } from "@/lib/category-tree";
import { describeRule, formatDate } from "@/lib/format";
import { centsToInput } from "@/lib/money";

import { createEntry, deleteOccurrence, deleteTransaction, editOccurrence, updateTransaction } from "./actions";

export type EntryDialogState =
  | { mode: "create"; date: ISODate; categoryId?: string }
  | { mode: "edit"; occurrence: Occurrence }
  | null;

const SCOPE_HELP: Record<EditScope, string> = {
  este: "Muda só esta ocorrência. A série continua igual.",
  "deste-em-diante": "Muda esta e as próximas (ex.: reajuste). As anteriores ficam como estão.",
  toda: "Muda todas as ocorrências, inclusive as passadas. Ocorrências editadas à parte são mantidas.",
};

export function EntryDialog({
  state,
  onClose,
  categories,
  recurrences,
}: {
  state: EntryDialogState;
  onClose: () => void;
  categories: Category[];
  recurrences: RecurrenceRow[];
}) {
  // mantém o último conteúdo durante a animação de fechamento (senão a caixa some vazia)
  const [shown, setShown] = useState(state);
  if (state !== null && state !== shown) setShown(state);

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        {/* key: formulário novo a cada abertura */}
        {shown && (
          <EntryForm
            key={shown.mode === "edit" ? shown.occurrence.key : `new:${shown.date}:${shown.categoryId}`}
            state={shown}
            onClose={onClose}
            categories={categories}
            recurrences={recurrences}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({
  state,
  onClose,
  categories,
  recurrences,
}: {
  state: NonNullable<EntryDialogState>;
  onClose: () => void;
  categories: Category[];
  recurrences: RecurrenceRow[];
}) {
  const occ = state.mode === "edit" ? state.occurrence : null;
  const series = occ?.recurrenceId ? recurrences.find((r) => r.id === occ.recurrenceId) : undefined;
  const { pending, exec } = useAction();

  const [categoryId, setCategoryId] = useState(occ?.categoryId ?? (state.mode === "create" ? state.categoryId : "") ?? "");
  const [amount, setAmount] = useState(occ ? centsToInput(occ.amountCents) : "");
  const [date, setDate] = useState<string>(occ?.date ?? (state.mode === "create" ? state.date : ""));
  const [paid, setPaid] = useState(occ?.paid ?? false);
  const [note, setNote] = useState(occ?.note ?? "");
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>(series?.frequency ?? "mensal");
  const [endDate, setEndDate] = useState("");
  const [scope, setScope] = useState<EditScope>(DEFAULT_EDIT_SCOPE);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteScope, setDeleteScope] = useState<EditScope>(DEFAULT_EDIT_SCOPE);

  const groups = categoryOptions(categories, occ?.categoryId);
  const kind = categories.find((c) => c.id === categoryId)?.kind;
  const paidLabel = kind === "receita" ? "Recebido" : "Pago";

  const fields = { categoryId, amount, date, paid, note };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) return void document.getElementById("entry-category")?.focus();
    let ok: boolean;
    if (!occ) {
      ok = await exec(
        () =>
          createEntry(
            recurring
              ? { ...fields, recurring: true, frequency, endDate: endDate || null }
              : { ...fields, recurring: false },
          ),
        { success: recurring ? "Série criada." : "Lançamento criado." },
      );
    } else if (occ.recurrenceId && occ.recurrenceDate) {
      ok = await exec(
        () =>
          editOccurrence({
            ...fields,
            recurrenceId: occ.recurrenceId!,
            recurrenceDate: occ.recurrenceDate!,
            scope,
            frequency: scope === "deste-em-diante" ? frequency : undefined,
          }),
        { success: "Lançamento atualizado." },
      );
    } else {
      ok = await exec(() => updateTransaction({ ...fields, id: occ.transactionId! }), { success: "Lançamento atualizado." });
    }
    if (ok) onClose();
  }

  async function remove() {
    if (!occ) return;
    const ok = occ.recurrenceId
      ? await exec(
          () => deleteOccurrence({ recurrenceId: occ.recurrenceId!, recurrenceDate: occ.recurrenceDate!, scope: deleteScope }),
          { success: "Excluído." },
        )
      : await exec(() => deleteTransaction({ id: occ.transactionId! }), { success: "Lançamento excluído." });
    if (ok) {
      setConfirmDelete(false);
      onClose();
    }
  }

  return (
    <>
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{occ ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          {series && (
            <DialogDescription className="flex items-start gap-1.5">
              <RepeatIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {describeRule(series)}
                {occ?.recurrenceDate && occ.date !== occ.recurrenceDate && (
                  <> · originalmente em {formatDate(occ.recurrenceDate)}</>
                )}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="entry-category">Categoria</Label>
          <NativeSelect
            id="entry-category"
            className="w-full"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <NativeSelectOption value="">Escolha…</NativeSelectOption>
            {groups.map((g) => (
              <NativeSelectOptGroup key={`${g.kind}:${g.label}`} label={g.label}>
                {g.options.map((o) => (
                  <NativeSelectOption key={o.id} value={o.id}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            ))}
          </NativeSelect>
          {groups.length === 0 && (
            <p className="text-xs text-muted-foreground">Cadastre categorias na aba Categorias primeiro.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="entry-amount">Valor</Label>
            <MoneyInput id="entry-amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="entry-date">{recurring ? "Primeira data" : "Data"}</Label>
            <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>

        <label className="flex w-fit items-center gap-2 text-sm">
          <Checkbox checked={paid} onCheckedChange={(v) => setPaid(Boolean(v))} />
          {paidLabel}
          {!occ && recurring && <span className="text-xs text-muted-foreground">(só a primeira ocorrência)</span>}
        </label>

        {!occ && (
          <div className="grid gap-3 rounded-lg border p-3">
            <label className="flex w-fit items-center gap-2 text-sm font-medium">
              <Checkbox checked={recurring} onCheckedChange={(v) => setRecurring(Boolean(v))} />
              Repetir (lançamento recorrente)
            </label>
            {recurring && (
              <div className="grid grid-cols-2 gap-3">
                <FrequencySelect value={frequency} onChange={setFrequency} />
                <div className="grid gap-1.5">
                  <Label htmlFor="entry-end">Termina em (opcional)</Label>
                  <Input id="entry-end" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  {isValidISODate(date)
                    ? describeRule({ frequency, startDate: date, endDate: isValidISODate(endDate) ? endDate : null })
                    : "Informe a primeira data."}
                </p>
              </div>
            )}
          </div>
        )}

        {occ?.recurrenceId && (
          <fieldset className="grid gap-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Aplicar a</legend>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as EditScope)}>
              {(Object.keys(EDIT_SCOPE_LABEL) as EditScope[]).map((s) => (
                <label key={s} className="flex items-start gap-2 text-sm">
                  <RadioGroupItem value={s} className="mt-0.5" />
                  <span>
                    {EDIT_SCOPE_LABEL[s]}
                    <span className="block text-xs text-muted-foreground">{SCOPE_HELP[s]}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            {scope === "deste-em-diante" && <FrequencySelect value={frequency} onChange={setFrequency} />}
          </fieldset>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="entry-note">Observação (opcional)</Label>
          <Textarea id="entry-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <DialogFooter className="sm:justify-between">
          {occ ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon /> Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {occ && `${categoryPath(categories, occ.categoryId)} · ${formatDate(occ.date)}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {occ?.recurrenceId && (
            <RadioGroup value={deleteScope} onValueChange={(v) => setDeleteScope(v as EditScope)}>
              {(
                [
                  ["este", "Só este lançamento"],
                  ["deste-em-diante", "Este e os próximos (a série termina antes deste)"],
                  ["toda", "Toda a série, inclusive os passados"],
                ] as const
              ).map(([s, label]) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={s} />
                  {label}
                </label>
              ))}
            </RadioGroup>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FrequencySelect({ value, onChange }: { value: Frequency; onChange: (f: Frequency) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="entry-frequency">Frequência</Label>
      <NativeSelect
        id="entry-frequency"
        className="w-full"
        value={value}
        onChange={(e) => onChange(e.target.value as Frequency)}
      >
        {FREQUENCIES.map((f) => (
          <NativeSelectOption key={f} value={f}>
            {FREQUENCY_LABEL[f]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
