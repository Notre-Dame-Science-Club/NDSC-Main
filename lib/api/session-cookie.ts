import { NextResponse } from "next/server";

/**
 * Every login route (admin, organizer, activity-team) sets a JSON-encoded
 * httpOnly cookie with the same shape, just a different name/payload/TTL.
 * This centralizes that so the security-relevant flags (httpOnly, secure,
 * sameSite) can't drift between them.
 */
export function setSessionCookie(
  res: NextResponse,
  name: string,
  payload: unknown,
  maxAgeSeconds: number
) {
  res.cookies.set(name, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
  return res;
}

export const HOURS = 3600;
