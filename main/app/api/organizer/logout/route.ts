import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { authCookies } from "@/lib/config/site";

export async function POST(req: NextRequest) {
  const res = apiOk({ success: true });
  res.cookies.delete(authCookies.organizer);
  return res;
}
