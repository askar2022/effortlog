import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files.
     * Required by Supabase SSR for session refresh.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icon-192\\.png|icon-512\\.png|manifest\\.json).*)",
  ],
};
