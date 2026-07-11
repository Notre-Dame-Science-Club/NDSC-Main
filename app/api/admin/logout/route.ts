import { NextRequest, NextResponse } from "next/server";
import { authCookies } from "@/lib/config/site";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin/login", req.url));
  res.cookies.delete(authCookies.admin);
  return res;
}
