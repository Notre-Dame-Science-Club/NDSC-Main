import { supabase, supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'ইমেইল এবং পাসওয়ার্ড দাও' },
        { status: 400 }
      )
    }

    // Supabase Auth দিয়ে login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: 'ইমেইল বা পাসওয়ার্ড ভুল' },
        { status: 401 }
      )
    }

    // members table থেকে info আনো
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Member data পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    // Verified কিনা check
    if (!member.is_verified) {
      return NextResponse.json(
        { error: 'তোমার account এখনো approve হয়নি। Admin approval এর জন্য অপেক্ষা করো।' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      session: data.session,
      member: {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        role: member.role,
        wing: member.wing,
        batch: member.batch,
        avatar_url: member.avatar_url,
      }
    })

  } catch (err) {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
