import { authCookies } from "@/lib/config/site";
import { apiUnauthorized } from "@/lib/api/response";
import { readSessionCookie } from "@/lib/api/session-cookie";
import type { AdminSession } from "@/types/auth";

/**
 * Whether the current request carries a valid, signature-verified admin
 * session cookie.
 *
 * Reading/verifying that cookie can throw — e.g. `lib/api/sign.ts` throws on
 * purpose when `SESSION_SECRET` isn't set in production, so a forged cookie
 * can never be trusted. Left uncaught, that throw would escape whichever
 * route handler called `isAdmin()` (several GET handlers call it directly,
 * not just through `requireAdmin()`), and an uncaught exception in a Next.js
 * route handler comes back to the browser as an HTML error page, not JSON —
 * which breaks every `res.json()` call on the client with a cryptic
 * "Unexpected token '<'" instead of a real error. Catching it here keeps
 * every caller's contract simple (`isAdmin()` just answers true/false) and
 * fails closed (treats the error as "not an admin") while logging the real
 * cause server-side so it's actually diagnosable.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await readSessionCookie<AdminSession>(authCookies.admin);
    return !!session && typeof session.email === "string";
  } catch (err) {
    console.error("isAdmin(): failed to read/verify the admin session cookie —", err);
    return false;
  }
}

/** Email of the signed-in admin (for "created by" / "resolved by" columns), or null. */
export async function getAdminEmail(): Promise<string | null> {
  try {
    const session = await readSessionCookie<AdminSession>(authCookies.admin);
    return session && typeof session.email === "string" ? session.email : null;
  } catch (err) {
    console.error("getAdminEmail(): failed to read/verify the admin session cookie —", err);
    return null;
  }
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
