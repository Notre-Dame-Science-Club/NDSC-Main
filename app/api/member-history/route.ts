import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/member-history?member_id=xxx
// Fetch history data for a specific member
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('member_id')

    if (!memberId) {
      return apiError('member_id is required', 400)
    }

    // Get member email first
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('email')
      .eq('id', memberId)
      .single()

    if (memberError || !member) {
      return apiError('Member not found', 404)
    }

    // Fetch olympiad submissions by email
    const { data: olympiadSubmissions, error: olympiadError } = await supabaseAdmin
      .from('olympiad_registrations')
      .select(`
        id,
        olympiad_id,
        full_name,
        email,
        exam_started_at,
        exam_submitted_at,
        mcq_score,
        final_score,
        result_score,
        result_feedback,
        review_status,
        created_at,
        olympiads (
          id,
          name,
          description,
          cover_image_url,
          exam_date,
          result_published
        )
      `)
      .eq('email', member.email)
      .order('created_at', { ascending: false })

    if (olympiadError) {
      console.error('Error fetching olympiad submissions:', olympiadError)
    }

    // Fetch payment transactions through activity registrations
    // First get member's activity registrations
    const { data: registrations, error: regError } = await supabaseAdmin
      .from('activity_registrations')
      .select('id')
      .eq('member_id', memberId)

    let paymentHistory = []
    if (!regError && registrations && registrations.length > 0) {
      const registrationIds = registrations.map(r => r.id)

      const { data: payments, error: paymentError } = await supabaseAdmin
        .from('payment_transactions')
        .select(`
          id,
          tran_id,
          activity_registration_id,
          amount,
          currency,
          status,
          created_at,
          validated_at,
          activity_registrations (
            id,
            activity_sessions (
              id,
              title,
              activity_id,
              activities (
                id,
                title
              )
            )
          )
        `)
        .in('activity_registration_id', registrationIds)
        .order('created_at', { ascending: false })

      if (!paymentError && payments) {
        paymentHistory = payments
      }
    }

    return apiOk({
      olympiadSubmissions: olympiadSubmissions || [],
      paymentHistory: paymentHistory || []
    })
  } catch (error: any) {
    console.error('Error fetching member history:', error)
    return apiError(error.message || 'Failed to fetch history', 500)
  }
}
