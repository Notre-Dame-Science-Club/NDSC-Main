// ============================================================================
// Chat Messages API Routes
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// ══════════════════════════════════════════════════════════════════════════
// GET /api/chat/messages
// Fetch messages for a room
// ══════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("room_id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before"); // timestamp for pagination
    const memberId = searchParams.get("member_id");

    if (!roomId) {
      return NextResponse.json({ error: "room_id required" }, { status: 400 });
    }

    // Check if user has access to this room
    if (memberId) {
      const { data: participant } = await supabase
        .from("chat_room_participants")
        .select("can_read")
        .eq("room_id", roomId)
        .eq("member_id", memberId)
        .single();

      if (!participant?.can_read) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Build query
    let query = supabase
      .from("chat_messages")
      .select(`
        *,
        members!sender_id(
          id,
          full_name,
          department
        ),
        chat_message_reactions(
          emoji,
          member_id,
          members(full_name)
        )
      `)
      .eq("room_id", roomId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: messages, error } = await query;

    if (error) throw error;

    // Get pinned messages separately
    const { data: pinnedMessages } = await supabase
      .from("chat_messages")
      .select(`
        *,
        members!sender_id(
          id,
          full_name,
          department
        )
      `)
      .eq("room_id", roomId)
      .eq("is_deleted", false)
      .eq("is_pinned", true)
      .order("created_at", { ascending: false });

    // Update last_read_at for the user
    if (memberId) {
      await supabase
        .from("chat_room_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("member_id", memberId);
    }

    return NextResponse.json({
      messages: messages?.reverse() || [],
      pinned_messages: pinnedMessages || [],
    });
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/chat/messages
// Send a message
// ══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const body = await req.json();

    const {
      room_id,
      sender_id,
      message,
      message_type = "text",
      is_important = false,
      reply_to_id,
    } = body;

    if (!room_id || !sender_id || !message) {
      return NextResponse.json(
        { error: "room_id, sender_id, and message required" },
        { status: 400 }
      );
    }

    // Check if user can send messages in this room
    const { data: participant } = await supabase
      .from("chat_room_participants")
      .select("can_send, is_muted, role")
      .eq("room_id", room_id)
      .eq("member_id", sender_id)
      .single();

    if (!participant) {
      return NextResponse.json(
        { error: "You are not a participant in this room" },
        { status: 403 }
      );
    }

    if (participant.is_muted) {
      return NextResponse.json(
        { error: "You are muted in this room" },
        { status: 403 }
      );
    }

    if (!participant.can_send) {
      return NextResponse.json(
        { error: "You do not have permission to send messages" },
        { status: 403 }
      );
    }

    // Only admins and moderators can mark messages as important
    const canMarkImportant = ["admin", "moderator"].includes(participant.role);
    const finalIsImportant = canMarkImportant ? is_important : false;

    // Insert message
    const { data: newMessage, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id,
        sender_id,
        message,
        message_type,
        is_important: finalIsImportant,
        reply_to_id,
      })
      .select(`
        *,
        members!sender_id(
          id,
          full_name,
          department
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ message: newMessage });
  } catch (error: any) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PATCH /api/chat/messages
// Edit or update a message (pin, mark important, etc.)
// ══════════════════════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const body = await req.json();

    const { message_id, member_id, ...updates } = body;

    if (!message_id || !member_id) {
      return NextResponse.json(
        { error: "message_id and member_id required" },
        { status: 400 }
      );
    }

    // Get message and check permissions
    const { data: message } = await supabase
      .from("chat_messages")
      .select("*, room_id, sender_id")
      .eq("id", message_id)
      .single();

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Get participant role
    const { data: participant } = await supabase
      .from("chat_room_participants")
      .select("role")
      .eq("room_id", message.room_id)
      .eq("member_id", member_id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check permissions
    const isMessageOwner = message.sender_id === member_id;
    const canModerate = ["admin", "moderator"].includes(participant.role);

    // Only owner can edit message content
    if (updates.message && !isMessageOwner) {
      return NextResponse.json(
        { error: "You can only edit your own messages" },
        { status: 403 }
      );
    }

    // Only moderators can pin or mark as important
    if ((updates.is_pinned !== undefined || updates.is_important !== undefined) && !canModerate) {
      return NextResponse.json(
        { error: "Only moderators can pin or mark messages as important" },
        { status: 403 }
      );
    }

    // Update message
    const finalUpdates: any = {};
    if (updates.message && isMessageOwner) {
      finalUpdates.message = updates.message;
      finalUpdates.edited_at = new Date().toISOString();
    }
    if (updates.is_pinned !== undefined && canModerate) {
      finalUpdates.is_pinned = updates.is_pinned;
    }
    if (updates.is_important !== undefined && canModerate) {
      finalUpdates.is_important = updates.is_important;
    }
    if (updates.is_deleted !== undefined && (isMessageOwner || canModerate)) {
      finalUpdates.is_deleted = updates.is_deleted;
    }

    const { data: updatedMessage, error } = await supabase
      .from("chat_messages")
      .update(finalUpdates)
      .eq("id", message_id)
      .select(`
        *,
        members!sender_id(
          id,
          full_name,
          department
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ message: updatedMessage });
  } catch (error: any) {
    console.error("Error updating message:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// DELETE /api/chat/messages
// Delete a message (soft delete)
// ══════════════════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("message_id");
    const memberId = searchParams.get("member_id");

    if (!messageId || !memberId) {
      return NextResponse.json(
        { error: "message_id and member_id required" },
        { status: 400 }
      );
    }

    // Get message
    const { data: message } = await supabase
      .from("chat_messages")
      .select("sender_id, room_id")
      .eq("id", messageId)
      .single();

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check if user is message owner or moderator
    const isOwner = message.sender_id === memberId;

    if (!isOwner) {
      const { data: participant } = await supabase
        .from("chat_room_participants")
        .select("role")
        .eq("room_id", message.room_id)
        .eq("member_id", memberId)
        .single();

      const canModerate = participant && ["admin", "moderator"].includes(participant.role);

      if (!canModerate) {
        return NextResponse.json(
          { error: "You can only delete your own messages or be a moderator" },
          { status: 403 }
        );
      }
    }

    // Soft delete
    const { error } = await supabase
      .from("chat_messages")
      .update({ is_deleted: true })
      .eq("id", messageId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting message:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
