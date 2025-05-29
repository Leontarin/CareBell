import React, { useState, useRef, useEffect, useContext } from "react";
import io from "socket.io-client";
import axios from "axios";
import { API } from "../config";
import { AppContext } from "../AppContext";
import { WebRTCManager } from "./WebRTCManager";

const SIGNALING_SERVER_URL = `${API}`;

function MeetWithFriends() {
  const { user } = useContext(AppContext);

  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [videoPeers, setVideoPeers] = useState({});
  const [pendingSignals, setPendingSignals] = useState({});
  const [loading, setLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  const localVideoRef   = useRef(null);
  const localStreamRef  = useRef(null);
  const socketRef       = useRef();
  const videoPeersRef   = useRef({});
  const remoteVideoRefs = useRef({});
  const prevParticipantsRef = useRef([]);

  // Sync peer ref
  useEffect(() => {
    videoPeersRef.current = videoPeers;
  }, [videoPeers]);

  // Fetch rooms
  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/rooms`);
      setRooms(res.data);
    } catch (e) {
      console.error("Error fetching rooms:", e);
    } finally {
      setLoading(false);
    }
  }

  // Attach local preview
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  });

  // Signaling socket
  useEffect(() => {
    if (!user?.id) return;
    const socket = io(SIGNALING_SERVER_URL, {
      transports: ["websocket","polling"],
      secure: true, reconnection: true,
      rejectUnauthorized: false,
      timeout: 20000, forceNew: true,
      upgrade: true, rememberUpgrade: true
    });
    socketRef.current = socket;
    socket.emit("register", user.id);

    socket.on("room-participants", (ids) => {
      setParticipants(ids);
    });

    socket.on("signal", async ({ userId: from, signal }) => {
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
      socket.disconnect();
      cleanupAllPeers();
    };
  }, [user?.id]);

  function queueSignal(id, sig) {
    setPendingSignals(ps => ({
      ...ps,
      [id]: [...(ps[id]||[]), sig]
    }));
  }

  // Join room
  async function joinRoom(roomId) {
    if (!user?.id) return;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
    } catch (err) {
      alert("Could not access camera/mic: " + err.message);
      return;
    }
    setJoinedRoom(roomId);
    socketRef.current.emit("join-room", { roomId, userId: user.id });
  }

  // Leave room
  function leaveRoom() {
    if (!joinedRoom || !user?.id) return;
    socketRef.current.emit("leave-room", { roomId: joinedRoom, userId: user.id });
    setJoinedRoom(null);
    setParticipants([]);
    cleanupAllPeers();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
  }

  // Create room
  async function createRoom() {
    if (!newRoomName.trim()) return;
    try {
      const { data } = await axios.post(`${API}/rooms/create`, { name: newRoomName, userId: user.id });
      setNewRoomName("");
      fetchRooms();
      joinRoom(data._id);
    } catch (e) {
      alert("Failed to create room: " + e.message);
    }
  }

  // Handle multi-peer diff
  useEffect(() => {
    if (!joinedRoom || !localStreamRef.current) return;

    const prev = prevParticipantsRef.current;
    const added = participants.filter(id => !prev.includes(id));
    const removed = prev.filter(id => !participants.includes(id));
    prevParticipantsRef.current = participants;

    // Remove old peers
    removed.forEach(peerId => {
      if (videoPeersRef.current[peerId]) {
        videoPeersRef.current[peerId].destroy();
        setVideoPeers(vp => { const c = { ...vp }; delete c[peerId]; return c; });
        delete remoteVideoRefs.current[peerId];
      }
    });

    // Create new peers
    added.forEach(async peerId => {
      if (peerId === user.id) return;
      if (!remoteVideoRefs.current[peerId]) {
        remoteVideoRefs.current[peerId] = React.createRef();
      }
      const remoteRef = remoteVideoRefs.current[peerId];
      const polite    = user.id > peerId;
      const manager   = new WebRTCManager(
        localVideoRef,
        remoteRef,
        socketRef.current,
        joinedRoom,
        user.id,
        polite
      );
      manager.onConnectionFailed = () => recreatePeer(peerId);

      videoPeersRef.current = { ...videoPeersRef.current, [peerId]: manager };
      setVideoPeers(vp => ({ ...vp, [peerId]: manager }));

      await new Promise(r => setTimeout(r, added.indexOf(peerId) * 200 + Math.random() * 100));
      const shouldOffer = user.id.localeCompare(peerId) < 0;
      await manager.initialize(localStreamRef.current, shouldOffer);

      const queue = pendingSignals[peerId] || [];
      for (const sig of queue) {
        try {
          await manager.handleSignal({ signal: sig });
        } catch {}
      }
      setPendingSignals(ps => { const c = { ...ps }; delete c[peerId]; return c; });
    });
  }, [participants, joinedRoom]);

  // Cleanup function
  function cleanupAllPeers() {
    Object.values(videoPeersRef.current).forEach(m => m.destroy?.());
    setVideoPeers({});
    remoteVideoRefs.current = {};
    setPendingSignals({});
    videoPeersRef.current = {};
  }

  // Recreate on fail
  async function recreatePeer(peerId) {
    if (videoPeersRef.current[peerId]) {
      videoPeersRef.current[peerId].destroy();
    }
    setVideoPeers(vp => { const c = { ...vp }; delete c[peerId]; return c; });
    videoPeersRef.current = { ...videoPeersRef.current };
    delete videoPeersRef.current[peerId];

    if (participants.includes(peerId) && localStreamRef.current) {
      if (!remoteVideoRefs.current[peerId]) {
        remoteVideoRefs.current[peerId] = React.createRef();
      }
      const remoteRef = remoteVideoRefs.current[peerId];
      const polite    = user.id > peerId;
      const manager   = new WebRTCManager(
        localVideoRef,
        remoteRef,
        socketRef.current,
        joinedRoom,
        user.id,
        polite
      );
      manager.onConnectionFailed = () => recreatePeer(peerId);

      videoPeersRef.current = { ...videoPeersRef.current, [peerId]: manager };
      setVideoPeers(vp => ({ ...vp, [peerId]: manager }));

      const shouldOffer = user.id.localeCompare(peerId) < 0;
      await manager.initialize(localStreamRef.current, shouldOffer);

      const queue = pendingSignals[peerId] || [];
      for (const sig of queue) {
        try {
          await manager.handleSignal({ signal: sig });
        } catch {}
      }
      setPendingSignals(ps => { const c = { ...ps }; delete c[peerId]; return c; });
    }
  }

  if (!user?.id) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <h2 className="text-white text-xl">Please log in to use video rooms</h2>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black relative">
      {!joinedRoom ? (
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-white text-2xl mb-4">Video Rooms</h2>
          <div className="mb-4">
            <input
              type="text"
              className="px-2 py-1 rounded mr-2"
              placeholder="Room name"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
            />
            <button
              className="px-4 py-2 bg-green-600 text-white rounded"
              onClick={createRoom}
            >Create Room</button>
          </div>
          <ul className="text-white w-96">
            {rooms.map(r => (
              <li key={r._id} className="flex justify-between items-center mb-2 bg-gray-800 p-2 rounded">
                <span>{r.name}</span>
                <button
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                  onClick={() => joinRoom(r._id)}
                >Join</button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center">
          <div className="flex justify-between w-full p-4">
            <span className="text-white text-lg">Room: {rooms.find(r => r._id === joinedRoom)?.name}</span>
            <button onClick={leaveRoom} className="px-4 py-2 bg-red-600 text-white rounded">Leave Room</button>
          </div>
          <div className="flex flex-wrap justify-center items-center w-full h-full">
            <div className="m-2">
              <video
                ref={localVideoRef}
                playsInline autoPlay muted
                className="w-64 h-48 bg-black border-4 border-green-400 rounded-lg"
              />
              <div className="text-center text-white mt-2">You</div>
            </div>
            {participants
              .filter(pid => pid !== user.id)
              .map(pid => (
                <div key={pid} className="m-2">
                  <video
                    ref={remoteVideoRefs.current[pid]}
                    playsInline autoPlay muted
                    className="w-64 h-48 bg-black border-4 border-blue-400 rounded-lg"
                  />
                  <div className="text-center text-white mt-2">User: {pid} {videoPeers[pid] ? "(Connected)" : "(Connecting...)"}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MeetWithFriends;
