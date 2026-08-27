// ============================================================================
// Chat Reactions API Routes
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// ══════════════════════════════════════════════════════════════════════════
// POST /api/chat/reactions
// Add a reaction to a message
// ══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();

    const { message_id, member_id, emoji } = body;

    if (!message_id || !member_id || !emoji) {
      return NextResponse.json(
        { error: "message_id, member_id, and emoji required" },
        { status: 400 }
      );
    }

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
        members(
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
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("message_id");
    const memberId = searchParams.get("member_id");
    const emoji = searchParams.get("emoji");

    if (!messageId || !memberId || !emoji) {
      return NextResponse.json(
        { error: "message_id, member_id, and emoji required" },
        { status: 400 }
      );
    }

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
