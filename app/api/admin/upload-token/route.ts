import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Secret টা browser এ পাঠাই — admin already authenticated
  return NextResponse.json({
    uploadUrl: process.env.HOSTINGER_UPLOAD_URL,
    secret: process.env.UPLOAD_SECRET,
  })
}
