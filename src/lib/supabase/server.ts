import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { supabaseEnv } from "./env";

/** Cliente Supabase para Server Components, Server Actions e Route Handlers. */
export async function createClient() {
  // A validação da sessão lê o relógio (expiração do token). Isso não pode
  // acontecer no prerender, nem no runtime prefetch (Cache Components), só na requisição.
  await connection();
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Chamado de um Server Component: não dá para gravar cookies aqui.
          // Tudo bem — o proxy renova a sessão a cada requisição.
        }
      },
    },
  });
}
