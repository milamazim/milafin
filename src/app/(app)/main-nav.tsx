"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Telas principais (E3). No celular, a barra rola na horizontal. */
const LINKS = [
  { href: "/lancamentos", label: "Lançamentos" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/categorias", label: "Categorias" },
  { href: "/dados", label: "Dados" },
] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-muted font-medium text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
