// ============================================================================
// Chat System API Routes
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// ══════════════════════════════════════════════════════════════════════════
// GET /api/chat/rooms
// Fetch all rooms accessible to the current user
// ══════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("member_id");
    const roomType = searchParams.get("type"); // 'chat' | 'voting'

    if (!memberId) {
      return NextResponse.json({ error: "member_id required" }, { status: 400 });
    }

    // Get member info
    const { data: member } = await supabase
      .from("members")
      .select("id, is_verified, is_executive")
      .eq("id", memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Build room query based on access level
    let roomsQuery = supabase
      .from("chat_rooms")
      .select(`
        *,
        chat_room_participants!inner(
          id,
          member_id,
          role,
          can_send,
          can_read,
          can_vote,
          is_muted,
          last_read_at
        )
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (roomType) {
      roomsQuery = roomsQuery.eq("room_type", roomType);
    }

    // Get rooms where user is a participant
    const { data: participantRooms } = await roomsQuery
      .eq("chat_room_participants.member_id", memberId);

    // Get rooms with 'all' access level (if member has account)
    const { data: allAccessRooms } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("is_active", true)
      .eq("access_level", "all")
      .order("created_at", { ascending: false });

    // Get rooms with 'members' access level (if verified)
    let memberAccessRooms: any[] = [];
    if (member.is_verified) {
      const { data } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("is_active", true)
        .eq("access_level", "members")
        .order("created_at", { ascending: false });
      memberAccessRooms = data || [];
    }

    // Get rooms with 'executives' access level (if executive)
    let executiveAccessRooms: any[] = [];
    if (member.is_executive) {
      const { data } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("is_active", true)
        .eq("access_level", "executives")
        .order("created_at", { ascending: false });
      executiveAccessRooms = data || [];
    }

    // Merge and deduplicate rooms
    const allRooms = [
      ...(participantRooms || []),
      ...(allAccessRooms || []),
      ...memberAccessRooms,
      ...executiveAccessRooms,
    ];

    const uniqueRooms = Array.from(
      new Map(allRooms.map((room) => [room.id, room])).values()
    );

    // Fetch stats for each room
    const roomsWithStats = await Promise.all(
      uniqueRooms.map(async (room) => {
        // Get participant count
        const { count: participantCount } = await supabase
          .from("chat_room_participants")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id);

        // Get message count
        const { count: messageCount } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("is_deleted", false);

        // Get last message
        const { data: lastMessage } = await supabase
          .from("chat_messages")
          .select(`
            message,
            created_at,
            sender_id,
            members(full_name)
          `)
          .eq("room_id", room.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Get unread count for this user
        const participant = Array.isArray(room.chat_room_participants)
          ? room.chat_room_participants.find((p: any) => p.member_id === memberId)
          : null;

        let unreadCount = 0;
        if (participant?.last_read_at) {
          const { count } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.id)
            .eq("is_deleted", false)
            .gt("created_at", participant.last_read_at);
          unreadCount = count || 0;
        } else if (messageCount) {
          unreadCount = messageCount;
        }

        // Get vote count for voting rooms
        let voteCount = 0;
        if (room.room_type === "voting") {
          const { count } = await supabase
            .from("chat_votes")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.id);
          voteCount = count || 0;
        }

        return {
          ...room,
          participant_count: participantCount || 0,
          message_count: messageCount || 0,
          unread_count: unreadCount,
          vote_count: voteCount,
          last_message: lastMessage
            ? {
                message: lastMessage.message,
                created_at: lastMessage.created_at,
                sender_name: (lastMessage.members as any)?.full_name || "Unknown",
              }
            : null,
          my_permissions: participant || {
            can_send: true,
            can_read: true,
            can_vote: room.room_type === "voting",
            is_muted: false,
            role: "participant",
          },
        };
      })
    );

    return NextResponse.json({ rooms: roomsWithStats });
  } catch (error: any) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/chat/rooms
// Create a new chat room (admin only)
// ══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();

    const {
      name,
      description,
      room_type = "chat",
      access_level = "all",
      allow_anonymous_read = false,
      require_approval = false,
      voting_enabled = false,
      voting_question,
      voting_options = [],
      voting_ends_at,
      allow_multiple = false,
      show_results = false,
      anonymous_voting = false,
      created_by,
      participants = [], // Array of { member_id, role, can_send, can_read, can_vote }
    } = body;

    if (!name || !created_by) {
      return NextResponse.json(
        { error: "name and created_by required" },
        { status: 400 }
      );
    }

    // Create room
    const { data: room, error: roomError } = await supabase
      .from("chat_rooms")
      .insert({
        name,
        description,
        room_type,
        access_level,
        allow_anonymous_read,
        require_approval,
        voting_enabled,
        voting_question,
        voting_options,
        voting_ends_at,
        allow_multiple,
        show_results,
        anonymous_voting,
        created_by,
        is_active: true,
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // Add creator as admin
    await supabase.from("chat_room_participants").insert({
      room_id: room.id,
      member_id: created_by,
      role: "admin",
      can_send: true,
      can_read: true,
      can_vote: room_type === "voting",
      is_muted: false,
    });

    // Add participants if specified
    if (participants.length > 0) {
      const participantRecords = participants.map((p: any) => ({
        room_id: room.id,
        member_id: p.member_id,
        role: p.role || "participant",
        can_send: p.can_send !== undefined ? p.can_send : true,
        can_read: p.can_read !== undefined ? p.can_read : true,
        can_vote: p.can_vote !== undefined ? p.can_vote : room_type === "voting",
        is_muted: p.is_muted || false,
      }));

      await supabase.from("chat_room_participants").insert(participantRecords);
    }

    return NextResponse.json({ room });
  } catch (error: any) {
    console.error("Error creating room:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PATCH /api/chat/rooms
// Update room settings
// ══════════════════════════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();
    const { room_id, ...updates } = body;

    if (!room_id) {
      return NextResponse.json({ error: "room_id required" }, { status: 400 });
    }

    const { data: room, error } = await supabase
      .from("chat_rooms")
      .update(updates)
      .eq("id", room_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ room });
  } catch (error: any) {
    console.error("Error updating room:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// DELETE /api/chat/rooms
// Deactivate a room
// ══════════════════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("room_id");

    if (!roomId) {
      return NextResponse.json({ error: "room_id required" }, { status: 400 });
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from("chat_rooms")
      .update({ is_active: false })
      .eq("id", roomId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting room:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
