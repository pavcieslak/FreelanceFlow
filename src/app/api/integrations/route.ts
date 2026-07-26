import { NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/lib/session";
import { allIntegrations } from "@/lib/config";

/**
 * Which optional integrations are switched on, so the UI can disable features
 * that cannot work and say why, instead of failing when the user clicks.
 *
 * Authenticated: it reports which environment variables are unset, which is
 * not worth exposing to anonymous callers. Only variable *names* are returned,
 * never their values.
 */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  return NextResponse.json(
    {
      integrations: allIntegrations().map(
        ({ id, label, configured, missing, partial, enables, fallback }) => ({
          id,
          label,
          configured,
          missing,
          partial,
          enables,
          fallback,
        })
      ),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
