// types/admin-resource.ts
//
// Config/return types for hooks/useAdminResource.ts. Split out from the hook
// file so consumers can import just the types (e.g. to type a config object
// declared elsewhere) without pulling in the hook implementation.

/** Any row this hook manages must at least have an id. */
export interface AdminResourceRow {
  id: string
  [key: string]: unknown
}

export interface AdminResourceConfig<T extends AdminResourceRow> {
  /** e.g. '/api/admin/publications' */
  endpoint: string
  /**
   * Pull the array of rows out of a GET response. Existing admin endpoints
   * disagree on this: some return the array directly, some wrap it as
   * `{ members: [...] }`, `{ items: [...] }`, etc. Default: handles a bare
   * array, or the first array-valued property found on the object.
   */
  extractList?: (json: unknown) => T[]
  /**
   * Pull the single created/updated row out of a POST/PUT response.
   * Default: handles a bare row, or the first object-valued property found.
   */
  extractItem?: (json: unknown) => T
  /**
   * How the id is sent for PUT/DELETE. Most admin routes in this app read
   * `id` from the JSON body (see ARCHITECTURE.md); a few expect it in the
   * query string. Default: 'body'.
   */
  idLocation?: 'body' | 'query'
}

export interface UseAdminResourceReturn<T extends AdminResourceRow> {
  items: T[]
  loading: boolean
  error: string | null
  /** Re-fetch the list from the server. */
  reload: () => Promise<void>
  /** POST a new row. Returns the created row on success, or null on failure (see `error`). */
  create: (payload: Partial<T>) => Promise<T | null>
  /** PUT an update. `payload` must include `id`. Returns the updated row, or null on failure. */
  update: (payload: Partial<T> & { id: string }) => Promise<T | null>
  /** DELETE by id. Returns whether it succeeded. */
  remove: (id: string) => Promise<boolean>
}
