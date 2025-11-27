// src/features/MeetWithFriends.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API } from "../shared/config";
import { AppContext } from "../shared/AppContext";
import { useTranslation } from "react-i18next";
import { FaExpand, FaCompress, FaTimes } from "react-icons/fa";
import { Room as LiveKitRoom, RoomEvent, Track } from "livekit-client";

// ─────────────────────────────────────────────
//  Helper: Request LiveKit token from backend
// ─────────────────────────────────────────────
async function fetchLiveKitToken(roomName) {
  const res = await axios.post(
    `${API}/rtc/token`,
    { roomName },
    { withCredentials: true }
  );
  return res.data; // { token, livekitUrl, identity }
}

// ─────────────────────────────────────────────
//  Participants Modal
// ─────────────────────────────────────────────
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
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {participants.length > 0 ? (
          participants.map((p, idx) => (
            <div
              key={p.userId || idx}
              className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {p.fullName?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="text-gray-900 dark:text-white">
                {p.fullName || `User ${p.userId?.slice(-4)}`}
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

const MAX_ROOM_PARTICIPANTS = 10;

// ─────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────
export default function MeetWithFriends() {
  const { user, meetFullscreen, setMeetFullscreen } = useContext(AppContext);
  const { t } = useTranslation();

  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [socket, setSocket] = useState(null);

  // LiveKit state
  const [livekitRoom, setLivekitRoom] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // "connecting" | "connected" | "disconnected"

  // Media control states
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Devices
  const [cameras, setCameras] = useState([]);
  const [mics, setMics] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicId, setSelectedMicId] = useState("");

  // Participants modal
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [selectedRoomParticipants, setSelectedRoomParticipants] = useState([]);
  const [selectedRoomName, setSelectedRoomName] = useState("");

  // Video refs
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map()); // participantSid -> React ref

  // ─────────────────────────────────────────────
  //  Enumerate devices (camera + mic)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        const audioInputs = devices.filter((d) => d.kind === "audioinput");

        setCameras(videoInputs);
        setMics(audioInputs);

        if (!selectedCameraId && videoInputs[0]) {
          setSelectedCameraId(videoInputs[0].deviceId);
        }
        if (!selectedMicId && audioInputs[0]) {
          setSelectedMicId(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Error enumerating media devices:", err);
      }
    }

    loadDevices();
  }, [selectedCameraId, selectedMicId]);

  // Switch camera device when selection changes
  useEffect(() => {
    if (!livekitRoom || !selectedCameraId) return;
    livekitRoom
      .switchActiveDevice("videoinput", selectedCameraId)
      .catch((err) =>
        console.warn("Failed to switch camera device:", err)
      );
  }, [livekitRoom, selectedCameraId]);

  // Switch microphone device when selection changes
  useEffect(() => {
    if (!livekitRoom || !selectedMicId) return;
    livekitRoom
      .switchActiveDevice("audioinput", selectedMicId)
      .catch((err) =>
        console.warn("Failed to switch microphone device:", err)
      );
  }, [livekitRoom, selectedMicId]);

  // ─────────────────────────────────────────────
  //  Cleanup on browser/tab close (sendBeacon)
  // ─────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (joinedRoom && user?.id) {
        const formData = new FormData();
        formData.append("roomName", joinedRoom);
        formData.append("userId", user.id);
        navigator.sendBeacon(`${API}/rooms/leave`, formData);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && livekitRoom) {
        livekitRoom.localParticipant
          .setCameraEnabled(false)
          .catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [joinedRoom, user?.id, livekitRoom]);

  // ─────────────────────────────────────────────
  //  Socket.IO room management (real-time)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const newSocket = io(API, {
      withCredentials: true,
    });

    newSocket.on("connect", () => {
      console.log("✅ Connected to room management socket");
    });

    newSocket.on("disconnect", () => {
      console.log("🔌 Disconnected from room management socket");
    });

    newSocket.on("room-created", (room) => {
      setRooms((prev) => {
        if (prev.find((r) => r.name === room.name)) return prev;
        return [...prev, room];
      });
    });

    newSocket.on("room-updated", (room) => {
      setRooms((prev) => prev.map((r) => (r.name === room.name ? room : r)));
    });

    newSocket.on("room-deleted", (data) => {
      setRooms((prev) => prev.filter((r) => r.name !== data.name));

      if (joinedRoom === data.name) {
        // If we were in this room, leave it
        leaveRoom();
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, joinedRoom]);

  // ─────────────────────────────────────────────
  //  Fetch existing rooms once on mount
  // ─────────────────────────────────────────────
  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await axios.get(`${API}/rooms`, {
          withCredentials: true,
        });
        setRooms(res.data);
      } catch (e) {
        console.error("❌ Error fetching rooms:", e);
      }
    }
    fetchRooms();
  }, []);

  // ─────────────────────────────────────────────
  //  Fullscreen toggle
  // ─────────────────────────────────────────────
  const toggleFullscreen = () => {
    setMeetFullscreen(!meetFullscreen);
  };

  // ─────────────────────────────────────────────
  //  Media control buttons (mute/camera)
  // ─────────────────────────────────────────────
  const toggleAudio = async () => {
    if (!livekitRoom) return;
    const newMuted = !isAudioMuted;
    setIsAudioMuted(newMuted);
    await livekitRoom.localParticipant.setMicrophoneEnabled(!newMuted);
  };

  const toggleVideo = async () => {
    if (!livekitRoom) return;
    const newState = !isVideoOff;
    setIsVideoOff(newState);
    await livekitRoom.localParticipant.setCameraEnabled(!newState);
  };

  // ─────────────────────────────────────────────
  //  Participants modal handlers
  // ─────────────────────────────────────────────
  const showParticipants = (room) => {
    setSelectedRoomParticipants(room.participantDetails || []);
    setSelectedRoomName(room.name);
    setShowParticipantsModal(true);
  };
  const closeParticipants = () => setShowParticipantsModal(false);

  // ─────────────────────────────────────────────
  //  Wire LiveKit events
  // ─────────────────────────────────────────────
  function wireLiveKitEvents(room) {
    // Existing remote participants
    room.participants.forEach((p) => {
      if (!p.isLocal) {
        setRemoteParticipants((prev) => {
          if (prev.find((rp) => rp.sid === p.sid)) return prev;
          return [...prev, p];
        });
      }
    });

    // Remote participant connected
    room.on(RoomEvent.ParticipantConnected, (p) => {
      if (!p.isLocal) {
        setRemoteParticipants((prev) => [...prev, p]);
      }
    });

    // Remote participant disconnected
    room.on(RoomEvent.ParticipantDisconnected, (p) => {
      setRemoteParticipants((prev) => prev.filter((x) => x.sid !== p.sid));
      const ref = remoteVideoRefs.current.get(p.sid);
      if (ref?.current) {
        ref.current.srcObject = null;
      }
      remoteVideoRefs.current.delete(p.sid);
    });

    // Track subscribed (remote camera)
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === "video" && !participant.isLocal) {
        if (!remoteVideoRefs.current.has(participant.sid)) {
          remoteVideoRefs.current.set(participant.sid, React.createRef());
        }
        const ref = remoteVideoRefs.current.get(participant.sid);
        if (ref?.current) {
          track.attach(ref.current);
        }
      }
    });

    // Track unsubscribed (remote camera off)
    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      const ref = remoteVideoRefs.current.get(participant.sid);
      if (ref?.current) {
        track.detach(ref.current);
        ref.current.srcObject = null;
      }
    });
  }

  // ─────────────────────────────────────────────
  //  Create room (backend + auto-join)
  // ─────────────────────────────────────────────
  async function createRoom() {
    if (!newRoomName.trim() || !user?.id) return;

    try {
      const { data } = await axios.post(
        `${API}/rooms/create`,
        {
          name: newRoomName,
          userId: user.id,
        },
        { withCredentials: true }
      );

      setNewRoomName("");
      await joinRoom(data.name);
    } catch (e) {
      const errorMsg = e.response?.data?.error || e.message;
      alert("Failed to create room: " + errorMsg);
    }
  }

  // ─────────────────────────────────────────────
  //  Join room (Room backend + token + LiveKit)
  // ─────────────────────────────────────────────
  async function joinRoom(roomName) {
    if (!user?.id) return;

    try {
      // Leave any existing room first
      if (livekitRoom) {
        try {
          await livekitRoom.disconnect();
        } catch {
          // ignore
        }
        setLivekitRoom(null);
        setRemoteParticipants([]);
        remoteVideoRefs.current.clear();
      }

      setJoinedRoom(roomName);
      setConnectionStatus("connecting");
      setIsAudioMuted(false);
      setIsVideoOff(false);

      // Tell backend we joined (for room list)
      await axios.post(
        `${API}/rooms/join`,
        { roomName, userId: user.id },
        { withCredentials: true }
      );

      // Fetch LiveKit token + URL from backend
      const { token, livekitUrl } = await fetchLiveKitToken(roomName);

      // Create LiveKit room instance
      const room = new LiveKitRoom({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720 },
        },
      });

      // Save instance before connect so events can run
      setLivekitRoom(room);

      // Wire events
      wireLiveKitEvents(room);

      // Connect to LiveKit
      await room.connect(livekitUrl, token, { autoSubscribe: true });

      // Create local tracks (audio + video) using selected devices if available
      const localTracks = await room.localParticipant.createTracks({
        video: selectedCameraId ? { deviceId: selectedCameraId } : true,
        audio: selectedMicId ? { deviceId: selectedMicId } : true,
      });

      // Attach local video
      const cameraTrack = localTracks.find(
        (t) => t.source === Track.Source.Camera
      );
      if (localVideoRef.current && cameraTrack) {
        cameraTrack.attach(localVideoRef.current);
      }

      setConnectionStatus("connected");

      // Ensure mic + camera are enabled after join
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setCameraEnabled(true);
    } catch (err) {
      console.error("LiveKit join error:", err);
      alert("Unable to join room.");
      setJoinedRoom(null);
      setConnectionStatus("disconnected");
    }
  }

  // ─────────────────────────────────────────────
  //  Leave room (backend + LiveKit + cleanup)
  // ─────────────────────────────────────────────
  async function leaveRoom() {
    console.log("Leaving LiveKit room:", joinedRoom);

    setMeetFullscreen(false);

    // Inform backend
    if (joinedRoom && user?.id) {
      const formData = new FormData();
      formData.append("roomName", joinedRoom);
      formData.append("userId", user.id);
      navigator.sendBeacon(`${API}/rooms/leave`, formData);
    }

    // Disconnect LiveKit
    if (livekitRoom) {
      try {
        await livekitRoom.disconnect();
      } catch (err) {
        console.warn("Error disconnecting LiveKit:", err);
      }
    }

    // Cleanup video refs
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    remoteVideoRefs.current.forEach((ref) => {
      if (ref.current) {
        ref.current.srcObject = null;
      }
    });
    remoteVideoRefs.current.clear();

    // Reset state
    setLivekitRoom(null);
    setRemoteParticipants([]);
    setJoinedRoom(null);
    setConnectionStatus("disconnected");
    setIsAudioMuted(false);
    setIsVideoOff(false);
  }

  // ─────────────────────────────────────────────
  //  Early return if not logged in
  // ─────────────────────────────────────────────
  if (!user?.id) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center p-12 bg-blue-300 dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-white text-3xl font-bold mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-300 text-lg">
            Please log in to access P2P video rooms
          </p>
        </div>
      </div>
    );
  }

  // Compute current room participant count from backend rooms list
  const currentRoom = rooms.find((r) => r.name === joinedRoom);
  const currentParticipantCount =
    currentRoom?.participants?.length ||
    (remoteParticipants.length + (joinedRoom ? 1 : 0));

  // ─────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────
  return (
    <div className="min-w-0 w-full h-full dark:bg-gray-900 relative overflow-hidden">
      {/* Participants Modal */}
      <ParticipantsModal
        isOpen={showParticipantsModal}
        onClose={closeParticipants}
        participants={selectedRoomParticipants}
        roomName={selectedRoomName}
      />

      {!joinedRoom ? (
        // ─────────────────────────────
        //  Lobby: create/join rooms
        // ─────────────────────────────
        <div className="flex flex-col items-center justify-center h-full p-8">
          <h2 className="text-black dark:text-white text-3xl mb-4 font-bold">
            {t("MeetWithFriends.Title")}
          </h2>

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
              className="px-6 py-2 bg-green-600 text-white rounded-r hover:bg-green-700 text-lg font-semibold transition-colors"
              onClick={createRoom}
              disabled={!newRoomName.trim()}
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
                const participantCount = room.participants?.length || 0;
                const isRoomFull = participantCount >= MAX_ROOM_PARTICIPANTS;

                return (
                  <div
                    key={room._id}
                    className={`min-w-0 flex flex-col justify-between border rounded-xl p-6 shadow-md hover:shadow-xl transition duration-300 ${
                      isRoomFull
                        ? "bg-red-100 dark:bg-red-900 border-red-500"
                        : "bg-blue-100 dark:bg-[#2b2b2f] border-blue-700 dark:border-yellow-400"
                    }`}
                    style={{ minHeight: "200px" }}
                  >
                    <div>
                      <h4
                        className={`text-xl font-semibold mb-1 ${
                          isRoomFull
                            ? "text-red-900 dark:text-red-300"
                            : "text-blue-900 dark:text-white"
                        }`}
                      >
                        {room.name}
                      </h4>
                      <p className="text-gray-700 dark:text-gray-400 text-sm">
                        👥 {participantCount}/{MAX_ROOM_PARTICIPANTS}{" "}
                        {t("MeetWithFriends.participants")}
                      </p>
                      {room.isActive && (
                        <p className="text-green-600 dark:text-green-400 text-xs mt-1">
                          🟢 Active Call
                        </p>
                      )}
                      {isRoomFull && (
                        <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                          🚫 Room Full - P2P Limit Reached
                        </p>
                      )}
                      <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">
                        Created:{" "}
                        {new Date(room.createdAt).toLocaleTimeString()}
                      </p>
                    </div>

                    {room.participantDetails?.length > 0 && (
                      <button
                        onClick={() => showParticipants(room)}
                        className="flex items-center gap-2 text-sm font-bold text-white rounded-lg bg-cyan-700 hover:bg-cyan-800 mb-3 transition-colors"
                      >
                        {t("MeetWithFriends.viewParticipants")}
                      </button>
                    )}

                    <button
                      onClick={() => joinRoom(room.name)}
                      disabled={isRoomFull}
                      className={`mt-4 font-semibold py-2 px-4 rounded-lg text-center transition-all ${
                        isRoomFull
                          ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                          : "bg-[#4f46e5] hover:bg-[#4338ca] text-white"
                      }`}
                    >
                      {isRoomFull
                        ? t("MeetWithFriends.roomFull")
                        : t("MeetWithFriends.joinCall")}
                    </button>
                  </div>
                );
              })}
            </div>

            {rooms.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400 text-lg mb-2">
                  {t("MeetWithFriends.noRooms")}
                </p>
                <p className="text-gray-500 text-sm">
                  Create the first room to get started! 🚀
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // ─────────────────────────────
        //  In-room view
        // ─────────────────────────────
        <div className="w-full h-full flex flex-col bg-gray-900">
          {/* Room Header */}
          <div className="flex flex-wrap justify-between items-center w-full gap-4 p-6 bg-gray-800 border-b border-gray-700">
            <div>
              <h2 className="text-white text-2xl font-bold">
                {joinedRoom} Room
              </h2>
              <p className="text-gray-300 text-sm mt-1">
                👥 {currentParticipantCount}/{MAX_ROOM_PARTICIPANTS}{" "}
                {t("MeetWithFriends.participants")}{" "}
                {connectionStatus === "connected" && (
                  <span className="text-green-400 ml-2">
                    🟢 {t("MeetWithFriends.Connected")}
                  </span>
                )}
                {connectionStatus === "connecting" && (
                  <span className="text-yellow-400 ml-2">
                    🟡 {t("MeetWithFriends.Connecting")}
                  </span>
                )}
                {connectionStatus === "disconnected" && (
                  <span className="text-red-400 ml-2">
                    🔴 {t("MeetWithFriends.Connecting")}
                  </span>
                )}
              </p>
            </div>

            {/* Device selectors */}
            <div className="flex flex-col md:flex-row gap-2 md:items-center text-xs md:text-sm">
              <div className="flex flex-col">
                <span className="text-gray-300 mb-1">Camera</span>
                <select
                  className="bg-gray-700 text-white rounded px-2 py-1 text-xs md:text-sm"
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  disabled={!cameras.length}
                >
                  {!cameras.length && <option value="">No cameras</option>}
                  {cameras.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <span className="text-gray-300 mb-1">Microphone</span>
                <select
                  className="bg-gray-700 text-white rounded px-2 py-1 text-xs md:text-sm"
                  value={selectedMicId}
                  onChange={(e) => setSelectedMicId(e.target.value)}
                  disabled={!mics.length}
                >
                  {!mics.length && <option value="">No microphones</option>}
                  {mics.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Mic ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm shadow-lg transition-colors flex items-center gap-2"
                title={
                  meetFullscreen
                    ? t("MeetWithFriends.ExitFullscreen")
                    : t("MeetWithFriends.EnterFullscreen")
                }
              >
                {meetFullscreen ? <FaCompress /> : <FaExpand />}
                {meetFullscreen
                  ? t("MeetWithFriends.ExitFullscreen")
                  : t("MeetWithFriends.Fullscreen")}
              </button>

              {/* Mute / Unmute */}
              <button
                onClick={toggleAudio}
                className={`px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition-colors ${
                  isAudioMuted
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
                title={
                  isAudioMuted ? "Unmute microphone" : "Mute microphone"
                }
              >
                {isAudioMuted
                  ? t("MeetWithFriends.unmute")
                  : t("MeetWithFriends.mute")}
              </button>

              {/* Video On/Off */}
              <button
                onClick={toggleVideo}
                className={`px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition-colors ${
                  isVideoOff
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
                title={
                  isVideoOff
                    ? t("MeetWithFriends.CameraOn")
                    : t("MeetWithFriends.CameraOff")
                }
              >
                {isVideoOff
                  ? t("MeetWithFriends.VideoOn")
                  : t("MeetWithFriends.VideoOff")}
              </button>

              {/* Leave Room */}
              <button
                onClick={leaveRoom}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold text-lg shadow-lg transition-colors"
              >
                {t("MeetWithFriends.LeaveRoom")}
              </button>
            </div>
          </div>

          {/* Video Grid */}
          <div className="flex-1 bg-black p-6 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full min-h-0">
              {/* Local Video (mirrored) */}
              <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-green-500">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <div className="absolute top-2 left-2 flex gap-1">
                  {isAudioMuted && (
                    <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                      {t("MeetWithFriends.Muted")}
                    </div>
                  )}
                  {isVideoOff && (
                    <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                      {t("MeetWithFriends.Off")}
                    </div>
                  )}
                </div>
              </div>

              {/* Remote Participants */}
              {remoteParticipants.map((p) => {
                const sid = p.sid;

                if (!remoteVideoRefs.current.has(sid)) {
                  remoteVideoRefs.current.set(sid, React.createRef());
                }

                const ref = remoteVideoRefs.current.get(sid);

                const isMuted =
                  !p.isMicrophoneEnabled ||
                  p.audioTracks.size === 0 ||
                  [...p.audioTracks.values()][0]?.isMuted;

                const isRemoteVideoOff =
                  !p.isCameraEnabled ||
                  p.videoTracks.size === 0 ||
                  [...p.videoTracks.values()][0]?.isMuted;

                return (
                  <div
                    key={sid}
                    className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-blue-500"
                  >
                    <video
                      ref={ref}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />

                    <div className="absolute top-2 left-2 flex gap-1">
                      {isMuted && (
                        <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                          {t("MeetWithFriends.Muted")}
                        </div>
                      )}
                      {isRemoteVideoOff && (
                        <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                          {t("MeetWithFriends.Off")}
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-white text-xs">
                      {p.name || p.identity || "User"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
