// ============================================================================
// Enhanced Chat Portal with Typing Indicators and Better Real-time
// ============================================================================

"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Users, ThumbsUp, Pin, MoreVertical, CheckCircle2, Clock, TrendingUp, Edit2, Trash2 } from "lucide-react";

interface Room {
  id: string;
  name: string;
  description: string;
  room_type: "chat" | "voting";
  access_level: string;
  participant_count: number;
  message_count: number;
  unread_count: number;
  vote_count?: number;
  last_message: {
    message: string;
    created_at: string;
    sender_name: string;
  } | null;
  my_permissions: {
    role: string;
    can_send: boolean;
    can_read: boolean;
    can_vote: boolean;
    is_muted: boolean;
  };
  voting_enabled?: boolean;
  voting_question?: string;
  voting_options?: string[];
  voting_ends_at?: string;
}

interface Message {
  id: string;
  message: string;
  sender_id: string;
  created_at: string;
  is_important: boolean;
  is_pinned: boolean;
  edited_at?: string;
  members: {
    id: string;
    full_name: string;
    department: string;
  };
  chat_message_reactions?: Array<{
    emoji: string;
    member_id: string;
    members: { full_name: string };
  }>;
}

interface VoteResults {
  room: {
    voting_question: string;
    voting_options: string[];
    voting_ends_at: string;
    allow_multiple: boolean;
    show_results: boolean;
    is_ended: boolean;
  };
  vote_counts: { [key: number]: number } | null;
  voters_by_option: { [key: number]: any[] } | null;
  total_votes: number;
  my_vote: any[];
  can_see_results: boolean;
}

export default function ChatPage({ memberId }: { memberId: string }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);
  const [selectedVotes, setSelectedVotes] = useState<number[]>([]);
  const [showVoting, setShowVoting] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollInterval = useRef<NodeJS.Timeout | undefined>(undefined);
  const typingTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastPollTime = useRef<string>(new Date().toISOString());

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id);
      if (selectedRoom.room_type === "voting" && selectedRoom.voting_enabled) {
        fetchVoteResults(selectedRoom.id);
      }

      // Enhanced polling with typing indicators
      pollInterval.current = setInterval(() => {
        pollForUpdates();
      }, 3000);

      return () => {
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
        }
      };
    }
  }, [selectedRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Typing indicator - send when user is typing
  useEffect(() => {
    if (newMessage && selectedRoom) {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }

      sendTypingIndicator();

      typingTimeout.current = setTimeout(() => {
        // Stop typing indicator after 3 seconds of no input
      }, 3000);
    }
  }, [newMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendTypingIndicator = async () => {
    if (!selectedRoom) return;

    try {
      await fetch("/api/chat/poll/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: selectedRoom.id,
          member_id: memberId,
        }),
      });
    } catch (error) {
      // Silent fail for typing indicators
    }
  };

  const pollForUpdates = async () => {
    if (!selectedRoom) return;

    try {
      const res = await fetch(
        `/api/chat/poll?member_id=${memberId}&room_id=${selectedRoom.id}&last_poll=${lastPollTime.current}`
      );
      const data = await res.json();

      // Update typing indicators
      if (data.typing_users) {
        setTypingUsers(data.typing_users.map((u: any) => u.name));
      }

      // Fetch new messages if available
      if (data.new_messages) {
        fetchMessages(selectedRoom.id);
      }

      // Update unread counts for all rooms
      if (data.room_updates && data.room_updates.length > 0) {
        setRooms((prevRooms) =>
          prevRooms.map((room) => {
            const update = data.room_updates.find(
              (u: any) => u.room_id === room.id
            );
            return update ? { ...room, unread_count: update.unread_count } : room;
          })
        );
      }

      lastPollTime.current = new Date().toISOString();
    } catch (error) {
      console.error("Error polling updates:", error);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch(`/api/chat/rooms?member_id=${memberId}`);
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (roomId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?room_id=${roomId}&member_id=${memberId}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setPinnedMessages(data.pinned_messages || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const fetchVoteResults = async (roomId: string) => {
    try {
      const res = await fetch(`/api/chat/votes?room_id=${roomId}&member_id=${memberId}`);
      const data = await res.json();
      setVoteResults(data);

      if (data.my_vote && data.my_vote.length > 0) {
        setSelectedVotes(data.my_vote.map((v: any) => v.option_index));
      }
    } catch (error) {
      console.error("Error fetching vote results:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || sending) return;

    const messageToSend = newMessage.trim();
    setSending(true);
    setNewMessage(""); // Clear immediately for better UX

    try {
      const res = await fetch("/api/chat/messages", {
        method: editingMessage ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingMessage
            ? {
                message_id: editingMessage.id,
                member_id: memberId,
                message: messageToSend,
              }
            : {
                room_id: selectedRoom.id,
                sender_id: memberId,
                message: messageToSend,
                message_type: "text",
              }
        ),
      });

      if (res.ok) {
        setEditingMessage(null);
        fetchMessages(selectedRoom.id);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to send message");
        setNewMessage(messageToSend); // Restore message on error
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
      setNewMessage(messageToSend);
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessage(message);
    setNewMessage(message.message);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Delete this message?")) return;

    try {
      const res = await fetch(
        `/api/chat/messages?message_id=${messageId}&member_id=${memberId}`,
        { method: "DELETE" }
      );

      if (res.ok && selectedRoom) {
        fetchMessages(selectedRoom.id);
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await fetch("/api/chat/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          member_id: memberId,
          emoji,
        }),
      });

      if (selectedRoom) {
        fetchMessages(selectedRoom.id);
      }
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const handleVote = async () => {
    if (!selectedRoom || selectedVotes.length === 0) return;

    try {
      for (const optionIndex of selectedVotes) {
        await fetch("/api/chat/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_id: selectedRoom.id,
            member_id: memberId,
            option_index: optionIndex,
            option_text: voteResults?.room.voting_options[optionIndex],
          }),
        });
      }

      alert("Vote submitted successfully!");
      fetchVoteResults(selectedRoom.id);
      setShowVoting(false);
    } catch (error) {
      console.error("Error submitting vote:", error);
      alert("Failed to submit vote");
    }
  };

  const toggleVoteSelection = (optionIndex: number) => {
    if (!voteResults?.room.allow_multiple) {
      setSelectedVotes([optionIndex]);
    } else {
      if (selectedVotes.includes(optionIndex)) {
        setSelectedVotes(selectedVotes.filter((i) => i !== optionIndex));
      } else {
        setSelectedVotes([...selectedVotes, optionIndex]);
      }
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chat rooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Rooms Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-500" />
            Chat Rooms
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No rooms available</p>
            </div>
          ) : (
            rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => {
                  setSelectedRoom(room);
                  setShowVoting(false);
                }}
                className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${
                  selectedRoom?.id === room.id
                    ? "bg-blue-50 border-l-4 border-l-blue-500"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    {room.room_type === "voting" ? (
                      <CheckCircle2 className="w-4 h-4 text-purple-500" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                    )}
                    {room.name}
                  </h3>
                  {room.unread_count > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                      {room.unread_count}
                    </span>
                  )}
                </div>

                {room.last_message && (
                  <p className="text-sm text-gray-600 truncate">
                    {room.last_message.sender_name}: {room.last_message.message}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {room.participant_count}
                  </span>
                  {room.room_type === "voting" && (
                    <span className="flex items-center gap-1 text-purple-600">
                      <CheckCircle2 className="w-3 h-3" />
                      {room.vote_count || 0} votes
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {selectedRoom ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {selectedRoom.room_type === "voting" ? (
                  <CheckCircle2 className="w-6 h-6 text-purple-500" />
                ) : (
                  <MessageSquare className="w-6 h-6 text-blue-500" />
                )}
                {selectedRoom.name}
              </h2>
              <p className="text-sm text-gray-600">{selectedRoom.description}</p>
              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {selectedRoom.participant_count} participants
                </span>
                {selectedRoom.my_permissions.is_muted && (
                  <span className="text-red-600">🔇 You are muted</span>
                )}
              </div>
            </div>

            {selectedRoom.room_type === "voting" &&
              selectedRoom.my_permissions.can_vote && (
                <button
                  onClick={() => setShowVoting(!showVoting)}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {showVoting ? "Hide Voting" : "Show Voting"}
                </button>
              )}
          </div>

          {/* Voting Panel */}
          {showVoting &&
            selectedRoom.room_type === "voting" &&
            voteResults && (
              <div className="bg-purple-50 border-b border-purple-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-purple-500" />
                  {voteResults.room.voting_question}
                </h3>

                {voteResults.room.voting_ends_at && (
                  <p className="text-sm text-gray-600 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Ends:{" "}
                    {new Date(voteResults.room.voting_ends_at).toLocaleString()}
                    {voteResults.room.is_ended && (
                      <span className="text-red-600 font-medium">
                        (Voting Ended)
                      </span>
                    )}
                  </p>
                )}

                <div className="space-y-3 mb-4">
                  {voteResults.room.voting_options.map((option, index) => {
                    const voteCount = voteResults.vote_counts?.[index] || 0;
                    const percentage =
                      voteResults.total_votes > 0
                        ? Math.round(
                            (voteCount / voteResults.total_votes) * 100
                          )
                        : 0;
                    const isSelected = selectedVotes.includes(index);
                    const hasVoted = voteResults.my_vote.some(
                      (v) => v.option_index === index
                    );

                    return (
                      <div key={index} className="relative">
                        <button
                          onClick={() =>
                            !voteResults.room.is_ended &&
                            toggleVoteSelection(index)
                          }
                          disabled={voteResults.room.is_ended}
                          className={`w-full p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? "border-purple-500 bg-purple-100"
                              : hasVoted
                              ? "border-green-500 bg-green-50"
                              : "border-gray-200 bg-white hover:border-purple-300"
                          } ${
                            voteResults.room.is_ended
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">
                              {option}
                            </span>
                            {hasVoted && (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            )}
                          </div>

                          {voteResults.can_see_results && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                                <span>{voteCount} votes</span>
                                <span>{percentage}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {!voteResults.room.is_ended &&
                  selectedRoom.my_permissions.can_vote && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleVote}
                        disabled={selectedVotes.length === 0}
                        className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        Submit Vote
                      </button>
                      {voteResults.my_vote.length > 0 && (
                        <button
                          onClick={async () => {
                            try {
                              await fetch(
                                `/api/chat/votes?room_id=${selectedRoom.id}&member_id=${memberId}`,
                                { method: "DELETE" }
                              );
                              fetchVoteResults(selectedRoom.id);
                              setSelectedVotes([]);
                            } catch (error) {
                              console.error("Error removing vote:", error);
                            }
                          }}
                          className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          Change Vote
                        </button>
                      )}
                    </div>
                  )}

                {voteResults.can_see_results && (
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Total votes: {voteResults.total_votes}
                    </p>
                  </div>
                )}
              </div>
            )}

          {/* Pinned Messages */}
          {pinnedMessages.length > 0 && (
            <div className="bg-yellow-50 border-b border-yellow-200 p-3">
              {pinnedMessages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2 text-sm">
                  <Pin className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div>
                    <span className="font-medium text-gray-900">
                      {msg.members.full_name}:
                    </span>
                    <span className="text-gray-700 ml-2">{msg.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isOwnMessage = msg.sender_id === memberId;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.is_important
                      ? "bg-yellow-50 border-l-4 border-yellow-500 pl-4 py-2 rounded"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold flex-shrink-0">
                      {msg.members.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900">
                          {msg.members.full_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {msg.members.department}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTime(msg.created_at)}
                        </span>
                        {msg.edited_at && (
                          <span className="text-xs text-gray-400 italic">
                            (edited)
                          </span>
                        )}
                        {msg.is_important && (
                          <span className="text-xs font-bold text-yellow-700">
                            ⚠ IMPORTANT
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-gray-800 break-words ${
                          msg.is_important ? "font-semibold" : ""
                        }`}
                      >
                        {msg.message}
                      </p>

                      {/* Reactions */}
                      {msg.chat_message_reactions &&
                        msg.chat_message_reactions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(
                              msg.chat_message_reactions.reduce(
                                (acc: any, r) => {
                                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                  return acc;
                                },
                                {}
                              )
                            ).map(([emoji, count]) => (
                              <span
                                key={emoji}
                                className="px-2 py-1 bg-gray-100 rounded-full text-sm cursor-pointer hover:bg-gray-200"
                                onClick={() => handleReaction(msg.id, emoji)}
                              >
                                {emoji} {count as number}
                              </span>
                            ))}
                          </div>
                        )}

                      {/* Quick reaction buttons */}
                      <div className="flex gap-2 mt-2 items-center">
                        {["👍", "❤️", "😊", "🎉"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className="text-lg hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                        {isOwnMessage && (
                          <>
                            <button
                              onClick={() => handleEditMessage(msg)}
                              className="ml-2 p-1 text-gray-500 hover:text-blue-600 transition-colors"
                              title="Edit message"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                              title="Delete message"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-500 italic">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></span>
                </div>
                <span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} is typing...`
                    : typingUsers.length === 2
                    ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
                    : `${typingUsers.length} people are typing...`}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          {selectedRoom.my_permissions.can_send &&
          !selectedRoom.my_permissions.is_muted ? (
            <div className="bg-white border-t border-gray-200 p-4">
              {editingMessage && (
                <div className="mb-2 flex items-center gap-2 text-sm text-blue-600">
                  <Edit2 className="w-4 h-4" />
                  <span>Editing message</span>
                  <button
                    onClick={() => {
                      setEditingMessage(null);
                      setNewMessage("");
                    }}
                    className="ml-auto text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleSendMessage()
                  }
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={sending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  {editingMessage ? "Update" : "Send"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 border-t border-gray-200 p-4 text-center text-gray-600">
              {selectedRoom.my_permissions.is_muted
                ? "You are muted in this room"
                : "You don't have permission to send messages"}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Select a room to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}
