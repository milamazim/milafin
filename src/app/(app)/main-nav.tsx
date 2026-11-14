"use client";

import {
  ChartColumnIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  ListIcon,
  TagsIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Telas principais (E3). */
const LINKS = [
  { href: "/lancamentos", label: "Lançamentos", icon: ListIcon },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/relatorios", label: "Relatórios", icon: ChartColumnIcon },
  { href: "/categorias", label: "Categorias", icon: TagsIcon },
  { href: "/dados", label: "Dados", icon: DatabaseIcon },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Abas no cabeçalho (tablet e desktop). */
export function MainNav() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Principal" className="hidden gap-1 md:flex">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isActive(href) && "bg-muted font-medium text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Barra de abas fixa no rodapé (celular): todas as telas sempre visíveis. */
export function BottomNav() {
  const isActive = useIsActive();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground",
                isActive(href) && "font-medium text-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
