//frontend/src/features/MeetWithFriends.jsx
import React, { useState, useContext } from "react";
import axios from "axios";
import { API } from "../shared/config";
import { AppContext } from "../shared/AppContext";
import { useTranslation } from "react-i18next";
import { FaExpand, FaCompress, FaTimes } from "react-icons/fa";

/* -----------------------------
   Participants Modal (UI only)
------------------------------ */
const ParticipantsModal = ({ isOpen, onClose, participants, roomName }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {`Participants in "${roomName}"`}
          </h3>
          <button onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {participants.length === 0 && (
          <p className="text-gray-500 text-center">
            {t("MeetWithFriends.noParticipants")}
          </p>
        )}

        {participants.map((p, idx) => (
          <div
            key={idx}
            className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2"
          >
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
              {p?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <span className="text-gray-900 dark:text-white">{p}</span>
          </div>
        ))}

        <div className="mt-4 text-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            {t("MeetWithFriends.Close")}
          </button>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------
   Main Component (UI shell)
------------------------------ */
export default function MeetWithFriends() {
  const { user, meetFullscreen, setMeetFullscreen } = useContext(AppContext);
  const { t } = useTranslation();

  /* -------- UI State -------- */
  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");

  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [selectedRoomName, setSelectedRoomName] = useState("");
  const [selectedRoomParticipants, setSelectedRoomParticipants] = useState([]);

  /* -------- UI-only handlers -------- */

  // Stub: will later call backend + mediasoup
  const joinRoom = (roomName) => {
    setJoinedRoom(roomName);
  };

  // Stub
  const leaveRoom = () => {
    setJoinedRoom(null);
    setMeetFullscreen(false);
  };

  // Stub
  const createRoom = async () => {
    if (!newRoomName.trim()) return;

    try {
      // UI-only: fake optimistic room
      setRooms((prev) => [
        ...prev,
        {
          name: newRoomName,
          participants: [],
          createdAt: Date.now(),
        },
      ]);
      setNewRoomName("");
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFullscreen = () => {
    setMeetFullscreen(!meetFullscreen);
  };

  const showParticipants = (room) => {
    setSelectedRoomName(room.name);
    setSelectedRoomParticipants(room.participants || []);
    setShowParticipantsModal(true);
  };

  /* -----------------------------
     Auth guard
  ------------------------------ */
  if (!user?.id) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <h2 className="text-white text-2xl">
          {t("MeetWithFriends.authRequired")}
        </h2>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative dark:bg-gray-900">
      <ParticipantsModal
        isOpen={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        participants={selectedRoomParticipants}
        roomName={selectedRoomName}
      />

      {!joinedRoom ? (
        /* -------- Lobby -------- */
        <div className="flex flex-col items-center p-8">
          <h2 className="text-3xl font-bold mb-6 dark:text-white">
            {t("MeetWithFriends.Title")}
          </h2>

          <div className="flex mb-6">
            <input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Enter room name"
              className="px-4 py-2 rounded-l"
            />
            <button
              onClick={createRoom}
              className="px-6 py-2 bg-green-600 text-white rounded-r"
            >
              {t("MeetWithFriends.createRoom")}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room, idx) => (
              <div
                key={idx}
                className="p-6 rounded-xl bg-blue-100 dark:bg-gray-800"
              >
                <h4 className="text-xl font-semibold mb-2">
                  {room.name}
                </h4>
                <p className="text-sm mb-2">
                  👥 {room.participants.length}
                </p>

                <button
                  onClick={() => showParticipants(room)}
                  className="text-sm mb-2 underline"
                >
                  {t("MeetWithFriends.viewParticipants")}
                </button>

                <button
                  onClick={() => joinRoom(room.name)}
                  className="block mt-4 px-4 py-2 bg-indigo-600 text-white rounded"
                >
                  {t("MeetWithFriends.joinCall")}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* -------- In-room -------- */
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center p-6 bg-gray-800">
            <h2 className="text-white text-2xl font-bold">
              {joinedRoom}
            </h2>

            <div className="flex gap-3">
              <button
                onClick={toggleFullscreen}
                className="px-4 py-2 bg-purple-600 text-white rounded"
              >
                {meetFullscreen ? <FaCompress /> : <FaExpand />}
              </button>

              <button
                onClick={leaveRoom}
                className="px-6 py-2 bg-gray-600 text-white rounded"
              >
                {t("MeetWithFriends.LeaveRoom")}
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center text-gray-400">
            Video grid placeholder
          </div>
        </div>
      )}
    </div>
  );
}
