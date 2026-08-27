// ============================================================================
// Participant Management Modal Component
// Manage room participants and permissions
// ============================================================================

"use client";

import { useState, useEffect } from "react";
import { X, Shield, MessageSquare, Eye, CheckCircle2, Ban, UserX } from "lucide-react";

interface Participant {
  id: string;
  member_id: string;
  role: string;
  can_send: boolean;
  can_read: boolean;
  can_vote: boolean;
  is_muted: boolean;
  joined_at: string;
  members: {
    full_name: string;
    department: string;
    is_executive: boolean;
    is_organizer: boolean;
  };
}

interface Props {
  roomId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function ParticipantManagementModal({ roomId, onClose, onUpdate }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchParticipants();
  }, [roomId]);

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/chat/participants?room_id=${roomId}`);
      const data = await res.json();
      setParticipants(data.participants || []);
    } catch (error) {
      console.error("Error fetching participants:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (
    memberId: string,
    field: string,
    value: any
  ) => {
    setUpdating(memberId);
    try {
      const res = await fetch("/api/chat/participants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          member_id: memberId,
          [field]: value,
        }),
      });

      if (res.ok) {
        await fetchParticipants();
        onUpdate();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update permission");
      }
    } catch (error) {
      console.error("Error updating permission:", error);
      alert("Failed to update permission");
    } finally {
      setUpdating(null);
    }
  };

  const removeParticipant = async (memberId: string) => {
    if (!confirm("Remove this participant from the room?")) return;

    try {
      const res = await fetch(
        `/api/chat/participants?room_id=${roomId}&member_id=${memberId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        await fetchParticipants();
        onUpdate();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to remove participant");
      }
    } catch (error) {
      console.error("Error removing participant:", error);
      alert("Failed to remove participant");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-700";
      case "moderator":
        return "bg-orange-100 text-orange-700";
      case "participant":
        return "bg-blue-100 text-blue-700";
      case "viewer":
        return "bg-gray-100 text-gray-700";
      case "voter":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="w-4 h-4" />;
      case "moderator":
        return <Shield className="w-4 h-4" />;
      case "participant":
        return <MessageSquare className="w-4 h-4" />;
      case "viewer":
        return <Eye className="w-4 h-4" />;
      case "voter":
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Manage Participants ({participants.length})
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No participants yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
                          {participant.members.full_name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            {participant.members.full_name}
                            {participant.members.is_executive && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                Executive
                              </span>
                            )}
                            {participant.members.is_organizer && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                Organizer
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {participant.members.department}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getRoleBadgeColor(
                            participant.role
                          )}`}
                        >
                          {getRoleIcon(participant.role)}
                          {participant.role}
                        </span>
                        {participant.is_muted && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                            <Ban className="w-3 h-3" />
                            Muted
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500">
                        Joined {new Date(participant.joined_at).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={() => removeParticipant(participant.member_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove participant"
                    >
                      <UserX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Permissions Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg">
                    {/* Role Selector */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Role
                      </label>
                      <select
                        value={participant.role}
                        onChange={(e) =>
                          updatePermission(
                            participant.member_id,
                            "role",
                            e.target.value
                          )
                        }
                        disabled={updating === participant.member_id}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="moderator">Moderator</option>
                        <option value="participant">Participant</option>
                        <option value="viewer">Viewer</option>
                        <option value="voter">Voter</option>
                      </select>
                    </div>

                    {/* Can Send */}
                    <div className="flex flex-col">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Can Send
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={participant.can_send}
                          onChange={(e) =>
                            updatePermission(
                              participant.member_id,
                              "can_send",
                              e.target.checked
                            )
                          }
                          disabled={updating === participant.member_id}
                          className="rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {participant.can_send ? "Yes" : "No"}
                        </span>
                      </label>
                    </div>

                    {/* Can Read */}
                    <div className="flex flex-col">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Can Read
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={participant.can_read}
                          onChange={(e) =>
                            updatePermission(
                              participant.member_id,
                              "can_read",
                              e.target.checked
                            )
                          }
                          disabled={updating === participant.member_id}
                          className="rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {participant.can_read ? "Yes" : "No"}
                        </span>
                      </label>
                    </div>

                    {/* Is Muted */}
                    <div className="flex flex-col">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Muted
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={participant.is_muted}
                          onChange={(e) =>
                            updatePermission(
                              participant.member_id,
                              "is_muted",
                              e.target.checked
                            )
                          }
                          disabled={updating === participant.member_id}
                          className="rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {participant.is_muted ? "Yes" : "No"}
                        </span>
                      </label>
                    </div>
                  </div>

                  {updating === participant.member_id && (
                    <div className="mt-2 text-xs text-blue-600 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                      Updating...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
