"use client";

import { CheckCheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

import { markPastPaid } from "./actions";

/**
 * Botão com confirmação: marca como pagas as ocorrências de série com data
 * anterior a hoje. Com `recurrenceId`, só daquela série.
 */
export function MarkPastPaidButton({
  recurrenceId,
  label,
  onDone,
  size = "sm",
}: {
  recurrenceId?: string;
  label: string;
  onDone?: () => void;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const { pending, exec } = useAction();

  async function confirm() {
    let count = 0;
    const ok = await exec(async () => {
      const r = await markPastPaid(recurrenceId ? { recurrenceId } : {});
      if (r.ok) count = r.data.count;
      return r;
    });
    if (!ok) return;
    setOpen(false);
    toast.success(
      count === 0
        ? "Nada a marcar: as ocorrências anteriores a hoje já estavam pagas."
        : `${count} ${count === 1 ? "ocorrência marcada como paga" : "ocorrências marcadas como pagas"}.`,
    );
    onDone?.();
  }

  return (
    <>
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)}>
        <CheckCheckIcon /> {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar anteriores a hoje como pagas?</AlertDialogTitle>
            <AlertDialogDescription>
              {recurrenceId
                ? "Todas as ocorrências desta série com data antes de hoje que ainda não estão pagas (ou recebidas) serão marcadas como pagas."
                : "Todas as ocorrências de séries recorrentes com data antes de hoje que ainda não estão pagas (ou recebidas) serão marcadas como pagas, inclusive as de anos anteriores."}{" "}
              Lançamentos avulsos não são alterados. Você pode desmarcar qualquer uma depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={confirm}>
              {pending ? "Marcando…" : "Marcar como pagas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
