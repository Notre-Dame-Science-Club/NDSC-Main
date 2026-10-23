// ============================================================================
// Chat Reactions API Routes
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCallerId } from "@/lib/server/requireUser";

// Identity comes from the bearer token only; any member_id in the query/body is ignored.

// The caller must be a participant of the room that owns the message. Returns an error
// response to send back, or null when the caller is allowed.
async function requireMessageParticipant(messageId: string, memberId: string) {
  const { data: msg } = await supabaseAdmin
    .from("chat_messages")
    .select("room_id")
    .eq("id", messageId)
    .single();

  if (!msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const { data: participant } = await supabaseAdmin
    .from("chat_room_participants")
    .select("can_read")
    .eq("room_id", msg.room_id)
    .eq("member_id", memberId)
    .single();

  if (!participant?.can_read) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/chat/reactions
// Add a reaction to a message
// ══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;

    const member_id = await getCallerId(req);
    if (!member_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const { message_id, emoji } = body;

    if (!message_id || !emoji) {
      return NextResponse.json(
        { error: "message_id and emoji required" },
        { status: 400 }
      );
    }

    const denied = await requireMessageParticipant(message_id, member_id);
    if (denied) return denied;

    // Add reaction
    const { data: reaction, error } = await supabase
      .from("chat_message_reactions")
      .insert({
        message_id,
        member_id,
        emoji,
      })
      .select(`
        *,
        members:users(
          id,
          full_name
        )
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        // Already reacted, remove it (toggle)
        await supabase
          .from("chat_message_reactions")
          .delete()
          .eq("message_id", message_id)
          .eq("member_id", member_id)
          .eq("emoji", emoji);

        return NextResponse.json({ success: true, action: "removed" });
      }
      throw error;
    }

    return NextResponse.json({ reaction, action: "added" });
  } catch (error: any) {
    console.error("Error adding reaction:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// DELETE /api/chat/reactions
// Remove a reaction
// ══════════════════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("message_id");
    const emoji = searchParams.get("emoji");

    const memberId = await getCallerId(req);
    if (!memberId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!messageId || !emoji) {
      return NextResponse.json(
        { error: "message_id and emoji required" },
        { status: 400 }
      );
    }

    const denied = await requireMessageParticipant(messageId, memberId);
    if (denied) return denied;

    const { error } = await supabase
      .from("chat_message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("member_id", memberId)
      .eq("emoji", emoji);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing reaction:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
