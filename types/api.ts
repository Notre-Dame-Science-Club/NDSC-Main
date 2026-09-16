// types/api.ts
//
// Shared shapes for API route responses and for hooks/components that
// consume them. Pair with lib/api-response.ts, which produces values typed
// as these on the server side.

/** Standard error body. Every failing route in this app returns this shape. */
export interface ApiErrorBody {
  error: string
}

/** Standard "the write succeeded, no payload needed" body. */
export interface ApiOkBody {
  success: true
}

/**
 * Discriminated union for client-side code that needs to branch on
 * success/failure after `await res.json()`. Not every existing route's
 * success body fits `{ data: T }` (many just return the row/array directly —
 * see ARCHITECTURE.md), so use this for *new* code, and reach for a manual
 * shape (or the extractors in hooks/useAdminResource.ts) when consuming
 * existing endpoints.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }
