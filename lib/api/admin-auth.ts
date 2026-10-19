import { authCookies } from "@/lib/config/site";
import { apiUnauthorized } from "@/lib/api/response";
import { readSessionCookie } from "@/lib/api/session-cookie";
import type { AdminSession } from "@/types/auth";

/** Whether the current request carries a valid, signature-verified admin session cookie. */
export async function isAdmin(): Promise<boolean> {
  const session = await readSessionCookie<AdminSession>(authCookies.admin);
  return !!session && typeof session.email === "string";
}

/** Email of the signed-in admin (for "created by" / "resolved by" columns), or null. */
export async function getAdminEmail(): Promise<string | null> {
  const session = await readSessionCookie<AdminSession>(authCookies.admin);
  return session && typeof session.email === "string" ? session.email : null;
}

/**
 * Guard for admin-only route handlers. Returns `null` when the caller is an
 * admin (so the route can continue), or an unauthorized response to return
 * immediately otherwise:
 *
 *   export async function POST(req: NextRequest) {
 *     const unauthorized = await requireAdmin()
 *     if (unauthorized) return unauthorized
 *     ...
 *   }
 */
export async function requireAdmin() {
  return (await isAdmin()) ? null : apiUnauthorized();
}
