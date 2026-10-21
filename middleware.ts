import { NextRequest, NextResponse } from 'next/server'

// Tags every /admin/* request with its pathname so the server-side admin
// layout (app/admin/layout.tsx) can tell /admin/login apart from the rest and
// redirect unauthenticated visitors to the login page.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers)
  headers.set('x-admin-path', req.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
