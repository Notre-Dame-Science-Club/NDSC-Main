import { NextRequest } from "next/server";
import { paymentRedirect } from "@/lib/payment/redirect";

export const dynamic = "force-dynamic";

const handle = (req: NextRequest) => paymentRedirect(req, "failed");

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
