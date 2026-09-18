// ============================================================================
// Chat Voting API Routes
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// ══════════════════════════════════════════════════════════════════════════
// GET /api/chat/votes
// Get voting results for a room
// ══════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("room_id");
    const memberId = searchParams.get("member_id");

    if (!roomId) {
      return NextResponse.json({ error: "room_id required" }, { status: 400 });
    }

    // Get room voting settings
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (!room || !room.voting_enabled) {
      return NextResponse.json({ error: "Voting not enabled for this room" }, { status: 400 });
    }

    // Get all votes
    const { data: votes } = await supabase
      .from("chat_votes")
      .select(`
        *,
        members(
          id,
          full_name,
          department
        )
      `)
      .eq("room_id", roomId)
      .order("voted_at", { ascending: false });

    // Calculate vote counts per option
    const voteCounts: { [key: number]: number } = {};
    const votersByOption: { [key: number]: any[] } = {};

    (votes || []).forEach((vote) => {
      voteCounts[vote.option_index] = (voteCounts[vote.option_index] || 0) + 1;

      if (!room.anonymous_voting) {
        votersByOption[vote.option_index] = votersByOption[vote.option_index] || [];
        votersByOption[vote.option_index].push({
          member_id: vote.member_id,
          full_name: (vote.members as any)?.full_name,
          voted_at: vote.voted_at,
        });
      }
    });

    // Get user's vote if memberId provided
    let myVote = null;
    if (memberId) {
      const { data: userVote } = await supabase
        .from("chat_votes")
        .select("*")
        .eq("room_id", roomId)
        .eq("member_id", memberId);

      myVote = userVote || [];
    }

    // Check if user can see results
    const canSeeResults = room.show_results ||
                          (room.voting_ends_at && new Date(room.voting_ends_at) < new Date());

    return NextResponse.json({
      room: {
        voting_question: room.voting_question,
        voting_options: room.voting_options,
        voting_ends_at: room.voting_ends_at,
        allow_multiple: room.allow_multiple,
        show_results: room.show_results,
        anonymous_voting: room.anonymous_voting,
        is_ended: room.voting_ends_at && new Date(room.voting_ends_at) < new Date(),
      },
      vote_counts: canSeeResults ? voteCounts : null,
      voters_by_option: canSeeResults && !room.anonymous_voting ? votersByOption : null,
      total_votes: votes?.length || 0,
      my_vote: myVote,
      can_see_results: canSeeResults,
    });
  } catch (error: any) {
    console.error("Error fetching votes:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/chat/votes
// Submit a vote
// ══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const body = await req.json();

    const { room_id, member_id, option_index, option_text } = body;

    if (!room_id || !member_id || option_index === undefined) {
      return NextResponse.json(
        { error: "room_id, member_id, and option_index required" },
        { status: 400 }
      );
    }

    // Get room and check voting settings
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("id", room_id)
      .single();

    if (!room || !room.voting_enabled) {
      return NextResponse.json(
        { error: "Voting not enabled for this room" },
        { status: 400 }
      );
    }

    // Check if voting has ended
    if (room.voting_ends_at && new Date(room.voting_ends_at) < new Date()) {
      return NextResponse.json({ error: "Voting has ended" }, { status: 400 });
    }

    // Check if user has permission to vote
    const { data: participant } = await supabase
      .from("chat_room_participants")
      .select("can_vote")
      .eq("room_id", room_id)
      .eq("member_id", member_id)
      .single();

    if (!participant?.can_vote) {
      return NextResponse.json(
        { error: "You do not have permission to vote" },
        { status: 403 }
      );
    }

    // Check if user already voted
    const { data: existingVotes } = await supabase
      .from("chat_votes")
      .select("*")
      .eq("room_id", room_id)
      .eq("member_id", member_id);

    if (!room.allow_multiple && existingVotes && existingVotes.length > 0) {
      return NextResponse.json(
        { error: "You have already voted. Multiple votes not allowed." },
        { status: 400 }
      );
    }

    // Submit vote
    const { data: vote, error } = await supabase
      .from("chat_votes")
      .insert({
        room_id,
        member_id,
        option_index,
        option_text,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "You have already voted for this option" },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ vote });
  } catch (error: any) {
    console.error("Error submitting vote:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// DELETE /api/chat/votes
// Remove a vote (before voting ends)
// ══════════════════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("room_id");
    const memberId = searchParams.get("member_id");
    const optionIndex = searchParams.get("option_index");

    if (!roomId || !memberId) {
      return NextResponse.json(
        { error: "room_id and member_id required" },
        { status: 400 }
      );
    }

    // Check if voting has ended
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("voting_ends_at")
      .eq("id", roomId)
      .single();

    if (room?.voting_ends_at && new Date(room.voting_ends_at) < new Date()) {
      return NextResponse.json(
        { error: "Cannot change vote after voting has ended" },
        { status: 400 }
      );
    }

    // Delete vote(s)
    let query = supabase
      .from("chat_votes")
      .delete()
      .eq("room_id", roomId)
      .eq("member_id", memberId);

    if (optionIndex !== null) {
      query = query.eq("option_index", parseInt(optionIndex));
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing vote:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
