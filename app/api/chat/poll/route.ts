// ============================================================================
// Real-time Polling API Route
// Efficient endpoint for real-time updates
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// ══════════════════════════════════════════════════════════════════════════
// GET /api/chat/poll
// Efficient polling endpoint for real-time updates
// Returns: new message count, typing indicators, updated rooms
// ══════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("member_id");
    const roomId = searchParams.get("room_id");
    const lastPoll = searchParams.get("last_poll"); // ISO timestamp

    if (!memberId) {
      return NextResponse.json({ error: "member_id required" }, { status: 400 });
    }

    const updates: any = {
      new_messages: false,
      new_message_count: 0,
      typing_users: [],
      room_updates: [],
    };

    // Get typing indicators for current room
    if (roomId) {
      const { data: typingUsers } = await supabase
        .from("chat_typing_indicators")
        .select(`
          member_id,
          members(full_name)
        `)
        .eq("room_id", roomId)
        .neq("member_id", memberId)
        .gte("started_at", new Date(Date.now() - 10000).toISOString());

      updates.typing_users = (typingUsers || []).map((t: any) => ({
        member_id: t.member_id,
        name: t.members?.full_name || "Someone",
      }));
    }

    // Check for new messages since last poll
    if (lastPoll && roomId) {
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("is_deleted", false)
        .gt("created_at", lastPoll);

      if (count && count > 0) {
        updates.new_messages = true;
        updates.new_message_count = count;
      }
    }

    // Get updated unread counts for all rooms
    const { data: participantRooms } = await supabase
      .from("chat_room_participants")
      .select("room_id, last_read_at")
      .eq("member_id", memberId);

    if (participantRooms) {
      const roomUpdates = await Promise.all(
        participantRooms.map(async (pr) => {
          const lastRead = pr.last_read_at || "1970-01-01T00:00:00.000Z";

          const { count: unreadCount } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("room_id", pr.room_id)
            .eq("is_deleted", false)
            .gt("created_at", lastRead);

          return {
            room_id: pr.room_id,
            unread_count: unreadCount || 0,
          };
        })
      );

      updates.room_updates = roomUpdates;
    }

    return NextResponse.json(updates);
  } catch (error: any) {
    console.error("Error polling updates:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/chat/poll/typing
// Update typing indicator
// ══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const body = await req.json();
    const { room_id, member_id } = body;

    if (!room_id || !member_id) {
      return NextResponse.json(
        { error: "room_id and member_id required" },
        { status: 400 }
      );
    }

    // Upsert typing indicator
    await supabase.from("chat_typing_indicators").upsert(
      {
        room_id,
        member_id,
        started_at: new Date().toISOString(),
      },
      {
        onConflict: "room_id,member_id",
      }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating typing indicator:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
