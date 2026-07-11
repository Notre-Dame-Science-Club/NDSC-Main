import { supabase, supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiOk } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return apiOk(
        { error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    // Supabase Auth দিয়ে login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return apiOk(
        { error: 'Incorrect email or password.' },
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
      return apiOk(
        { error: 'Member record not found.' },
        { status: 404 }
      )
    }

    // Verified কিনা check
    if (!member.is_verified) {
      return apiOk(
        { error: 'Your account has not been approved yet. Please wait for admin approval.' },
        { status: 403 }
      )
    }

    return apiOk({
      success: true,
      session: data.session,
      member: {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        role: member.role,
        wing: member.wing,
        department: member.department,
        college_roll: member.college_roll,
        batch: member.batch,
        avatar_url: member.avatar_url,
      }
    })

  } catch (err) {
    return apiOk(
      { error: 'Server error. Please try again.' },
      { status: 500 }
    )
  }
}
