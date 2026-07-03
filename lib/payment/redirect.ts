import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export type PaymentOutcome = "success" | "failed" | "cancelled";

/**
 * SSLCommerz posts back to /api/payment/{success,fail,cancel} with a
 * `tran_id`. All three routes need to do the same thing from there: look up
 * which activity registration the transaction belongs to, then bounce the
 * browser to that activity's dashboard with a `payment=` status flag.
 *
 * The IPN webhook (api/payment/ipn) remains the source of truth for the
 * actual payment status — this redirect is just for the user-facing UX.
 */
export async function paymentRedirect(req: NextRequest, outcome: PaymentOutcome): Promise<NextResponse> {
  const home = NextResponse.redirect(new URL("/", req.url));

  const tranId =
    req.nextUrl.searchParams.get("tran_id") ||
    (await req.formData().catch(() => null))?.get("tran_id")?.toString();
  if (!tranId) return home;

  const { data: tx } = await supabaseAdmin
    .from("payment_transactions")
    .select("activity_registration_id")
    .eq("tran_id", tranId)
    .single();
  if (!tx?.activity_registration_id) return home;

  const { data: registration } = await supabaseAdmin
    .from("activity_registrations")
    .select("activity_session_id")
    .eq("id", tx.activity_registration_id)
    .single();

  const { data: session } = registration
    ? await supabaseAdmin.from("activity_sessions").select("slug").eq("id", registration.activity_session_id).single()
    : { data: null };

  if (!session) return home;

  const destination = `/activities/${session.slug}/dashboard?reg=${tx.activity_registration_id}&payment=${outcome}`;
  return NextResponse.redirect(new URL(destination, req.url));
}
