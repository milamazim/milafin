import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Usuário logado ou redireciona para /entrar.
 * Use em toda página e Server Action que lê/grava dados: o `id` retornado é o
 * filtro `user_id` das consultas Drizzle.
 *
 * `getClaims()` valida a assinatura do token da sessão. Com chave assimétrica
 * (padrão dos projetos Supabase), a validação é local, com a chave pública em
 * cache, sem ida ao servidor de login a cada página. Com chave simétrica
 * (ex.: Supabase local), ela consulta o servidor, como o `getUser()`.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) redirect("/entrar");
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});
