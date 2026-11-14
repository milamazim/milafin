"use client";

import { useTransition } from "react";
import { toast } from "sonner";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Executa uma Server Action numa transição: `pending` enquanto roda, aviso
 * (toast) de erro e, opcionalmente, de sucesso. Devolve `true` se deu certo.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();

  const exec = (action: () => Promise<Result>, opts: { success?: string } = {}) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        try {
          const r = await action();
          if (r.ok) {
            if (opts.success) toast.success(opts.success);
            resolve(true);
          } else {
            toast.error(r.error);
            resolve(false);
          }
        } catch {
          toast.error("Falha de conexão. Verifique a internet e tente de novo.");
          resolve(false);
        }
      });
    });

  return { pending, exec };
}
