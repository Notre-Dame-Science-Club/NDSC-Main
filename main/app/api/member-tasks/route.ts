import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/member-tasks?member_id=xxx
// Fetch tasks assigned to a specific member
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('member_id')

    if (!memberId) {
      return apiError('member_id is required', 400)
    }

    // Fetch task assignments for this member with task details
    const { data: assignments, error } = await supabaseAdmin
      .from('task_assignments')
      .select(`
        id,
        task_id,
        status,
        completed_at,
        assigned_at,
        tasks (
          id,
          task_name,
          task_description,
          task_department,
          task_start,
          task_end,
          task_is_complete,
          created_by,
          created_at
        )
      `)
      .eq('member_id', memberId)
      .order('assigned_at', { ascending: false })

    if (error) {
      return apiError(error.message, 400)
    }

    // Flatten the structure for easier frontend consumption
    const tasks = (assignments || []).map((a: any) => ({
      assignment_id: a.id,
      status: a.status,
      completed_at: a.completed_at,
      assigned_at: a.assigned_at,
      ...a.tasks,
    }))

    // Categorize tasks by status
    const now = new Date()
    const categorized = {
      completed: tasks.filter((t: any) => t.status === 'completed'),
      going: tasks.filter((t: any) =>
        t.status === 'going' ||
        (t.status === 'pending' && t.task_end && new Date(t.task_end) > now)
      ),
      passed: tasks.filter((t: any) =>
        t.status === 'passed' ||
        (t.status !== 'completed' && t.task_end && new Date(t.task_end) <= now)
      ),
    }

    return apiOk({ tasks, categorized })
  } catch (error: any) {
    return apiError(error.message || 'Failed to fetch tasks', 500)
  }
}

// PATCH /api/member-tasks
// Update task assignment status (mark as complete, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { assignment_id, status, member_id } = body

    if (!assignment_id || !status) {
      return apiError('assignment_id and status are required', 400)
    }

    const updates: any = { status, updated_at: new Date().toISOString() }

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString()
    }

    // Update task assignment
    const { data, error } = await supabaseAdmin
      .from('task_assignments')
      .update(updates)
      .eq('id', assignment_id)
      .eq('member_id', member_id) // Ensure member can only update their own assignments
      .select()
      .single()

    if (error) {
      return apiError(error.message, 400)
    }

    return apiOk({ assignment: data })
  } catch (error: any) {
    return apiError(error.message || 'Failed to update task', 500)
  }
}
