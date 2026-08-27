// ============================================================================
// Chat Participants API Routes
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// ══════════════════════════════════════════════════════════════════════════
// GET /api/chat/participants
// Get participants for a room
// ══════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("room_id");

    if (!roomId) {
      return NextResponse.json({ error: "room_id required" }, { status: 400 });
    }

    const { data: participants, error } = await supabase
      .from("chat_room_participants")
      .select(`
        *,
        members(
          id,
          full_name,
          department,
          is_executive,
          is_organizer
        )
      `)
      .eq("room_id", roomId)
      .order("joined_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ participants: participants || [] });
  } catch (error: any) {
    console.error("Error fetching participants:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/chat/participants
// Add participant to a room
// ══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();

    const {
      room_id,
      member_id,
      role = "participant",
      can_send = true,
      can_read = true,
      can_vote = false,
      added_by,
    } = body;

    if (!room_id || !member_id) {
      return NextResponse.json(
        { error: "room_id and member_id required" },
        { status: 400 }
      );
    }

    // Check if requester is admin/moderator
    if (added_by) {
      const { data: requester } = await supabase
        .from("chat_room_participants")
        .select("role")
        .eq("room_id", room_id)
        .eq("member_id", added_by)
        .single();

      if (!requester || !["admin", "moderator"].includes(requester.role)) {
        return NextResponse.json(
          { error: "Only admins/moderators can add participants" },
          { status: 403 }
        );
      }
    }

    // Add participant
    const { data: participant, error } = await supabase
      .from("chat_room_participants")
      .insert({
        room_id,
        member_id,
        role,
        can_send,
        can_read,
        can_vote,
        is_muted: false,
      })
      .select(`
        *,
        members(
          id,
          full_name,
          department
        )
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "User is already a participant" },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ participant });
  } catch (error: any) {
    console.error("Error adding participant:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PATCH /api/chat/participants
// Update participant permissions
// ══════════════════════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();

    const { room_id, member_id, updated_by, ...updates } = body;

    if (!room_id || !member_id) {
      return NextResponse.json(
        { error: "room_id and member_id required" },
        { status: 400 }
      );
    }

    // Check if requester is admin/moderator
    if (updated_by) {
      const { data: requester } = await supabase
        .from("chat_room_participants")
        .select("role")
        .eq("room_id", room_id)
        .eq("member_id", updated_by)
        .single();

      if (!requester || !["admin", "moderator"].includes(requester.role)) {
        return NextResponse.json(
          { error: "Only admins/moderators can update permissions" },
          { status: 403 }
        );
      }
    }

    // Update participant
    const { data: participant, error } = await supabase
      .from("chat_room_participants")
      .update(updates)
      .eq("room_id", room_id)
      .eq("member_id", member_id)
      .select(`
        *,
        members(
          id,
          full_name,
          department
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ participant });
  } catch (error: any) {
    console.error("Error updating participant:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// DELETE /api/chat/participants
// Remove participant from room
// ══════════════════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("room_id");
    const memberId = searchParams.get("member_id");
    const removedBy = searchParams.get("removed_by");

    if (!roomId || !memberId) {
      return NextResponse.json(
        { error: "room_id and member_id required" },
        { status: 400 }
      );
    }

    // Check if requester is admin
    if (removedBy && removedBy !== memberId) {
      const { data: requester } = await supabase
        .from("chat_room_participants")
        .select("role")
        .eq("room_id", roomId)
        .eq("member_id", removedBy)
        .single();

      if (!requester || requester.role !== "admin") {
        return NextResponse.json(
          { error: "Only admins can remove participants" },
          { status: 403 }
        );
      }
    }

    // Remove participant
    const { error } = await supabase
      .from("chat_room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("member_id", memberId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing participant:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
