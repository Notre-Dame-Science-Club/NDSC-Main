// ============================================================================
// Admin Session API Route
// Check admin authentication
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("admin_session");

    if (!sessionCookie?.value) {
      return NextResponse.json({ admin: null }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    return NextResponse.json({ admin: session.admin });
  } catch (error) {
    return NextResponse.json({ admin: null }, { status: 401 });
  }
}
