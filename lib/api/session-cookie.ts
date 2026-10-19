import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signPayload, verifyPayload } from "./sign";

/**
 * Every login route (admin, organizer, activity-team) sets a JSON-encoded
 * httpOnly cookie with the same shape, just a different name/payload/TTL.
 * This centralizes that so the security-relevant flags (httpOnly, secure,
 * sameSite) can't drift between them.
 *
 * The payload is signed (see lib/api/sign.ts) before it's written, so a
 * cookie value set here can't be tampered with or hand-crafted client-side —
 * pair with `readSessionCookie` to read it back safely.
 */
export function setSessionCookie(
  res: NextResponse,
  name: string,
  payload: unknown,
  maxAgeSeconds: number
) {
  res.cookies.set(name, signPayload(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
  return res;
}

/**
 * Reads and verifies a session cookie set by `setSessionCookie`, returning
 * the decoded payload or null if the cookie is missing, malformed, or its
 * signature doesn't match (i.e. it was tampered with or hand-crafted).
 */
export async function readSessionCookie<T = unknown>(name: string): Promise<T | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(name)?.value;
  return verifyPayload<T>(raw);
}

export const HOURS = 3600;
