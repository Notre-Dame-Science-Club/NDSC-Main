// ============================================================================
// Admin Chat API Routes
// Admin-specific endpoints for managing chat rooms
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/api/admin-auth";

// ══════════════════════════════════════════════════════════════════════════
// GET /api/admin/chat/rooms
// Get all rooms with detailed stats (admin view)
// ══════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const unauthorized = await requireAdmin();
    if (unauthorized) return unauthorized;

    const supabase = supabaseAdmin;

    // Get all rooms (including inactive)
    const { data: rooms, error } = await supabase
      .from("chat_rooms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch stats for each room
    const roomsWithStats = await Promise.all(
      (rooms || []).map(async (room) => {
        // Participant count
        const { count: participantCount } = await supabase
          .from("chat_room_participants")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id);

        // Message count
        const { count: messageCount } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("is_deleted", false);

        // Vote count (for voting rooms)
        let voteCount = 0;
        if (room.room_type === "voting") {
          const { count } = await supabase
            .from("chat_votes")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.id);
          voteCount = count || 0;
        }

        // Last message
        const { data: lastMessage } = await supabase
          .from("chat_messages")
          .select(`
            message,
            created_at,
            members(full_name)
          `)
          .eq("room_id", room.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return {
          ...room,
          participant_count: participantCount || 0,
          message_count: messageCount || 0,
          vote_count: voteCount,
          last_message: lastMessage
            ? {
                message: lastMessage.message,
                created_at: lastMessage.created_at,
                sender_name: (lastMessage.members as any)?.full_name || "Unknown",
              }
            : null,
        };
      })
    );

    return NextResponse.json({ rooms: roomsWithStats });
  } catch (error: any) {
    console.error("Error fetching admin rooms:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
