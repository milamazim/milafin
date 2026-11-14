"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CombineIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PiggyBankIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { PromptDialog } from "@/components/prompt-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Category } from "@/db/schema";
import type { CategoryKind } from "@/domain/summary";
import { buildTree, isActive, KIND_LABEL } from "@/lib/category-tree";
import { centsToInput, formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  createCategory,
  createStarterCategories,
  deleteCategory,
  mergeCategory,
  renameCategory,
  setCategoryArchived,
  setCategoryLimit,
} from "./actions";

type DialogState =
  | { type: "create"; kind: CategoryKind; parent?: Category }
  | { type: "rename" | "limit" | "merge" | "delete"; category: Category }
  | null;

export function CategoriesManager({ categories, usage }: { categories: Category[]; usage: Record<string, number> }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { pending, exec } = useAction();
  const close = () => setDialog(null);
  const tree = buildTree(categories, { includeArchived: showArchived });
  const hasArchived = categories.some((c) => !isActive(c, categories));

  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhuma categoria ainda</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm">
          <p className="text-muted-foreground">
            Comece com um conjunto sugerido (Renda, Moradia, Alimentação, Transporte, Saúde, Lazer) e ajuste depois, ou
            crie as suas do zero.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => exec(createStarterCategories, { success: "Categorias criadas." })}>
              <SparklesIcon /> Criar categorias sugeridas
            </Button>
            <Button variant="outline" onClick={() => setDialog({ type: "create", kind: "despesa" })}>
              <PlusIcon /> Criar do zero
            </Button>
          </div>
        </CardContent>
        <Dialogs dialog={dialog} close={close} categories={categories} usage={usage} pending={pending} exec={exec} />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {hasArchived && (
        <label className="flex w-fit items-center gap-2 text-sm">
          <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(Boolean(v))} />
          Mostrar arquivadas
        </label>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {(["despesa", "receita"] as const).map((kind) => (
          <Card key={kind}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{KIND_LABEL[kind]}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setDialog({ type: "create", kind })}>
                <PlusIcon /> Nova categoria
              </Button>
            </CardHeader>
            <CardContent>
              {tree[kind].length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria.</p>}
              <ul className="divide-y">
                {tree[kind].map(({ category, children }) => (
                  <li key={category.id} className="py-2">
                    <CategoryRow
                      category={category}
                      all={categories}
                      uses={usage[category.id] ?? 0}
                      onAction={setDialog}
                      onArchive={(archived) =>
                        exec(() => setCategoryArchived({ id: category.id, archived }), {
                          success: archived ? "Categoria arquivada." : "Categoria reativada.",
                        })
                      }
                    />
                    {children.length > 0 && (
                      <ul className="mt-1 ml-4 border-l pl-3">
                        {children.map((child) => (
                          <li key={child.id} className="py-1">
                            <CategoryRow
                              category={child}
                              all={categories}
                              uses={usage[child.id] ?? 0}
                              onAction={setDialog}
                              onArchive={(archived) =>
                                exec(() => setCategoryArchived({ id: child.id, archived }), {
                                  success: archived ? "Subcategoria arquivada." : "Subcategoria reativada.",
                                })
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialogs dialog={dialog} close={close} categories={categories} usage={usage} pending={pending} exec={exec} />
    </div>
  );
}

function CategoryRow({
  category,
  all,
  uses,
  onAction,
  onArchive,
}: {
  category: Category;
  all: Category[];
  uses: number;
  onAction: (d: DialogState) => void;
  onArchive: (archived: boolean) => void;
}) {
  const active = isActive(category, all);
  const parentArchived = Boolean(category.parentId && all.find((p) => p.id === category.parentId)?.archivedAt);
  const isParent = !category.parentId;
  return (
    <div className="flex items-center gap-2">
      <span className={cn("min-w-0 flex-1 truncate", isParent ? "font-medium" : "text-sm", !active && "text-muted-foreground line-through")}>
        {category.name}
      </span>
      {category.monthlyLimitCents && (
        <Badge variant="secondary" title="Limite mensal">
          {formatBRL(category.monthlyLimitCents)}/mês
        </Badge>
      )}
      {!active && <Badge variant="outline">Arquivada</Badge>}
      {uses > 0 && (
        <span className="hidden text-xs text-muted-foreground sm:inline" title="Lançamentos e séries">
          {uses} {uses === 1 ? "uso" : "usos"}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${category.name}`} />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isParent && active && (
            <DropdownMenuItem onClick={() => onAction({ type: "create", kind: category.kind, parent: category })}>
              <PlusIcon /> Adicionar subcategoria
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onAction({ type: "rename", category })}>
            <PencilIcon /> Renomear
          </DropdownMenuItem>
          {category.kind === "despesa" && (
            <DropdownMenuItem onClick={() => onAction({ type: "limit", category })}>
              <PiggyBankIcon /> Limite mensal
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onAction({ type: "merge", category })}>
            <CombineIcon /> Mesclar com…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {category.archivedAt ? (
            <DropdownMenuItem disabled={parentArchived} onClick={() => onArchive(false)}>
              <ArchiveRestoreIcon /> Reativar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onArchive(true)}>
              <ArchiveIcon /> Arquivar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => onAction({ type: "delete", category })}>
            <Trash2Icon /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Dialogs({
  dialog,
  close,
  categories,
  usage,
  pending,
  exec,
}: {
  dialog: DialogState;
  close: () => void;
  categories: Category[];
  usage: Record<string, number>;
  pending: boolean;
  exec: ReturnType<typeof useAction>["exec"];
}) {
  const onOpenChange = (open: boolean) => !open && close();
  const target = dialog && "category" in dialog ? dialog.category : undefined;

  return (
    <>
      <CreateDialog dialog={dialog?.type === "create" ? dialog : null} close={close} pending={pending} exec={exec} />

      <PromptDialog
        open={dialog?.type === "rename"}
        onOpenChange={onOpenChange}
        title="Renomear"
        label="Nome"
        initialValue={target?.name ?? ""}
        pending={pending}
        onSubmit={(name) => exec(() => renameCategory({ id: target!.id, name }), { success: "Nome atualizado." })}
      />

      <PromptDialog
        open={dialog?.type === "limit"}
        onOpenChange={onOpenChange}
        title={`Limite mensal: ${target?.name ?? ""}`}
        description="Quanto você planeja gastar por mês nesta categoria (inclui as subcategorias). Deixe vazio para remover."
        label="Limite por mês"
        money
        initialValue={target?.monthlyLimitCents ? centsToInput(target.monthlyLimitCents) : ""}
        pending={pending}
        onSubmit={(limit) => exec(() => setCategoryLimit({ id: target!.id, limit }), { success: "Limite atualizado." })}
      />

      <MergeDialog
        source={dialog?.type === "merge" ? dialog.category : null}
        categories={categories}
        close={close}
        pending={pending}
        exec={exec}
      />

      <AlertDialog open={dialog?.type === "delete"} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{target?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {target && (usage[target.id] ?? 0) > 0
                ? "Esta categoria tem lançamentos e não pode ser excluída. Arquive-a para escondê-la mantendo o histórico, ou mescle com outra."
                : "A categoria será removida. Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {target && !(usage[target.id] ?? 0) && (
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={async () => {
                  if (await exec(() => deleteCategory({ id: target.id }), { success: "Categoria excluída." })) close();
                }}
              >
                Excluir
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateDialog({
  dialog,
  close,
  pending,
  exec,
}: {
  dialog: Extract<DialogState, { type: "create" }> | null;
  close: () => void;
  pending: boolean;
  exec: ReturnType<typeof useAction>["exec"];
}) {
  const [kind, setKind] = useState<CategoryKind>("despesa");
  const [lastDialog, setLastDialog] = useState(dialog);
  if (dialog !== lastDialog) {
    setLastDialog(dialog);
    if (dialog) setKind(dialog.kind);
  }
  const parent = dialog?.parent;
  return (
    <PromptDialog
      open={Boolean(dialog)}
      onOpenChange={(o) => !o && close()}
      title={parent ? `Nova subcategoria em “${parent.name}”` : `Nova categoria de ${kind === "receita" ? "receita" : "despesa"}`}
      description={
        parent
          ? undefined
          : "Categorias agrupam subcategorias (ex.: Moradia › Aluguel, Luz). Uma categoria sem subcategorias também recebe lançamentos."
      }
      label="Nome"
      submitLabel="Criar"
      pending={pending}
      onSubmit={(name) =>
        exec(() => createCategory({ name, kind, parentId: parent?.id ?? null }), {
          success: parent ? "Subcategoria criada." : "Categoria criada.",
        })
      }
    />
  );
}

function MergeDialog({
  source,
  categories,
  close,
  pending,
  exec,
}: {
  source: Category | null;
  categories: Category[];
  close: () => void;
  pending: boolean;
  exec: ReturnType<typeof useAction>["exec"];
}) {
  const [targetId, setTargetId] = useState("");
  const sourceHasChildren = Boolean(source && categories.some((c) => c.parentId === source.id));
  const candidates = source
    ? categories.filter(
        (c) =>
          c.id !== source.id &&
          c.kind === source.kind &&
          c.parentId !== source.id &&
          isActive(c, categories) &&
          (!sourceHasChildren || !c.parentId),
      )
    : [];
  const label = (c: Category) => {
    const p = c.parentId ? categories.find((x) => x.id === c.parentId) : undefined;
    return p ? `${p.name} › ${c.name}` : c.name;
  };

  return (
    <Dialog open={Boolean(source)} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mesclar “{source?.name}”</DialogTitle>
          <DialogDescription>
            Todos os lançamentos e séries de “{source?.name}”
            {sourceHasChildren ? " (e suas subcategorias)" : ""} passam para a categoria escolhida, e “{source?.name}” é
            removida.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="merge-target">Mesclar com</Label>
          <NativeSelect id="merge-target" className="w-full" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <NativeSelectOption value="">Escolha…</NativeSelectOption>
            {candidates
              .map((c) => ({ id: c.id, label: label(c) }))
              .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
              .map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.label}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={!targetId || pending}
            onClick={async () => {
              if (await exec(() => mergeCategory({ sourceId: source!.id, targetId }), { success: "Categorias mescladas." })) {
                setTargetId("");
                close();
              }
            }}
          >
            {pending ? "Mesclando…" : "Mesclar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
