//frontend/src/components/RoomCreateModal.jsx
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

// ─────────────────────────────────────────────────────────────
//  RoomCreateModal — Used in MeetWithFriends
// ─────────────────────────────────────────────────────────────
export default function RoomCreateModal({
  isOpen,
  onClose,
  onCreate,
  isAdmin = false,
}) {
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [type, setType] = useState("temporary"); // temporary | permanent
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setMaxParticipants(8);
      setType("temporary");
      setError(null);
    }
  }, [isOpen]);

  const handleCreate = () => {
    if (!name.trim()) {
      setError(t("MeetWithFriends.roomNameRequired", "Room name is required"));
      return;
    }

    const slots = Number(maxParticipants);
    if (!Number.isInteger(slots) || slots <= 0 || slots > 50) {
      setError(t("MeetWithFriends.invalidSlots", "Slots must be between 1 and 50"));
      return;
    }

    setError(null);

    onCreate({
      name: name.trim(),
      maxParticipants: slots,
      type,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-[90%] shadow-2xl">
        <h2 className="text-2xl font-semibold text-center mb-6 text-blue-700 dark:text-blue-300">
          {t("MeetWithFriends.createRoomTitle", "Create New Room")}
        </h2>

        <div className="flex flex-col gap-5 text-gray-900 dark:text-gray-100">

          {/* Room Name */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              {t("MeetWithFriends.roomName", "Room Name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded p-2 dark:bg-gray-800 dark:border-gray-700"
              placeholder={t("MeetWithFriends.roomNamePlaceholder", "Enter room name")}
            />
          </div>

          {/* Slots */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              {t("MeetWithFriends.maxParticipants", "Max Participants")}
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              className="w-full border rounded p-2 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          {/* Room Type (Admin Only Permanent) */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-semibold mb-2">
                {t("MeetWithFriends.roomType", "Room Type")}
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setType("temporary")}
                  className={`px-3 py-1 text-sm rounded border transition-colors ${
                    type === "temporary"
                      ? "bg-blue-600 text-white border-blue-700"
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {t("MeetWithFriends.temporary", "Temporary")}
                </button>

                <button
                  type="button"
                  onClick={() => setType("permanent")}
                  className={`px-3 py-1 text-sm rounded border transition-colors ${
                    type === "permanent"
                      ? "bg-blue-600 text-white border-blue-700"
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {t("MeetWithFriends.permanent", "Permanent")}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 text-center">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-400 hover:bg-gray-300 px-4 py-2 rounded text-white"
          >
            {t("Common.cancel", "Cancel")}
          </button>
          <button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
          >
            {t("MeetWithFriends.createRoom", "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}