"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de valor em reais como texto (aceita `1.234,56`, `1234.56`, `R$ 50`).
 * A conversão para centavos acontece no servidor (`parseBRL`).
 */
export function MoneyInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" className="pl-9 tabular-nums" {...props} />
    </div>
  );
}
