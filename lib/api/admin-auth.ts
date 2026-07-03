import { cookies } from "next/headers";
import { authCookies } from "@/lib/config/site";
import { apiUnauthorized } from "@/lib/api/response";

/** Whether the current request carries a valid admin session cookie. */
export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return !!cookieStore.get(authCookies.admin);
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
