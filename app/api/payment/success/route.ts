import { NextRequest } from "next/server";
import { paymentRedirect } from "@/lib/payment/redirect";

// Browser-facing redirect target after a successful payment on SSLCommerz's
// hosted page. The IPN handler remains the actual source of truth for the
// payment status; this just gets the user to the right screen right away.
export const dynamic = "force-dynamic";

const handle = (req: NextRequest) => paymentRedirect(req, "success");

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
