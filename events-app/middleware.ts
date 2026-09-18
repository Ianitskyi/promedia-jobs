import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { applyDefaultLocaleCookie } from "@/lib/i18n/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  applyDefaultLocaleCookie(request, response);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
