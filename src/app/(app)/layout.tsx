import Link from "next/link";
import { Suspense } from "react";

import { ThemeToggle } from "@/components/theme-toggle";

import { MainNav } from "./main-nav";
import { UserMenu } from "./user-menu";

/**
 * Casca da área logada. Com Cache Components, a sessão não é lida aqui no
 * topo (isso seguraria toda a rota): o `proxy` já barra quem não está logado e
 * cada leitura de dados chama `requireUser()` dentro de um <Suspense>.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/lancamentos" className="font-semibold tracking-tight whitespace-nowrap">
            💰 milafin
          </Link>
          <MainNav />
          <div className="ml-auto flex items-center gap-1">
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4">{children}</main>
    </div>
  );
}
