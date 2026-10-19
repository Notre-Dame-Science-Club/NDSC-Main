import { redirect } from 'next/navigation'

// Bulk adding now lives under "Manage Accounts". Kept so old links/bookmarks still work.
export default function BulkAccountsRedirect() {
  redirect('/admin/accounts?tab=bulk')
}
