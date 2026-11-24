import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

// Rotas que exigem login com e-mail verificado.
const PROTECTED_PREFIXES = [
  "/inicio",
  "/perfil",
  "/veiculo",
  "/oferecer",
  "/pegar",
  "/reservas",
  "/minhas-caronas",
  "/admin",
];

// Rotas só para visitantes (usuário logado é mandado para /inicio).
const GUEST_ONLY = ["/entrar", "/cadastro"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // getClaims renova a sessão se preciso e valida a assinatura do token localmente
  // (chaves assimétricas), sem consultar o servidor de Auth a cada requisição.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/entrar") url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    // Mantém cookies de sessão renovados.
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (matches(pathname, PROTECTED_PREFIXES) && !user) {
    return redirectTo("/entrar");
  }

  if (matches(pathname, GUEST_ONLY) && user) {
    return redirectTo("/inicio");
  }

  return response;
}
