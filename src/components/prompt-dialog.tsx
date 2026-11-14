"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { MoneyInput } from "./money-input";

/** Diálogo de um campo só (nome, limite…). `onSubmit` devolve true para fechar. */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  initialValue = "",
  money = false,
  submitLabel = "Salvar",
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  initialValue?: string;
  money?: boolean;
  submitLabel?: string;
  pending: boolean;
  onSubmit: (value: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(initialValue);
  const [lastOpen, setLastOpen] = useState(open);
  // reinicia o campo a cada abertura
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setValue(initialValue);
  }
  const Field = money ? MoneyInput : Input;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onSubmit(value)) onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="prompt-value">{label}</Label>
            <Field id="prompt-value" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
