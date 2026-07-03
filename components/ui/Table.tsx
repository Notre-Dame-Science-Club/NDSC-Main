import type { ReactNode } from 'react'

export interface TableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Extra className for the <td>, e.g. `'text-right'` for an actions column. */
  className?: string
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  /** Stable key per row, e.g. `(row) => row.id`. */
  rowKey: (row: T) => string
  emptyMessage?: string
}

/**
 * Consolidates the `<table className="w-full text-sm">` + manually-styled
 * `<thead>`/`<tbody>` markup duplicated across app/admin/members,
 * app/admin/olympiads, app/admin/executives (`#6a8faf` header text,
 * `1px solid var(--border)`-ish row dividers, centered "No X found." empty
 * row spanning all columns). Wrap the returned table in `<Card padding="none"
 * className="overflow-hidden">` or `overflow-x-auto` for the existing
 * scroll-on-mobile behavior.
 */
export default function Table<T>({ columns, rows, rowKey, emptyMessage = 'No results found.' }: TableProps<T>) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,212,255,0.05)' }}>
          {columns.map((col) => (
            <th key={col.key} className={`text-left px-4 py-3 font-medium ${col.className ?? ''}`} style={{ color: 'var(--muted)' }}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="px-4 py-8 text-center" style={{ color: 'var(--muted)' }}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={rowKey(row)} style={{ borderBottom: '1px solid var(--border)' }}>
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
