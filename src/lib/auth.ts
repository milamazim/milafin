import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Usuário logado (validado no servidor do Supabase) ou redireciona para /entrar.
 * Use em toda página e Server Action que lê/grava dados: o `id` retornado é o
 * filtro `user_id` das consultas Drizzle.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/entrar");
  return { id: data.user.id, email: data.user.email ?? "" };
});
