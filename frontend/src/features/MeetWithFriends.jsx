//frontent/src/features/MeetWithFriends.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import { api } from "../shared/config";
import { AppContext } from "../shared/AppContext";
import { useTranslation } from "react-i18next";
import { FaExpand, FaCompress, FaUsers, FaTimes } from "react-icons/fa";
import { acquireMeetSocket, releaseMeetSocket } from "./meetSocket";

/* -----------------------------
   Participants Modal
------------------------------ */
const ParticipantsModal = ({ isOpen, onClose, participants, roomName }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const safeParticipants = Array.isArray(participants) ? participants : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {`Participants in "${roomName || ""}"`}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {safeParticipants.length > 0 ? (
          safeParticipants.map((p, idx) => (
            <div
              key={p?.userId || `${idx}`}
              className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {(p?.fullName?.charAt(0) || "U").toUpperCase()}
              </div>
              <span className="text-gray-900 dark:text-white">
                {p?.fullName || `User ${String(p?.userId || "").slice(-4)}`}
              </span>
            </div>
          ))
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            {t("MeetWithFriends.noParticipants")}
          </p>
        )}

        <div className="mt-4 text-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("MeetWithFriends.Close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MeetWithFriends() {
  const { user, meetFullscreen, setMeetFullscreen } = useContext(AppContext);
  const { t } = useTranslation();

  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [newRoomName, setNewRoomName] = useState("");

  const [socketConnected, setSocketConnected] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [notice, setNotice] = useState(null);

  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [selectedRoomParticipants, setSelectedRoomParticipants] = useState([]);
  const [selectedRoomName, setSelectedRoomName] = useState("");

  const socketRef = useRef(null);
  const joinedRoomIdRef = useRef(null);
  const pendingJoinRoomIdRef = useRef(null);

  const mountedRef = useRef(false);

  const toggleFullscreen = () => setMeetFullscreen(!meetFullscreen);

  const openParticipants = (roomName, list) => {
    setSelectedRoomName(roomName || "");
    setSelectedRoomParticipants(Array.isArray(list) ? list : []);
    setShowParticipantsModal(true);
  };
  const closeParticipants = () => setShowParticipantsModal(false);

  const extractRoomParticipantsList = (room) => {
    return (
      room?.participants ||
      room?.participantDetails ||
      room?.participantsDetails ||
      room?.roster ||
      []
    );
  };

  const computeCapacity = (room) => {
    const cap = room?.capacity ?? room?.maxParticipants ?? room?.limit;
    return Number.isFinite(Number(cap)) ? Number(cap) : undefined;
  };

  const fetchRooms = async () => {
    try {
      const data = await api.get("/rooms");
      const list = Array.isArray(data) ? data : [];
      if (mountedRef.current) setRooms(list);
      return list;
    } catch (e) {
      console.error("❌ Error fetching rooms:", e);
      if (mountedRef.current) setRooms([]);
      return [];
    }
  };

  const safeEmitJoin = (roomId) => {
    const s = socketRef.current;
    if (!s || !roomId) return;

    if (!s.connected) {
      pendingJoinRoomIdRef.current = roomId;
      return;
    }

    pendingJoinRoomIdRef.current = null;
    try { s.emit("rtc:join-room", { roomId }); } catch {}
  };

  const safeEmitLeave = () => {
    const s = socketRef.current;
    if (!s) return;
    pendingJoinRoomIdRef.current = null;
    try { s.emit("rtc:leave-room"); } catch {}
  };

  /* -----------------------------
     Socket lifecycle (feature-scoped)
  ------------------------------ */
  useEffect(() => {
    if (!user?.id) return;

    mountedRef.current = true;

    // Reset UI on mount
    setSocketConnected(false);
    setSocketReady(false);
    setNotice(null);
    setParticipants([]);

    const s = acquireMeetSocket();
    socketRef.current = s;

    // If socket is already connected (e.g. StrictMode re-mount), reflect that immediately
    if (s.connected) {
      setSocketConnected(true);
      setSocketReady(true);
    }

    const onConnect = () => {
      if (!mountedRef.current) return;
      setSocketConnected(true);
      setSocketReady(true);
      setNotice(null);

      const roomId = pendingJoinRoomIdRef.current || joinedRoomIdRef.current;
      if (roomId) safeEmitJoin(roomId);
    };

    const onDisconnect = () => {
      if (!mountedRef.current) return;
      setSocketConnected(false);
      setSocketReady(false);
      setParticipants([]);
    };

    const onReady = () => {
      if (!mountedRef.current) return;
      setSocketReady(true);
      const roomId = pendingJoinRoomIdRef.current || joinedRoomIdRef.current;
      if (roomId) safeEmitJoin(roomId);
    };

    const onRoomsChanged = () => fetchRooms();

    const onRoster = (roster) => {
      if (!mountedRef.current) return;
      setParticipants(Array.isArray(roster?.participants) ? roster.participants : []);
    };

    const onUserJoined = ({ userId, fullName }) => {
      if (!mountedRef.current) return;
      setParticipants((prev) => {
        if (prev.some((p) => p.userId === userId)) return prev;
        return [...prev, { userId, fullName }];
      });
    };

    const onUserLeft = ({ userId }) => {
      if (!mountedRef.current) return;
      setParticipants((prev) => prev.filter((p) => p.userId !== userId));
    };

    const onKicked = (payload) => {
      if (!mountedRef.current) return;
      const reason = payload?.reason || "You were signed in elsewhere.";
      setNotice(reason);

      pendingJoinRoomIdRef.current = null;
      joinedRoomIdRef.current = null;
      setJoinedRoom(null);
      setParticipants([]);
      setMeetFullscreen(false);

      fetchRooms();
    };

    const onRoomDeleted = (payload) => {
      if (!mountedRef.current) return;
      const deletedId = payload?.roomId || payload?._id || payload?.id;
      if (deletedId && joinedRoomIdRef.current === deletedId) {
        setNotice("This room was deleted.");
        pendingJoinRoomIdRef.current = null;
        joinedRoomIdRef.current = null;
        setJoinedRoom(null);
        setParticipants([]);
        setMeetFullscreen(false);
      }
      fetchRooms();
    };

    const onConnectError = (err) => {
      if (!mountedRef.current) return;
      setSocketConnected(false);
      setSocketReady(false);
      setNotice(err?.message || "Socket connect error");
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("rtc:ready", onReady);
    s.on("rooms:changed", onRoomsChanged);
    s.on("rtc:roster", onRoster);
    s.on("rtc:user-joined", onUserJoined);
    s.on("rtc:user-left", onUserLeft);
    s.on("rtc:kicked", onKicked);
    s.on("rtc:room-deleted", onRoomDeleted);
    s.on("connect_error", onConnectError);

    fetchRooms();

    return () => {
      mountedRef.current = false;

      // Capture current room at unmount time
      const roomId = joinedRoomIdRef.current;

      // Detach listeners for THIS component instance (socket may survive StrictMode)
      try {
        s.off("connect", onConnect);
        s.off("disconnect", onDisconnect);
        s.off("rtc:ready", onReady);
        s.off("rooms:changed", onRoomsChanged);
        s.off("rtc:roster", onRoster);
        s.off("rtc:user-joined", onUserJoined);
        s.off("rtc:user-left", onUserLeft);
        s.off("rtc:kicked", onKicked);
        s.off("rtc:room-deleted", onRoomDeleted);
        s.off("connect_error", onConnectError);
      } catch {}

      // Only when the feature truly goes away (no immediate remount) we teardown socket.
      // This prevents StrictMode from "leaving" on the fake unmount.
      releaseMeetSocket((sock) => {
        if (roomId && sock?.connected) {
          try { sock.emit("rtc:leave-room"); } catch {}
          try { api.post("/rooms/leave").catch(() => {}); } catch {}
        }
      });

      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* -----------------------------
     Room actions
  ------------------------------ */
  const createRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return;

    setNotice(null);

    try {
      const createdRes = await api.post("/rooms/create", { name });
      const createdRoom = createdRes?.room || createdRes;
      const roomId = createdRoom?._id;

      setNewRoomName("");

      if (roomId) {
        joinedRoomIdRef.current = roomId;
        setJoinedRoom(createdRoom);
        setParticipants([]);
        await fetchRooms();
      } else {
        await fetchRooms();
      }
    } catch (e) {
      console.error("❌ Failed to create room:", e);
      const msg = e?.response?.data?.error || e?.message || "Failed to create room";
      setNotice(msg);
    }
  };

  const joinRoom = async (room) => {
    if (!room?._id) return;
    setNotice(null);

    try {
      await api.post(`/rooms/join/${room._id}`);

      joinedRoomIdRef.current = room._id;
      setJoinedRoom(room);
      setParticipants([]);
      await fetchRooms();
    } catch (e) {
      console.error("❌ Failed to join room:", e);
      const msg = e?.response?.data?.error || e?.message || "Could not join room";
      setNotice(msg);
    }
  };

  const leaveRoom = async () => {
    setNotice(null);

    // /rooms/leave requires an active socket → avoid 409 spam
    if (socketRef.current?.connected && joinedRoomIdRef.current) {
      try {
        await api.post("/rooms/leave");
      } catch (e) {
        console.warn("⚠️ leave failed:", e);
      }
    }

    safeEmitLeave();

    pendingJoinRoomIdRef.current = null;
    joinedRoomIdRef.current = null;
    setJoinedRoom(null);
    setParticipants([]);
    setMeetFullscreen(false);

    await fetchRooms();
  };

  if (!user?.id) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center p-12 bg-blue-300 dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-white text-3xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-300 text-lg">Please log in to access Meet With Friends</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full h-full dark:bg-gray-900 relative overflow-hidden">
      <ParticipantsModal
        isOpen={showParticipantsModal}
        onClose={closeParticipants}
        participants={selectedRoomParticipants}
        roomName={selectedRoomName}
      />

      {notice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-xl bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100 shadow-lg border border-red-300 dark:border-red-700">
          {notice}
        </div>
      )}

      {!joinedRoom ? (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <h2 className="text-black dark:text-white text-3xl mb-4 font-bold">
            {t("MeetWithFriends.Title")}
          </h2>

          <div className="mb-4 text-sm">
            <span
              className={`px-3 py-1 rounded-full ${
                socketConnected
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              }`}
            >
              {socketConnected ? "🟢 Socket connected" : "⚪ Socket disconnected"}
            </span>
            <span
              className={`ml-2 px-3 py-1 rounded-full ${
                socketReady
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100"
              }`}
            >
              {socketReady ? "✅ Ready" : "⏳ Starting..."}
            </span>
          </div>

          <div className="mb-8 flex items-center">
            <input
              type="text"
              className="px-4 py-2 rounded-l border-none outline-none text-lg"
              placeholder="Enter room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createRoom()}
            />
            <button
              className="px-6 py-2 bg-green-600 text-white rounded-r hover:bg-green-700 text-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={createRoom}
              disabled={!newRoomName.trim() || !socketConnected}
              title={!socketConnected ? "Waiting for socket connection..." : ""}
            >
              {t("MeetWithFriends.createRoom")}
            </button>
          </div>

          <div className="w-full max-w-2xl">
            <h3 className="text-black dark:text-white text-xl mb-4">
              {t("MeetWithFriends.availableRooms")} ({rooms.length})
            </h3>

            <div className="min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => {
                const list = extractRoomParticipantsList(room);
                const count = room?.participantsCount ?? (Array.isArray(list) ? list.length : 0);

                const cap = computeCapacity(room);
                const isFull = Number.isFinite(cap) ? count >= cap : false;

                return (
                  <div
                    key={room._id}
                    className={`min-w-0 flex flex-col justify-between border rounded-xl p-6 shadow-md hover:shadow-xl transition duration-300 ${
                      isFull
                        ? "bg-red-100 dark:bg-red-900 border-red-500"
                        : "bg-blue-100 dark:bg-[#2b2b2f] border-blue-700 dark:border-yellow-400"
                    }`}
                    style={{ minHeight: "200px" }}
                  >
                    <div>
                      <h4
                        className={`text-xl font-semibold mb-1 ${
                          isFull ? "text-red-900 dark:text-red-300" : "text-blue-900 dark:text-white"
                        }`}
                      >
                        {room.name}
                      </h4>

                      <p className="text-gray-700 dark:text-gray-400 text-sm">
                        👥{" "}
                        {Number.isFinite(cap)
                          ? `${count}/${cap} ${t("MeetWithFriends.participants")}`
                          : `${count} ${t("MeetWithFriends.participants")}`}
                      </p>

                      {room.isActive && (
                        <p className="text-green-600 dark:text-green-400 text-xs mt-1">
                          🟢 Active
                        </p>
                      )}

                      {isFull && (
                        <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                          🚫 Room Full
                        </p>
                      )}
                    </div>

                    <div className="mt-4">
                      {Array.isArray(list) && list.length > 0 && (
                        <button
                          onClick={() => openParticipants(room.name, list)}
                          className="w-full flex items-center justify-center gap-2 text-sm font-bold text-white rounded-lg bg-cyan-700 hover:bg-cyan-800 mb-3 transition-colors py-2"
                        >
                          <FaUsers />
                          {t("MeetWithFriends.viewParticipants")}
                        </button>
                      )}

                      <button
                        onClick={() => joinRoom(room)}
                        disabled={isFull || !socketConnected}
                        className={`w-full font-semibold py-2 px-4 rounded-lg text-center transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                          isFull
                            ? "bg-gray-400 text-gray-600"
                            : "bg-[#4f46e5] hover:bg-[#4338ca] text-white"
                        }`}
                        title={!socketConnected ? "Waiting for socket connection..." : ""}
                      >
                        {isFull ? t("MeetWithFriends.roomFull") : t("MeetWithFriends.joinCall")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {rooms.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400 text-lg mb-2">{t("MeetWithFriends.noRooms")}</p>
                <p className="text-gray-500 text-sm">Create the first room to get started! 🚀</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col bg-gray-900">
          {/* Room Header */}
          <div className="flex justify-between items-center w-full p-6 bg-gray-800 border-b border-gray-700">
            <div>
              <h2 className="text-white text-2xl font-bold">{joinedRoom?.name} Room</h2>
              <p className="text-gray-300 text-sm mt-1">
                👥 {participants.length} {t("MeetWithFriends.participants")}
                {socketConnected && socketReady && (
                  <span className="text-green-400 ml-2">🟢 {t("MeetWithFriends.Connected")}</span>
                )}
                {(!socketConnected || !socketReady) && (
                  <span className="text-red-400 ml-2">🔴 {t("MeetWithFriends.Connecting")}</span>
                )}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => openParticipants(joinedRoom?.name, participants)}
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg font-semibold text-sm shadow-lg transition-colors flex items-center gap-2"
                title="View participants"
              >
                <FaUsers />
                {t("MeetWithFriends.viewParticipants")}
              </button>

              <button
                onClick={toggleFullscreen}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm shadow-lg transition-colors flex items-center gap-2"
                title={meetFullscreen ? t("MeetWithFriends.ExitFullscreen") : t("MeetWithFriends.EnterFullscreen")}
              >
                {meetFullscreen ? <FaCompress /> : <FaExpand />}
                {meetFullscreen ? t("MeetWithFriends.ExitFullscreen") : t("MeetWithFriends.Fullscreen")}
              </button>

              <button
                onClick={leaveRoom}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold text-lg shadow-lg transition-colors"
              >
                {t("MeetWithFriends.LeaveRoom")}
              </button>
            </div>
          </div>

          {/* Placeholder (mediasoup later) */}
          <div className="flex-1 bg-black p-6 overflow-hidden">
            <div className="h-full min-h-0 rounded-2xl border border-gray-700 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
              <div className="text-center max-w-xl px-6">
                <div className="text-6xl mb-4">🎥</div>
                <h3 className="text-white text-2xl font-bold mb-2">Video grid placeholder</h3>
                <p className="text-gray-300">
                  Rooms + presence are now server-authoritative (REST + Socket.IO). Media (mediasoup)
                  will plug into this room view next.
                </p>
                <div className="mt-6 text-sm text-gray-400">
                  Tip: open two browsers/users and join the same room to test roster.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}