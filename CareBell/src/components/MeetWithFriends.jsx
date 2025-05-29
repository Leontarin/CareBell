import React, { useState, useRef, useEffect, useContext } from "react";
import io from "socket.io-client";
import axios from "axios";
import { API } from "../config";
import { AppContext } from "../AppContext";
import { WebRTCManager } from "./WebRTCManager";

const SIGNALING_SERVER_URL = `${API}`;

function MeetWithFriends() {
  const { user } = useContext(AppContext);

  // rooms + UX state
  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [videoPeers, setVideoPeers] = useState({});
  const [pendingSignals, setPendingSignals] = useState({});
  const [connectionRetries, setConnectionRetries] = useState({});
  const [loading, setLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  // refs
  const localVideoRef    = useRef(null);
  const localStreamRef   = useRef(null);
  const socketRef        = useRef();
  const videoPeersRef    = useRef({});
  const remoteVideoRefs  = useRef({});   // ← switched from useState to useRef map

  // keep videoPeersRef in sync
  useEffect(() => {
    videoPeersRef.current = videoPeers;
  }, [videoPeers]);

  // fetch rooms once
  useEffect(fetchRooms, []);

  async function fetchRooms() {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/rooms`);
      setRooms(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // socket setup
  useEffect(() => {
    if (!user?.id) return;
    socketRef.current = io(SIGNALING_SERVER_URL, {
      transports: ["websocket","polling"],
      secure: true,
      reconnection: true,
      rejectUnauthorized: false,
      timeout: 20000,
      forceNew: true,
      upgrade: true,
      rememberUpgrade: true
    });
    socketRef.current.emit("register", user.id);
    socketRef.current.on("room-participants", setParticipants);

    socketRef.current.on("signal", async ({ userId: from, signal }) => {
      if (from === user.id) return;
      const peers = videoPeersRef.current;
      if (peers[from]?.handleSignal) {
        try {
          await new Promise(r => setTimeout(r, 10));
          const ok = await peers[from].handleSignal({ signal });
          if (!ok) queueSignal(from, signal);
        } catch {
          queueSignal(from, signal);
        }
      } else {
        queueSignal(from, signal);
      }
    });

    return () => {
      socketRef.current.disconnect();
      cleanupAllPeers();
    };
  }, [user?.id]);

  function queueSignal(id, sig) {
    setPendingSignals(ps => ({
      ...ps,
      [id]: [...(ps[id] || []), sig]
    }));
  }

  // join / leave / create room
  async function joinRoom(roomId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true, audio: true
      });
      localStreamRef.current = stream;
      localVideoRef.current.srcObject = stream;
    } catch (err) {
      return alert("Camera/mic error: " + err.message);
    }
    socketRef.current.emit("join-room", {
      roomId, userId: user.id
    });
    setJoinedRoom(roomId);
  }

  function leaveRoom() {
    socketRef.current.emit("leave-room", {
      roomId: joinedRoom, userId: user.id
    });
    setJoinedRoom(null);
    setParticipants([]);
    cleanupAllPeers();
    localStreamRef.current
      .getTracks()
      .forEach(t => t.stop());
    localStreamRef.current = null;
  }

  async function createRoom() {
    if (!newRoomName.trim()) return;
    try {
      const { data } = await axios.post(
        `${API}/rooms/create`,
        { name: newRoomName, userId: user.id }
      );
      setNewRoomName("");
      fetchRooms();
      joinRoom(data._id);
    } catch (err) {
      alert("Create room failed: " + err.message);
    }
  }

  // manage peers whenever participants list changes
  useEffect(() => {
    if (!joinedRoom || !localStreamRef.current) return;

    async function buildPeers() {
      for (const peerId of participants) {
        if (peerId === user.id) continue;
        if (!videoPeers[peerId]) {
          // ensure a ref for this peer’s <video>
          if (!remoteVideoRefs.current[peerId]) {
            remoteVideoRefs.current[peerId] = React.createRef();
          }
          const remoteRef = remoteVideoRefs.current[peerId];
          const polite = user.id > peerId;
          const manager = new WebRTCManager(
            localVideoRef,
            remoteRef,
            socketRef.current,
            joinedRoom,
            user.id,
            polite
          );
          manager.onConnectionFailed = () => recreatePeer(peerId);

          videoPeersRef.current = {
            ...videoPeersRef.current,
            [peerId]: manager
          };
          setVideoPeers(vp => ({ ...vp, [peerId]: manager }));

          // small stagger to avoid collision
          const idx = participants.indexOf(peerId);
          await new Promise(r =>
            setTimeout(r, idx * 200 + Math.random() * 100)
          );

          const shouldOffer =
            user.id.localeCompare(peerId) < 0;
          await manager.initialize(
            localStreamRef.current,
            shouldOffer
          );

          // drain any queued signals
          const queue = pendingSignals[peerId] || [];
          for (const sig of queue) {
            try {
              await manager.handleSignal({ signal: sig });
              await new Promise(r => setTimeout(r, 50));
            } catch {}
          }
          setPendingSignals(ps => {
            const copy = { ...ps };
            delete copy[peerId];
            return copy;
          });
        }
      }

      // remove peers who left
      Object.keys(videoPeers).forEach(pid => {
        if (!participants.includes(pid)) {
          videoPeers[pid].destroy();
          setVideoPeers(vp => {
            const c = { ...vp };
            delete c[pid];
            return c;
          });
          delete remoteVideoRefs.current[pid];
        }
      });
    }

    buildPeers();
  }, [participants, joinedRoom]);

  // keep local video attached
  useEffect(() => {
    if (localStreamRef.current) {
      localVideoRef.current.srcObject =
        localStreamRef.current;
    }
  }, [joinedRoom]);

  function cleanupAllPeers() {
    Object.values(videoPeersRef.current).forEach(m => {
      m.destroy && m.destroy();
    });
    setVideoPeers({});
    remoteVideoRefs.current = {};    // clear the ref map
    setPendingSignals({});
    setConnectionRetries({});
    videoPeersRef.current = {};
  }

  // render
  if (!user?.id) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <h2 className="text-white text-xl">
          Please log in to use video rooms
        </h2>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black relative">
      {!joinedRoom ? (
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-white text-2xl mb-4">
            Video Rooms
          </h2>
          <div className="mb-4">
            <input
              type="text"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              placeholder="Room name"
              className="px-2 py-1 rounded mr-2"
            />
            <button
              onClick={createRoom}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Create Room
            </button>
          </div>
          <ul className="text-white w-96">
            {rooms.map(r => (
              <li
                key={r._id}
                className="flex justify-between items-center mb-2 bg-gray-800 p-2 rounded"
              >
                <span>{r.name}</span>
                <button
                  onClick={() => joinRoom(r._id)}
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center">
          <div className="flex justify-between w-full p-4">
            <span className="text-white text-lg">
              Room:{" "}
              {rooms.find(r => r._id === joinedRoom)?.name}
            </span>
            <button
              onClick={leaveRoom}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Leave Room
            </button>
          </div>
          <div className="flex flex-wrap justify-center items-center w-full h-full">
            {/* local */}
            <div className="m-2">
              <video
                ref={localVideoRef}
                playsInline
                autoPlay
                muted
                className="w-64 h-48 bg-black border-4 border-green-400 rounded-lg"
              />
              <div className="text-center text-white mt-2">
                You
              </div>
            </div>
            {/* remote */}
            {participants
              .filter(pid => pid !== user.id)
              .map(pid => (
                <div className="m-2" key={pid}>
                  <video
                    ref={remoteVideoRefs.current[pid]}
                    playsInline
                    autoPlay
                    muted            // ← allow autoplay
                    className="w-64 h-48 bg-black border-4 border-blue-400 rounded-lg"
                  />
                  <div className="text-center text-white mt-2">
                    User: {pid}{" "}
                    {videoPeers[pid]
                      ? "(Connected)"
                      : "(Connecting...)"}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MeetWithFriends;
