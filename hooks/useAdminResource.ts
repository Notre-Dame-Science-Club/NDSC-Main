'use client'

// hooks/useAdminResource.ts
//
// Every admin/*/page.tsx (members, publications, activities, olympiads, ...)
// hand-rolls the same four things: a GET-on-mount list load, a POST create,
// a PUT update, and a DELETE, each with their own loading/error state. This
// hook is that pattern, generalized, so new admin pages can skip straight to
// the form/table UI. See ARCHITECTURE.md for the full contract and a usage
// example.
//
// It does NOT assume every endpoint's JSON shape matches — see
// `extractList`/`extractItem` in AdminResourceConfig for how to handle an
// endpoint that wraps its response (e.g. `{ members: [...] }`).

import { useCallback, useEffect, useState } from 'react'
import type {
  AdminResourceConfig,
  AdminResourceRow,
  UseAdminResourceReturn,
} from '@/types/admin-resource'

function defaultExtractList<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[]
  if (json && typeof json === 'object') {
    for (const value of Object.values(json as Record<string, unknown>)) {
      if (Array.isArray(value)) return value as T[]
    }
  }
  return []
}

function defaultExtractItem<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'id' in json) return json as T
  if (json && typeof json === 'object') {
    for (const value of Object.values(json as Record<string, unknown>)) {
      if (value && typeof value === 'object' && 'id' in value) return value as T
    }
  }
  return json as T
}

async function readJsonSafely(res: Response): Promise<any> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Generic list + create + update + delete hook for an admin resource
 * exposed via a single REST-ish endpoint (GET list / POST create / PUT
 * update / DELETE remove), matching the convention used by
 * app/api/admin/*\/route.ts.
 *
 * @example
 * const { items, loading, error, create, update, remove } =
 *   useAdminResource<PublicationRow>({ endpoint: '/api/admin/publications' })
 */
export function useAdminResource<T extends AdminResourceRow>(
  config: AdminResourceConfig<T>
): UseAdminResourceReturn<T> {
  const { endpoint, idLocation = 'body' } = config
  const extractList = config.extractList ?? defaultExtractList<T>
  const extractItem = config.extractItem ?? defaultExtractItem<T>

  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint)
      const json = await readJsonSafely(res)
      if (!res.ok) {
        setError((json && json.error) || `Failed to load (${res.status}).`)
        setItems([])
        return
      }
      setItems(extractList(json))
    } catch {
      setError('Network error while loading.')
      setItems([])
    } finally {
      setLoading(false)
    }
    // extractList/extractItem are expected to be stable (defined outside
    // render, or memoized by the caller) — intentionally not in deps to
    // avoid re-fetching every render if a caller passes an inline function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  useEffect(() => {
    reload()
  }, [reload])

  const create = useCallback(
    async (payload: Partial<T>): Promise<T | null> => {
      setError(null)
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await readJsonSafely(res)
        if (!res.ok) {
          setError((json && json.error) || `Create failed (${res.status}).`)
          return null
        }
        const created = extractItem(json)
        setItems((prev) => [...prev, created])
        return created
      } catch {
        setError('Network error while creating.')
        return null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpoint]
  )

  const update = useCallback(
    async (payload: Partial<T> & { id: string }): Promise<T | null> => {
      setError(null)
      try {
        const url =
          idLocation === 'query'
            ? `${endpoint}?id=${encodeURIComponent(payload.id)}`
            : endpoint
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await readJsonSafely(res)
        if (!res.ok) {
          setError((json && json.error) || `Update failed (${res.status}).`)
          return null
        }
        const updated = extractItem(json)
        setItems((prev) => prev.map((it) => (it.id === payload.id ? updated : it)))
        return updated
      } catch {
        setError('Network error while updating.')
        return null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpoint, idLocation]
  )

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null)
      try {
        const url = idLocation === 'query' ? `${endpoint}?id=${encodeURIComponent(id)}` : endpoint
        const res = await fetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: idLocation === 'query' ? undefined : JSON.stringify({ id }),
        })
        const json = await readJsonSafely(res)
        if (!res.ok) {
          setError((json && json.error) || `Delete failed (${res.status}).`)
          return false
        }
        setItems((prev) => prev.filter((it) => it.id !== id))
        return true
      } catch {
        setError('Network error while deleting.')
        return false
      }
    },
    [endpoint, idLocation]
  )

  return { items, loading, error, reload, create, update, remove }
}
