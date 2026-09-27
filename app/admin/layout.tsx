import { authCookies } from '@/lib/config/site'
import { readSessionCookie } from '@/lib/api/session-cookie'
import AdminShell from '@/components/admin/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSessionCookie(authCookies.admin)

  // This layout wraps every /admin/* route, including /admin/login. Without
  // a session we skip the sidebar chrome entirely and just render the page
  // (the login page handles its own layout).
  if (!session) return <>{children}</>

  return <AdminShell>{children}</AdminShell>
}
