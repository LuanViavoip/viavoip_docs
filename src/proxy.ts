import { NextResponse, type NextRequest } from "next/server";

import { PROFILE_COOKIE_NAME } from "@/features/profiles/constants";

/**
 * Primeira visita: sem perfil escolhido, envia para a seleção preservando o destino (deep links).
 * Isto é apenas personalização de exibição, não autenticação.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(PROFILE_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/profile";
  url.search = "";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/docs/:path*"],
};
