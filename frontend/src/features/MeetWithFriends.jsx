// frontent/src/features/MeetWithFriends.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import { api } from "../shared/config";
import { AppContext } from "../shared/AppContext";
import { useTranslation } from "react-i18next";
import {
  FaExpand,
  FaCompress,
  FaUsers,
  FaTimes,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
} from "react-icons/fa";
import { acquireMeetSocket, releaseMeetSocket } from "./meetSocket";
import RoomCreateModal from "../components/RoomCreateModal";
import * as mediasoupClient from "mediasoup-client";

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

/* -----------------------------
   Helpers
------------------------------ */
const safeFullName = (p) =>
  p?.fullName || (p?.userId ? `User ${String(p.userId).slice(-4)}` : "User");

const emitWithAck = (socket, event, payload, timeoutMs = 2000) => {
  if (!socket) return Promise.resolve(null);

  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(null);
    }, timeoutMs);

    try {
      socket.emit(event, payload, (resp) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(resp);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
};

const VideoEl = ({ stream, muted }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream || null;

    // attempt play (autoplay policies may still block)
    if (stream) {
      const p = el.play?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full object-cover"
    />
  );
};

const AudioEl = ({ stream }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream || null;

    if (stream) {
      const p = el.play?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [stream]);

  // Keep it not visible but still present
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
};

export default function MeetWithFriends() {
  const { user, meetFullscreen, setMeetFullscreen } = useContext(AppContext);
  const { t } = useTranslation();

  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [participants, setParticipants] = useState([]);

  const [socketConnected, setSocketConnected] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);
  const [sendTransportReady, setSendTransportReady] = useState(false);
  const [recvTransportReady, setRecvTransportReady] = useState(false);
  const [notice, setNotice] = useState(null);

  // media controls (inside-room)
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(true);

  // force rerender when remote media changes (maps are refs)
  const [remoteVersion, setRemoteVersion] = useState(0);

  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [selectedRoomParticipants, setSelectedRoomParticipants] = useState([]);
  const [selectedRoomName, setSelectedRoomName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const socketRef = useRef(null);
  const joinedRoomIdRef = useRef(null);
  const pendingJoinRoomIdRef = useRef(null);

  // -------- mediasoup refs --------
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);

  const localStreamRef = useRef(null); // audio stream
  const localVideoStreamRef = useRef(null); // video stream
  const camToggleInFlightRef = useRef(false);

  const remoteStreamsRef = useRef(new Map()); // producerId -> MediaStream (legacy keep)
  const remoteMediaByUserRef = useRef(
    new Map()
  ); // userId -> { fullName, audioStream, videoStream, muted?:bool, camOff?:bool }
  const remoteConsumersRef = useRef(new Map()); // producerId -> consumer
  const producerToUserRef = useRef(
    new Map()
  ); // producerId -> { userId, fullName, kind }

  const pendingProducersRef = useRef([]); // payloads waiting for recv transport
  const micMutedRef = useRef(false);
  const camOffRef = useRef(true);

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
    try {
      s.emit("rtc:join-room", { roomId });
    } catch {}
  };

  const safeEmitLeave = () => {
    const s = socketRef.current;
    if (!s) return;
    pendingJoinRoomIdRef.current = null;
    try {
      s.emit("rtc:leave-room");
    } catch {}
  };

  const resetRemoteMedia = () => {
    remoteStreamsRef.current = new Map();
    remoteMediaByUserRef.current = new Map();
    remoteConsumersRef.current = new Map();
    producerToUserRef.current = new Map();
    pendingProducersRef.current = [];
    setRemoteVersion((v) => v + 1);
  };

  const resetMediasoupClientState = () => {
    // stop local streams
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    try {
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}

    localStreamRef.current = null;
    localVideoStreamRef.current = null;

    // close producers
    try {
      if (sendTransportRef.current?._audioProducer) {
        sendTransportRef.current._audioProducer.close();
      }
    } catch {}
    try {
      if (sendTransportRef.current?._videoProducer) {
        sendTransportRef.current._videoProducer.close();
      }
    } catch {}

    // close transports
    try {
      sendTransportRef.current?.close?.();
    } catch {}
    try {
      recvTransportRef.current?.close?.();
    } catch {}

    sendTransportRef.current = null;
    recvTransportRef.current = null;
    deviceRef.current = null;

    setSendTransportReady(false);
    setRecvTransportReady(false);
    setDeviceReady(false);

    // reset toggles
    setMicMuted(false);
    setCamOff(true);
    micMutedRef.current = false;
    camOffRef.current = true;

    // close remote consumers (best-effort)
    try {
      for (const c of remoteConsumersRef.current.values()) {
        try {
          c.close?.();
        } catch {}
      }
    } catch {}

    resetRemoteMedia();
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

      // If we got disconnected while in-room, make sure local media is stopped
      if (joinedRoomIdRef.current) {
        resetMediasoupClientState();
      }
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

      // also remove their remote media if present
      if (userId) {
        remoteMediaByUserRef.current.delete(userId);
        setRemoteVersion((v) => v + 1);
      }
    };

    // Optional: if you implement backend broadcast of media state
    const onPeerMedia = ({ userId, muted, cameraOff, fullName }) => {
      if (!mountedRef.current) return;
      if (!userId) return;

      const entry = remoteMediaByUserRef.current.get(userId) || {
        fullName: fullName || `User ${String(userId).slice(-4)}`,
        audioStream: null,
        videoStream: null,
      };

      if (typeof muted === "boolean") entry.muted = muted;
      if (typeof cameraOff === "boolean") entry.camOff = cameraOff;
      if (fullName) entry.fullName = fullName;

      remoteMediaByUserRef.current.set(userId, entry);
      setRemoteVersion((v) => v + 1);
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

      // stop media
      resetMediasoupClientState();

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

        // stop media
        resetMediasoupClientState();
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

    // Optional media state event name(s)
    s.on("rtc:peer-media", onPeerMedia);
    s.on("rtc:media-updated", onPeerMedia);

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

        s.off("rtc:peer-media", onPeerMedia);
        s.off("rtc:media-updated", onPeerMedia);
      } catch {}

      // Only when the feature truly goes away (no immediate remount) we teardown socket.
      // This prevents StrictMode from "leaving" on the fake unmount.
      releaseMeetSocket((sock) => {
        if (roomId && sock?.connected) {
          try {
            sock.emit("rtc:leave-room");
          } catch {}
          try {
            api.post("/rooms/leave").catch(() => {});
          } catch {}
        }
      });

      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* -----------------------------
     Room actions
  ------------------------------ */

  const joinRoom = async (room) => {
    if (!room?._id) return;

    setNotice(null);

    // joining should start fresh media state
    resetMediasoupClientState();
    resetRemoteMedia();

    try {
      // 1️⃣ REST join (authoritative)
      await api.post(`/rooms/join/${room._id}`);

      // 2️⃣ Update local state immediately
      joinedRoomIdRef.current = room._id;
      setJoinedRoom(room);
      setParticipants([]);

      // 3️⃣ Immediately tell socket to join
      if (socketRef.current?.connected) {
        socketRef.current.emit("rtc:join-room", { roomId: room._id });
      } else {
        pendingJoinRoomIdRef.current = room._id;
      }

      // 4️⃣ Refresh room list
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

    // stop media (audio/video/transports/consumers)
    resetMediasoupClientState();

    pendingJoinRoomIdRef.current = null;
    joinedRoomIdRef.current = null;
    setJoinedRoom(null);
    setParticipants([]);
    setMeetFullscreen(false);

    await fetchRooms();
  };

  /* -----------------------------
    Media controls (inside-room)
  ------------------------------ */
  const toggleMute = () => {
    const producer = sendTransportRef.current?._audioProducer;
    setMicMuted((prev) => {
      const next = !prev;
      micMutedRef.current = next;

      try {
        if (producer) {
          if (next) producer.pause();
          else producer.resume();
        }
      } catch {}

      // Optional: tell server so others can show mute badge
      try {
        socketRef.current?.emit?.("rtc:update-media", {
          muted: next,
          cameraOff: camOffRef.current,
        });
      } catch {}
      try {
        socketRef.current?.emit?.("rtc:media-state", {
          muted: next,
          cameraOff: camOffRef.current,
        });
      } catch {}

      return next;
    });
  };

  const toggleCamera = async () => {
    if (camToggleInFlightRef.current) return;
    camToggleInFlightRef.current = true;
  
    const socket = socketRef.current;
    const transport = sendTransportRef.current;
  
    try {
      if (!transport) return;
  
      const videoProducer = transport._videoProducer || null;
  
      // TURN CAMERA ON
      if (camOffRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
  
        const track = stream.getVideoTracks?.()[0];
        if (!track) {
          stream.getTracks().forEach((t) => t.stop());
          throw new Error("No video track");
        }
  
        // replace local video stream ref
        // stop old local camera stream if it exists (shouldn't, but safe)
        try {
          if (localVideoStreamRef.current) {
            localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
          }
        } catch {}
        localVideoStreamRef.current = stream;
  
        if (videoProducer) {
          // Reuse existing producer (no new server produce call)
          await videoProducer.replaceTrack({ track });
          try {
            videoProducer.resume();
          } catch {}
        } else {
          // First time ever: create producer
          const producer = await transport.produce({ track });
          transport._videoProducer = producer;
  
          producer.on("close", () => {
            if (transport._videoProducer === producer) transport._videoProducer = null;
          });
  
          // If camera track ends, reflect cam-off UI
          producer.on("trackended", () => {
            camOffRef.current = true;
            setCamOff(true);
            try {
              socket?.emit?.("rtc:update-media", {
                muted: micMutedRef.current,
                cameraOff: true,
              });
            } catch {}
          });
        }
  
        camOffRef.current = false;
        setCamOff(false);
  
        // Optional: broadcast media state (if backend supports)
        try {
          socket?.emit?.("rtc:update-media", {
            muted: micMutedRef.current,
            cameraOff: false,
          });
        } catch {}
        try {
          socket?.emit?.("rtc:media-state", {
            muted: micMutedRef.current,
            cameraOff: false,
          });
        } catch {}
  
        setRemoteVersion((v) => v + 1);
        return;
      }
  
      // TURN CAMERA OFF
      if (videoProducer) {
        try {
          videoProducer.pause(); // stop sending without removing producer server-side
        } catch {}
      }
  
      // release camera hardware
      try {
        if (localVideoStreamRef.current) {
          localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
        }
      } catch {}
      localVideoStreamRef.current = null;
  
      camOffRef.current = true;
      setCamOff(true);
  
      // Optional: broadcast media state
      try {
        socket?.emit?.("rtc:update-media", {
          muted: micMutedRef.current,
          cameraOff: true,
        });
      } catch {}
      try {
        socket?.emit?.("rtc:media-state", {
          muted: micMutedRef.current,
          cameraOff: true,
        });
      } catch {}
  
      setRemoteVersion((v) => v + 1);
    } catch (err) {
      console.error("❌ Camera enable failed:", err);
      setNotice(err?.message || "Camera toggle failed");
    } finally {
      camToggleInFlightRef.current = false;
    }
  };

  /* -----------------------------
   Mediasoup Device Init
  ------------------------------ */
  useEffect(() => {
    const socket = socketRef.current;

    if (!joinedRoom?._id) return;
    if (!socketReady) return;
    if (!socket) return;
    if (deviceRef.current) return; // already initialized

    let cancelled = false;

    const initDevice = async () => {
      try {
        console.log("🎥 Initializing mediasoup device...");

        // 1️⃣ Get RTP Capabilities
        const rtpResponse = await new Promise((resolve) => {
          socket.emit("rtc:getRtpCapabilities", {}, resolve);
        });

        if (!rtpResponse?.ok) {
          throw new Error(rtpResponse?.error || "Failed to get RTP capabilities");
        }

        if (cancelled) return;

        // 2️⃣ Create Device
        const device = new mediasoupClient.Device();

        await device.load({
          routerRtpCapabilities: rtpResponse.rtpCapabilities,
        });

        deviceRef.current = device;
        setDeviceReady(true);

        console.log("✅ Mediasoup device loaded");
      } catch (err) {
        console.error("❌ Device init failed:", err);
      }
    };

    initDevice();

    return () => {
      cancelled = true;
    };
  }, [joinedRoom?._id, socketReady]);

  /* -----------------------------
   Create Send Transport
  ------------------------------ */
  useEffect(() => {
    const socket = socketRef.current;

    if (!joinedRoom?._id) return;
    if (!socketReady) return;
    if (!deviceReady) return;

    const device = deviceRef.current;
    if (!device) return;

    if (sendTransportRef.current) return;

    let cancelled = false;

    const createSendTransport = async () => {
      try {
        console.log("🚀 Creating send transport...");

        const response = await new Promise((resolve) => {
          socket.emit("rtc:createWebRtcTransport", { direction: "send" }, resolve);
        });

        if (!response?.ok) {
          throw new Error(response?.error || "Failed to create send transport");
        }

        if (cancelled) return;

        const transport = device.createSendTransport(response.transportOptions);

        sendTransportRef.current = transport;

        // 🔌 Transport connect
        transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
          try {
            const connectResponse = await new Promise((resolve) => {
              socket.emit(
                "rtc:connectWebRtcTransport",
                { transportId: transport.id, dtlsParameters },
                resolve
              );
            });

            if (!connectResponse?.ok) {
              throw new Error(connectResponse?.error || "Transport connect failed");
            }

            callback();
          } catch (err) {
            console.error("❌ Send transport connect error:", err);
            errback(err);
          }
        });

        transport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
          try {
            const produceResponse = await new Promise((resolve) => {
              socket.emit(
                "rtc:produce",
                { transportId: transport.id, kind, rtpParameters },
                resolve
              );
            });

            if (!produceResponse?.ok) {
              throw new Error(produceResponse?.error || "Produce failed");
            }

            callback({ id: produceResponse.producerId });
          } catch (err) {
            console.error("❌ Produce error:", err);
            errback(err);
          }
        });

        console.log("✅ Send transport ready");
        setSendTransportReady(true);
      } catch (err) {
        console.error("❌ Send transport creation failed:", err);
      }
    };

    createSendTransport();

    return () => {
      cancelled = true;
    };
  }, [joinedRoom?._id, socketReady, deviceReady]);

  /* -----------------------------
   Create Recv Transport
  ------------------------------ */
  useEffect(() => {
    const socket = socketRef.current;

    if (!joinedRoom?._id) return;
    if (!socketReady) return;
    if (!deviceReady) return;

    const device = deviceRef.current;
    if (!device) return;

    if (recvTransportRef.current) return;

    let cancelled = false;

    const createRecvTransport = async () => {
      try {
        console.log("📥 Creating recv transport...");

        const response = await new Promise((resolve) => {
          socket.emit("rtc:createWebRtcTransport", { direction: "recv" }, resolve);
        });

        if (!response?.ok) {
          throw new Error(response?.error || "Failed to create recv transport");
        }

        if (cancelled) return;

        const transport = device.createRecvTransport(response.transportOptions);

        recvTransportRef.current = transport;

        transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
          try {
            const connectResponse = await new Promise((resolve) => {
              socket.emit(
                "rtc:connectWebRtcTransport",
                { transportId: transport.id, dtlsParameters },
                resolve
              );
            });

            if (!connectResponse?.ok) {
              throw new Error(connectResponse?.error || "Recv connect failed");
            }

            callback();
          } catch (err) {
            console.error("❌ Recv transport connect error:", err);
            errback(err);
          }
        });

        console.log("✅ Recv transport ready");
        setRecvTransportReady(true);
      } catch (err) {
        console.error("❌ Recv transport creation failed:", err);
      }
    };

    createRecvTransport();

    return () => {
      cancelled = true;
    };
  }, [joinedRoom?._id, socketReady, deviceReady]);

  /* -----------------------------
   Produce Audio (always on; toggle by pause/resume)
  ------------------------------ */
  useEffect(() => {
    if (!joinedRoom?._id) return;
    if (!sendTransportReady) return;
    if (!sendTransportRef.current) return;

    let cancelled = false;

    const startAudio = async () => {
      try {
        console.log("🎤 Getting microphone...");

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        if (cancelled) return;

        localStreamRef.current = stream;

        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) throw new Error("No audio track");

        console.log("🎧 Producing audio...");

        if (!sendTransportRef.current._audioProducer) {
          const producer = await sendTransportRef.current.produce({
            track: audioTrack,
          });

          sendTransportRef.current._audioProducer = producer;

          producer.on("close", () => {
            sendTransportRef.current._audioProducer = null;
          });

          // If user toggled mute before producer existed, apply it
          try {
            if (micMutedRef.current) producer.pause();
          } catch {}
        }

        console.log("✅ Audio producer created");
      } catch (err) {
        console.error("❌ Audio produce failed:", err);
      }
    };

    startAudio();

    return () => {
      cancelled = true;
    };
  }, [joinedRoom?._id, sendTransportReady]);

  /* -----------------------------
   Consume Remote Producers
   - supports audio + video
   - supports existing producers via optional rtc:getProducers
------------------------------ */
  useEffect(() => {
    const socket = socketRef.current;

    if (!joinedRoom?._id) return;
    if (!socket) return;

    let cancelled = false;

    const ensureRecvReadyOrQueue = (payload) => {
      if (!recvTransportRef.current || !deviceRef.current) {
        pendingProducersRef.current.push(payload);
        return false;
      }
      return true;
    };

    const upsertRemoteUserEntry = (userId, fullName) => {
      if (!userId) return null;

      const existing = remoteMediaByUserRef.current.get(userId) || {
        fullName: fullName || `User ${String(userId).slice(-4)}`,
        audioStream: null,
        videoStream: null,
      };

      if (fullName) existing.fullName = fullName;
      remoteMediaByUserRef.current.set(userId, existing);
      return existing;
    };

    const consumeProducer = async (payload) => {
      if (cancelled) return;

      const producerId = payload?.producerId;
      if (!producerId) return;

      // Avoid double-consume
      if (remoteConsumersRef.current.has(producerId)) return;

      const transport = recvTransportRef.current;
      const device = deviceRef.current;

      if (!transport || !device) return;

      // Try to resolve producer metadata
      let userId = payload?.userId ?? payload?.peerId ?? null;
      let fullName = payload?.fullName ?? payload?.peerFullName ?? null;
      let kind = payload?.kind ?? null;

      // If backend doesn’t send metadata, try optional lookup (won’t block; timeouted)
      if (!userId || !kind) {
        const info = await emitWithAck(socket, "rtc:getProducerInfo", { producerId }, 1500);
        if (info?.ok) {
          userId = userId || info.userId || info.peerId || null;
          fullName = fullName || info.fullName || null;
          kind = kind || info.kind || null;
        }
      }

      try {
        const response = await new Promise((resolve) => {
          socket.emit(
            "rtc:consume",
            {
              producerId,
              transportId: transport.id,
              rtpCapabilities: device.rtpCapabilities,
            },
            resolve
          );
        });

        if (!response?.ok) {
          throw new Error(response?.error || "Consume failed");
        }

        const consumer = await transport.consume(response.consumerParameters);
        remoteConsumersRef.current.set(producerId, consumer);

        const actualKind = kind || response.consumerParameters?.kind || consumer.kind;

        const stream = new MediaStream();
        stream.addTrack(consumer.track);

        // keep legacy map too
        remoteStreamsRef.current.set(producerId, stream);

        // Determine user from mapping:
        // If no userId was provided by backend, try match by roster if payload has fullName
        if (!userId && fullName) {
          const match = (participants || []).find((p) => p?.fullName === fullName);
          if (match?.userId) userId = match.userId;
        }

        // Store mapping for later events
        if (userId) {
          producerToUserRef.current.set(producerId, {
            userId,
            fullName: fullName || `User ${String(userId).slice(-4)}`,
            kind: actualKind,
          });
        }

        // Track media by userId if possible
        if (userId) {
          const entry = upsertRemoteUserEntry(userId, fullName);

          if (actualKind === "audio") {
            entry.audioStream = stream;

            // best-effort: if backend also sends "muted" state, keep it; otherwise infer from stream presence
            if (typeof entry.muted !== "boolean") entry.muted = false;
          } else if (actualKind === "video") {
            entry.videoStream = stream;
            if (typeof entry.camOff !== "boolean") entry.camOff = false;
          }

          remoteMediaByUserRef.current.set(userId, entry);
        }

        // Consumer cleanup
        consumer.on("producerclose", () => {
          remoteConsumersRef.current.delete(producerId);
          remoteStreamsRef.current.delete(producerId);

          const mapped = producerToUserRef.current.get(producerId);
          if (mapped?.userId) {
            const ent = remoteMediaByUserRef.current.get(mapped.userId);
            if (ent) {
              if (mapped.kind === "audio") ent.audioStream = null;
              if (mapped.kind === "video") ent.videoStream = null;
              remoteMediaByUserRef.current.set(mapped.userId, ent);
            }
          }
          producerToUserRef.current.delete(producerId);
          setRemoteVersion((v) => v + 1);
        });

        consumer.on("transportclose", () => {
          remoteConsumersRef.current.delete(producerId);
          remoteStreamsRef.current.delete(producerId);
          producerToUserRef.current.delete(producerId);
          setRemoteVersion((v) => v + 1);
        });

        setRemoteVersion((v) => v + 1);
      } catch (err) {
        console.error("❌ Consume error:", err);
      }
    };

    const flushPending = async () => {
      if (!recvTransportRef.current || !deviceRef.current) return;
      const list = pendingProducersRef.current.splice(0);
      for (const p of list) {
        await consumeProducer(p);
      }
    };

    const handleNewProducer = async (payload) => {
      if (!payload?.producerId) return;
      if (!ensureRecvReadyOrQueue(payload)) return;
      await consumeProducer(payload);
    };

    socket.on("rtc:new-producer", handleNewProducer);

    // If recv already ready, flush any pending
    flushPending();

    // Also fetch existing producers (optional API)
    (async () => {
      if (cancelled) return;
      if (!recvTransportRef.current || !deviceRef.current) return;

      const resp = await emitWithAck(
        socket,
        "rtc:getProducers",
        { roomId: joinedRoom?._id },
        1500
      );

      if (!resp) return;

      const producerList =
        resp?.producerIds ||
        resp?.producers ||
        resp?.data ||
        (Array.isArray(resp) ? resp : null);

      if (Array.isArray(producerList)) {
        for (const item of producerList) {
          if (typeof item === "string") {
            await handleNewProducer({ producerId: item });
          } else if (item?.producerId) {
            await handleNewProducer(item);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      socket.off("rtc:new-producer", handleNewProducer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinedRoom?._id, recvTransportReady, deviceReady]);

  /* -----------------------------
     UI helpers for tiles
  ------------------------------ */
  const myUserId = user?.id;

  const getTileForUser = (userId, fullName) => {
    const isMe = String(userId) === String(myUserId);

    if (isMe) {
      const videoStream = camOff ? null : localVideoStreamRef.current;
      return {
        userId,
        fullName: fullName || user?.fullName || user?.name || "You",
        isMe: true,
        videoStream,
        muted: micMuted,
        hasAudio: true,
      };
    }

    const entry = remoteMediaByUserRef.current.get(userId);
    const videoStream = entry?.videoStream || null;
    const audioStream = entry?.audioStream || null;

    // muted indicator:
    // 1) if backend set entry.muted, use it
    // 2) else infer: if no audio stream -> assume muted
    const muted =
      typeof entry?.muted === "boolean" ? entry.muted : !Boolean(audioStream);

    return {
      userId,
      fullName: entry?.fullName || fullName || `User ${String(userId).slice(-4)}`,
      isMe: false,
      videoStream,
      muted,
      audioStream,
    };
  };

  const renderTiles = () => {
    const roster = Array.isArray(participants) ? participants : [];

    // Ensure we always include self even if roster is briefly empty
    const hasMe = roster.some((p) => String(p?.userId) === String(myUserId));
    const displayList = hasMe
      ? roster
      : [{ userId: myUserId, fullName: user?.fullName || user?.name || "You" }, ...roster];

    return displayList.map((p) => {
      const tile = getTileForUser(p?.userId, p?.fullName);

      return (
        <div
          key={tile.userId}
          className="relative rounded-2xl overflow-hidden border border-gray-700 bg-gray-800 aspect-square"
        >
          {/* if has camera -> show video; else show name block */}
          {tile.videoStream ? (
            <VideoEl stream={tile.videoStream} muted={tile.isMe} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
              <div className="text-center px-4">
                <div className="text-white text-xl font-bold break-words">
                  {tile.fullName}
                </div>
                <div className="text-gray-400 text-sm mt-2">
                  {tile.isMe ? "(You)" : ""}
                </div>
              </div>
            </div>
          )}

          {/* overlays */}
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            {tile.muted ? (
              <>
                <FaMicrophoneSlash /> <span>Muted</span>
              </>
            ) : (
              <>
                <FaMicrophone /> <span>Live</span>
              </>
            )}
          </div>

          {/* name bottom-left when video exists */}
          {tile.videoStream && (
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg max-w-[85%] truncate">
              {tile.fullName}
              {tile.isMe ? " (You)" : ""}
            </div>
          )}

          {/* remote audio elements */}
          {!tile.isMe && tile.audioStream && <AudioEl stream={tile.audioStream} />}
        </div>
      );
    });
  };

  if (!user?.id) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center p-12 bg-blue-300 dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-white text-3xl font-bold mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-300 text-lg">
            Please log in to access Meet With Friends
          </p>
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

          <div className="mb-8 flex justify-center">
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!socketConnected}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-lg shadow-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
                const count =
                  room?.participantsCount ?? (Array.isArray(list) ? list.length : 0);

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
                          isFull
                            ? "text-red-900 dark:text-red-300"
                            : "text-blue-900 dark:text-white"
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
        <div className="w-full h-full flex flex-col bg-gray-900">
          {/* Room Header */}
          <div className="flex justify-between items-center w-full p-6 bg-gray-800 border-b border-gray-700">
            <div>
              <h2 className="text-white text-2xl font-bold">{joinedRoom?.name} Room</h2>
              <p className="text-gray-300 text-sm mt-1">
                👥 {participants.length} {t("MeetWithFriends.participants")}
                {socketConnected && socketReady && (
                  <span className="text-green-400 ml-2">
                    🟢 {t("MeetWithFriends.Connected")}
                  </span>
                )}
                {(!socketConnected || !socketReady) && (
                  <span className="text-red-400 ml-2">
                    🔴 {t("MeetWithFriends.Connecting")}
                  </span>
                )}
              </p>

              <p className="text-gray-400 text-xs mt-1">
                {deviceReady ? "✅ Device" : "⏳ Device"} ·{" "}
                {sendTransportReady ? "✅ Send" : "⏳ Send"} ·{" "}
                {recvTransportReady ? "✅ Recv" : "⏳ Recv"}
              </p>
            </div>

            {/* INSIDE ROOM CONTROLS (no "view participants") */}
            <div className="flex gap-3">
              <button
                onClick={toggleMute}
                className={`px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition-colors flex items-center gap-2 ${
                  micMuted ? "bg-red-700 hover:bg-red-800 text-white" : "bg-green-700 hover:bg-green-800 text-white"
                }`}
                title={micMuted ? "Unmute" : "Mute"}
              >
                {micMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                {micMuted ? "Muted" : "Mic"}
              </button>

              <button
                onClick={toggleCamera}
                className={`px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition-colors flex items-center gap-2 ${
                  camOff ? "bg-gray-600 hover:bg-gray-700 text-white" : "bg-blue-700 hover:bg-blue-800 text-white"
                }`}
                title={camOff ? "Turn camera on" : "Turn camera off"}
              >
                {camOff ? <FaVideoSlash /> : <FaVideo />}
                {camOff ? "Cam Off" : "Cam"}
              </button>

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

          {/* REAL GRID (placeholder removed) */}
          <div className="flex-1 bg-black p-6 overflow-hidden">
            <div className="h-full min-h-0">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 h-full auto-rows-fr">
                {/* remoteVersion forces rerender when streams change */}
                <div className="hidden">{remoteVersion}</div>
                {renderTiles()}
              </div>
            </div>
          </div>
        </div>
      )}

      <RoomCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        isAdmin={user?.isAdmin}
        onCreate={async ({ name, maxParticipants, type }) => {
          try {
            let createdRoom = null;

            if (type === "permanent") {
              createdRoom = await api.post("/rooms/create-permanent", {
                name,
                maxParticipants,
              });
            } else {
              createdRoom = await api.post("/rooms/create", {
                name,
                maxParticipants,
              });
            }

            setShowCreateModal(false);

            // Refresh list
            await fetchRooms();

            // Auto-join ONLY temporary rooms
            if (type !== "permanent" && createdRoom?.room?._id) {
              const room = createdRoom.room;

              joinedRoomIdRef.current = room._id;
              setJoinedRoom(room);
              setParticipants(createdRoom?.roster?.participants || []);

              // IMPORTANT: Do NOT emit rtc:join-room
              // Backend already joined the socket inside /rooms/create
            }
          } catch (e) {
            console.error("Create failed:", e);
          }
        }}
      />
    </div>
  );
}