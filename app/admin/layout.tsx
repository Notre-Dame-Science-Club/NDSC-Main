import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { authCookies } from '@/lib/config/site'
import { readSessionCookie } from '@/lib/api/session-cookie'
import AdminShell from '@/components/admin/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSessionCookie(authCookies.admin)

  if (!session) {
    // This layout wraps every /admin/* route, including /admin/login. Only the
    // login page may render without a valid, signature-verified session;
    // everything else is sent to the login page on the server, so no admin UI
    // is ever served to an anonymous visitor. (middleware.ts sets x-admin-path.)
    const path = (await headers()).get('x-admin-path') || ''
    if (path === '/admin/login' || path.startsWith('/admin/login/')) return <>{children}</>
    redirect('/admin/login')
  }

  return <AdminShell>{children}</AdminShell>
}
