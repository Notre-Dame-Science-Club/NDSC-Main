import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { 
      email, 
      password, 
      full_name, 
      phone, 
      ndsc_id,
      college_role,
      batch 
    } = await req.json()

    // Basic validation
    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'নাম, ইমেইল এবং পাসওয়ার্ড দেওয়া আবশ্যক' },
        { status: 400 }
      )
    }

    // Supabase Auth এ user তৈরি
    const { data: authData, error: authError } = await supabaseAdmin
      .auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    // members table এ save
    const { error: dbError } = await supabaseAdmin
      .from('members')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        phone: phone || null,
        ndsc_id: ndsc_id || null,
        college_role: college_role || null,
        batch: batch || null,
      })

    if (dbError) {
      // Auth user delete করো যদি db fail করে
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: dbError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Registration সফল!'
    })

  } catch (err) {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
