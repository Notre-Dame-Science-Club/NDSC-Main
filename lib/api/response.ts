import { NextResponse } from "next/server";

/**
 * Thin wrappers around `NextResponse.json` so every route returns errors and
 * successes in the same shape instead of re-typing `NextResponse.json({
 * error: ... }, { status: ... })` by hand (that exact snippet appeared in
 * ~70 places across the API routes before this existed).
 */

/** A Supabase `{ error }` result, or any thrown value — normalized to a message. */
function messageOf(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as any).message === "string") {
    return (err as any).message;
  }
  return fallback;
}

export function apiOk<T>(data: T, init?: { status?: number }) {
  return NextResponse.json(data as any, { status: init?.status ?? 200 });
}

export function apiError(message: unknown, status = 400) {
  return NextResponse.json({ error: messageOf(message, "Something went wrong.") }, { status });
}

export const apiUnauthorized = (message = "Unauthorized") => apiError(message, 401);
export const apiForbidden = (message = "Forbidden.") => apiError(message, 403);
export const apiNotFound = (message = "Not found.") => apiError(message, 404);
export const apiBadRequest = (message = "Invalid request.") => apiError(message, 400);
export const apiServerError = (message = "Something went wrong. Please try again.") => apiError(message, 500);

/**
 * Runs a Supabase query/mutation and converts a `{ error }` result straight
 * into an API error response, so routes can write:
 *
 *   const { data, error } = await supabaseAdmin.from('activities').select()
 *   if (error) return apiError(error)
 *   return apiOk(data)
 *
 * which is already short, but for the common "just forward it" case you can
 * use `fromSupabase`:
 *
 *   return fromSupabase(await supabaseAdmin.from('activities').select())
 */
export function fromSupabase<T>(result: { data: T; error: { message: string } | null }, status = 400) {
  if (result.error) return apiError(result.error, status);
  return apiOk(result.data);
}
