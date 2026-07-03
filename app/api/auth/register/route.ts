import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { validateCollegeRoll } from '@/lib/validation'
import { apiError, apiOk } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  try {
    const {
      email,
      password,
      full_name,
      phone,
      ndsc_id,
      college_roll,
      batch,
      payment_slip_url,
    } = await req.json()

    // Basic validation
    if (!email || !password || !full_name) {
      return apiOk(
        { error: 'Name, email, and password are required.' },
        { status: 400 }
      )
    }

    // College roll is the site's primary identifier for members — required
    // for everyone, with the exact-8-digits rule applying because NDSC
    // membership is specifically for Notre Dame College students.
    const rollError = validateCollegeRoll('Notre Dame College', college_roll)
    if (rollError) {
      return apiError(rollError, 400)
    }

    if (!payment_slip_url) {
      return apiOk(
        { error: 'Please upload a photo of your membership slip.' },
        { status: 400 }
      )
    }

    // Supabase Auth-এ user তৈরি
    const { data: authData, error: authError } = await supabaseAdmin
      .auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError) {
      return apiOk(
        { error: authError.message },
        { status: 400 }
      )
    }

    // members টেবিলে save
    const { error: dbError } = await supabaseAdmin
      .from('members')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        phone: phone || null,
        ndsc_id: ndsc_id || null,
        college_roll: String(college_roll),
        batch: batch || null,
        payment_slip_url,
        is_verified: false,
      })

    if (dbError) {
      // DB insert fail হলে auth user delete করে দাও যাতে orphan account না থাকে
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return apiOk(
        { error: dbError.message },
        { status: 400 }
      )
    }

    return apiOk({
      success: true,
      message: 'Registration successful! Your membership will be reviewed by an admin shortly.',
    })

  } catch (err) {
    return apiOk(
      { error: 'Server error. Please try again.' },
      { status: 500 }
    )
  }
}
