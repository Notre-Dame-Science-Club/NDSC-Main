// ============================================================================
// Admin Chat Management Page
// Comprehensive room management with permissions and member control
// ============================================================================

"use client";

import { useState, useEffect } from "react";
import { Plus, MessageSquare, Users, Settings, Trash2, Eye, EyeOff, Lock, Unlock, CheckCircle2, XCircle } from "lucide-react";
import { ParticipantManagementModal } from "./ParticipantManagementModal";

interface Room {
  id: string;
  name: string;
  description: string;
  room_type: "chat" | "voting";
  access_level: "all" | "members" | "executives" | "custom";
  is_active: boolean;
  voting_enabled: boolean;
  voting_question?: string;
  voting_options?: string[];
  voting_ends_at?: string;
  participant_count: number;
  message_count: number;
  created_at: string;
}

interface Member {
  id: string;
  full_name: string;
  email: string;
  department: string;
  is_verified: boolean;
  is_executive: boolean;
  is_organizer: boolean;
}

export default function AdminChatPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [showParticipantsModal, setShowParticipantsModal] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    room_type: "chat" as "chat" | "voting",
    access_level: "all" as "all" | "members" | "executives" | "custom",
    allow_anonymous_read: false,
    require_approval: false,
    voting_enabled: false,
    voting_question: "",
    voting_options: ["", ""],
    voting_ends_at: "",
    allow_multiple: false,
    show_results: false,
    anonymous_voting: false,
    selectedMembers: [] as string[],
    memberPermissions: {} as Record<string, { role: string; can_send: boolean; can_read: boolean; can_vote: boolean }>,
  });

  useEffect(() => {
    fetchRooms();
    fetchMembers();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/admin/chat/rooms");
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/admin/members");
      const data = await res.json();
      setMembers(data.members || []);
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const handleCreateRoom = async () => {
    try {
      // Get admin ID from session
      const adminRes = await fetch("/api/admin/session");
      const adminData = await adminRes.json();

      if (!adminData.admin) {
        alert("Not authenticated");
        return;
      }

      const payload = {
        ...formData,
        created_by: adminData.admin.id,
        voting_enabled: formData.room_type === "voting",
        participants: formData.access_level === "custom"
          ? formData.selectedMembers.map(memberId => ({
              member_id: memberId,
              ...(formData.memberPermissions[memberId] || {
                role: "participant",
                can_send: true,
                can_read: true,
                can_vote: formData.room_type === "voting",
              })
            }))
          : [],
      };

      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to create room");
        return;
      }

      alert("Room created successfully!");
      setShowCreateModal(false);
      resetForm();
      fetchRooms();
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Failed to create room");
    }
  };

  const handleUpdateRoom = async (roomId: string, updates: Partial<Room>) => {
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, ...updates }),
      });

      if (!res.ok) throw new Error("Failed to update room");

      alert("Room updated successfully!");
      fetchRooms();
    } catch (error) {
      console.error("Error updating room:", error);
      alert("Failed to update room");
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Are you sure you want to deactivate this room?")) return;

    try {
      const res = await fetch(`/api/chat/rooms?room_id=${roomId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete room");

      alert("Room deactivated successfully!");
      fetchRooms();
    } catch (error) {
      console.error("Error deleting room:", error);
      alert("Failed to delete room");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      room_type: "chat",
      access_level: "all",
      allow_anonymous_read: false,
      require_approval: false,
      voting_enabled: false,
      voting_question: "",
      voting_options: ["", ""],
      voting_ends_at: "",
      allow_multiple: false,
      show_results: false,
      anonymous_voting: false,
      selectedMembers: [],
      memberPermissions: {},
    });
  };

  const addVotingOption = () => {
    setFormData({
      ...formData,
      voting_options: [...formData.voting_options, ""],
    });
  };

  const updateVotingOption = (index: number, value: string) => {
    const newOptions = [...formData.voting_options];
    newOptions[index] = value;
    setFormData({ ...formData, voting_options: newOptions });
  };

  const removeVotingOption = (index: number) => {
    if (formData.voting_options.length <= 2) {
      alert("At least 2 options required");
      return;
    }
    const newOptions = formData.voting_options.filter((_, i) => i !== index);
    setFormData({ ...formData, voting_options: newOptions });
  };

  const toggleMemberSelection = (memberId: string) => {
    if (formData.selectedMembers.includes(memberId)) {
      setFormData({
        ...formData,
        selectedMembers: formData.selectedMembers.filter(id => id !== memberId),
      });
    } else {
      setFormData({
        ...formData,
        selectedMembers: [...formData.selectedMembers, memberId],
        memberPermissions: {
          ...formData.memberPermissions,
          [memberId]: {
            role: "participant",
            can_send: true,
            can_read: true,
            can_vote: formData.room_type === "voting",
          },
        },
      });
    }
  };

  const updateMemberPermission = (memberId: string, field: string, value: any) => {
    setFormData({
      ...formData,
      memberPermissions: {
        ...formData.memberPermissions,
        [memberId]: {
          ...formData.memberPermissions[memberId],
          [field]: value,
        },
      },
    });
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-blue-500" />
              Chat Management
            </h1>
            <p className="text-gray-600 mt-1">Manage chat rooms, permissions, and voting</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Room
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Rooms</p>
                <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Chat Rooms</p>
                <p className="text-2xl font-bold text-gray-900">
                  {rooms.filter(r => r.room_type === "chat").length}
                </p>
              </div>
              <MessageSquare className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Voting Rooms</p>
                <p className="text-2xl font-bold text-gray-900">
                  {rooms.filter(r => r.room_type === "voting").length}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Rooms</p>
                <p className="text-2xl font-bold text-gray-900">
                  {rooms.filter(r => r.is_active).length}
                </p>
              </div>
              <Eye className="w-8 h-8 text-cyan-500" />
            </div>
          </div>
        </div>

        {/* Rooms List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">All Rooms</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {rooms.length === 0 ? (
              <div className="p-12 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No rooms yet. Create your first room!</p>
              </div>
            ) : (
              rooms.map(room => (
                <div key={room.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{room.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          room.room_type === "voting"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {room.room_type === "voting" ? "Voting" : "Chat"}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          room.access_level === "all"
                            ? "bg-green-100 text-green-700"
                            : room.access_level === "executives"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {room.access_level}
                        </span>
                        {!room.is_active && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{room.description}</p>
                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {room.participant_count} participants
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          {room.message_count} messages
                        </span>
                        <span className="text-xs">
                          Created {new Date(room.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowParticipantsModal(room.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Manage participants"
                      >
                        <Users className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleUpdateRoom(room.id, { is_active: !room.is_active })}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title={room.is_active ? "Deactivate" : "Activate"}
                      >
                        {room.is_active ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => setEditingRoom(room)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Edit room"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete room"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Participant Management Modal */}
        {showParticipantsModal && (
          <ParticipantManagementModal
            roomId={showParticipantsModal}
            onClose={() => setShowParticipantsModal(null)}
            onUpdate={fetchRooms}
          />
        )}

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-3xl w-full my-8">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Create New Room</h2>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., General Discussion"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Brief description of the room"
                    />
                  </div>

                  {/* Room Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Type *
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setFormData({ ...formData, room_type: "chat" })}
                        className={`p-4 border-2 rounded-lg transition-colors ${
                          formData.room_type === "chat"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <MessageSquare className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                        <p className="font-medium">Chat Room</p>
                        <p className="text-xs text-gray-500 mt-1">Regular messaging</p>
                      </button>
                      <button
                        onClick={() => setFormData({ ...formData, room_type: "voting" })}
                        className={`p-4 border-2 rounded-lg transition-colors ${
                          formData.room_type === "voting"
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                        <p className="font-medium">Voting Room</p>
                        <p className="text-xs text-gray-500 mt-1">Poll & voting</p>
                      </button>
                    </div>
                  </div>

                  {/* Access Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Level *
                    </label>
                    <select
                      value={formData.access_level}
                      onChange={(e) => setFormData({ ...formData, access_level: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All (Anyone with account)</option>
                      <option value="members">Verified Members Only</option>
                      <option value="executives">Executives Only</option>
                      <option value="custom">Custom (Select specific members)</option>
                    </select>
                  </div>

                  {/* Voting Settings */}
                  {formData.room_type === "voting" && (
                    <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h3 className="font-semibold text-gray-900">Voting Settings</h3>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Voting Question *
                        </label>
                        <input
                          type="text"
                          value={formData.voting_question}
                          onChange={(e) => setFormData({ ...formData, voting_question: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          placeholder="What should we vote on?"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Voting Options * (minimum 2)
                        </label>
                        <div className="space-y-2">
                          {formData.voting_options.map((option, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => updateVotingOption(index, e.target.value)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                                placeholder={`Option ${index + 1}`}
                              />
                              {formData.voting_options.length > 2 && (
                                <button
                                  onClick={() => removeVotingOption(index)}
                                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={addVotingOption}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                          + Add Option
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Voting Ends At
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.voting_ends_at}
                          onChange={(e) => setFormData({ ...formData, voting_ends_at: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.allow_multiple}
                            onChange={(e) => setFormData({ ...formData, allow_multiple: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">Allow multiple selections</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.show_results}
                            onChange={(e) => setFormData({ ...formData, show_results: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">Show live results</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.anonymous_voting}
                            onChange={(e) => setFormData({ ...formData, anonymous_voting: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">Anonymous voting</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Custom Member Selection */}
                  {formData.access_level === "custom" && (
                    <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <h3 className="font-semibold text-gray-900">Select Members & Set Permissions</h3>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {members.map(member => (
                          <div key={member.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                            <input
                              type="checkbox"
                              checked={formData.selectedMembers.includes(member.id)}
                              onChange={() => toggleMemberSelection(member.id)}
                              className="rounded"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{member.full_name}</p>
                              <p className="text-xs text-gray-500">{member.department}</p>
                            </div>
                            {formData.selectedMembers.includes(member.id) && (
                              <div className="flex gap-2">
                                <select
                                  value={formData.memberPermissions[member.id]?.role || "participant"}
                                  onChange={(e) => updateMemberPermission(member.id, "role", e.target.value)}
                                  className="text-xs px-2 py-1 border border-gray-300 rounded"
                                >
                                  <option value="admin">Admin</option>
                                  <option value="moderator">Moderator</option>
                                  <option value="participant">Participant</option>
                                  <option value="viewer">Viewer</option>
                                  {formData.room_type === "voting" && <option value="voter">Voter</option>}
                                </select>
                                <label className="flex items-center gap-1 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={formData.memberPermissions[member.id]?.can_send !== false}
                                    onChange={(e) => updateMemberPermission(member.id, "can_send", e.target.checked)}
                                    className="rounded"
                                  />
                                  Send
                                </label>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other Settings */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.allow_anonymous_read}
                        onChange={(e) => setFormData({ ...formData, allow_anonymous_read: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">Allow anonymous read (public announcements)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.require_approval}
                        onChange={(e) => setFormData({ ...formData, require_approval: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">Require approval to join</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRoom}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Create Room
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
