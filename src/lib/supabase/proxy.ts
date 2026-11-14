import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { HOME } from "@/lib/safe-next";

import { supabaseEnv } from "./env";

/** Rotas acessíveis sem login. */
const PUBLIC_PATHS = ["/entrar", "/cadastro", "/esqueci-senha", "/auth"];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Renova a sessão do Supabase (cookies) a cada requisição e faz a checagem
 * otimista de login. A autorização de verdade acontece no servidor
 * (`requireUser`) e na RLS do banco.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Não coloque código entre createServerClient e getClaims().
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (!loggedIn && !isPublic(pathname)) {
    const to = request.nextUrl.clone();
    to.pathname = "/entrar";
    to.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return redirectWithCookies(to, response);
  }

  if (loggedIn && (pathname === "/entrar" || pathname === "/cadastro")) {
    const to = request.nextUrl.clone();
    to.pathname = HOME;
    to.search = "";
    return redirectWithCookies(to, response);
  }

  return response;
}

/** Redireciona preservando os cookies de sessão renovados. */
function redirectWithCookies(to: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(to);
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}
