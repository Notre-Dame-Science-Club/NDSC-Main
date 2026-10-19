// ============================================================================
// Admin Session API Route
// Check admin authentication
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { authCookies } from "@/lib/config/site";
import { readSessionCookie } from "@/lib/api/session-cookie";
import type { AdminSession } from "@/types/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await readSessionCookie<AdminSession>(authCookies.admin);

    if (!session) {
      return NextResponse.json({ admin: null }, { status: 401 });
    }

    return NextResponse.json({ admin: (session as any).admin });
  } catch (error) {
    return NextResponse.json({ admin: null }, { status: 401 });
  }
}
