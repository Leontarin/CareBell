import React, { useState, useRef, useEffect, useContext } from "react";
import io from "socket.io-client";
import axios from "axios";
import { API } from "../config";
import { AppContext } from '../AppContext';
import { WebRTCManager } from './WebRTCManager';

const SIGNALING_SERVER_URL = `${API}`;

function MeetWithFriends() {
  const { user } = useContext(AppContext);
  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [participants, setParticipants] = useState([]); // userIds
  const [videoPeers, setVideoPeers] = useState({}); // userId -> WebRTCManager
  const [loading, setLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const socketRef = useRef();

  // Fetch all rooms
  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/rooms`);
      setRooms(response.data);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  // Setup socket
  useEffect(() => {
    if (!user?.id) return;
    socketRef.current = io(SIGNALING_SERVER_URL, {
      transports: ["websocket", "polling"],
      secure: true,
      reconnection: true,
      rejectUnauthorized: false,
      timeout: 20000,
      forceNew: true,
      autoConnect: true,
      upgrade: true,
      rememberUpgrade: true
    });
    socketRef.current.emit("register", user.id);

    // Listen for participants update
    socketRef.current.on("room-participants", (userIds) => {
      setParticipants(userIds);
    });

    // Listen for WebRTC signals
    socketRef.current.on("signal", async ({ userId: remoteUserId, signal }) => {
      if (remoteUserId === user.id) return;
      if (videoPeers[remoteUserId] && videoPeers[remoteUserId].handleSignal) {
        videoPeers[remoteUserId].handleSignal({ signal });
      }
    });

    return () => {
      socketRef.current?.disconnect();
      cleanupAllPeers();
    };
    // eslint-disable-next-line
  }, [user?.id]);

  // Join a room
  const joinRoom = async (roomId) => {
    if (!user?.id) return;
    // Get local media
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      alert("Could not access camera/mic: " + err.message);
      return;
    }
    socketRef.current.emit("join-room", { roomId, userId: user.id });
    setJoinedRoom(roomId);
  };

  // Leave a room
  const leaveRoom = () => {
    if (!joinedRoom || !user?.id) return;
    socketRef.current.emit("leave-room", { roomId: joinedRoom, userId: user.id });
    setJoinedRoom(null);
    setParticipants([]);
    cleanupAllPeers();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  // Create a room and join it
  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const response = await axios.post(`${API}/rooms/create`, { name: newRoomName, userId: user.id });
      setNewRoomName("");
      fetchRooms();
      joinRoom(response.data._id);
    } catch (err) {
      alert("Failed to create room: " + err.message);
    }
  };

  // WebRTC peer management
  useEffect(() => {
    if (!joinedRoom || !localStreamRef.current) return;
    // For each participant (except self), create a peer if not exists
    participants.forEach(remoteUserId => {
      if (remoteUserId === user.id) return;
      if (!videoPeers[remoteUserId]) {
        const remoteVideoRef = React.createRef();
        const manager = new WebRTCManager(
          localVideoRef,
          remoteVideoRef,
          socketRef.current,
          joinedRoom
        );
        manager.initialize(localStreamRef.current, user.id < remoteUserId); // deterministic initiator
        setVideoPeers(prev => ({ ...prev, [remoteUserId]: manager }));
      }
    });
    // Remove peers for users who left
    Object.keys(videoPeers).forEach(peerId => {
      if (!participants.includes(peerId)) {
        videoPeers[peerId].destroy();
        setVideoPeers(prev => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
      }
    });
    // eslint-disable-next-line
  }, [participants, joinedRoom, localStreamRef.current]);

  // Ensure local video is always set when joining a room or stream changes
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [joinedRoom, localStreamRef.current]);

  const cleanupAllPeers = () => {
    Object.values(videoPeers).forEach(manager => manager.destroy && manager.destroy());
    setVideoPeers({});
  };

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
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              placeholder="Room name"
              className="px-2 py-1 rounded mr-2"
            />
            <button onClick={createRoom} className="px-4 py-2 bg-green-600 text-white rounded">Create Room</button>
          </div>
          <ul className="text-white w-96">
            {rooms.map(room => (
              <li key={room._id} className="flex justify-between items-center mb-2 bg-gray-800 p-2 rounded">
                <span>{room.name}</span>
                <button
                  onClick={() => joinRoom(room._id)}
                  className="px-3 py-1 bg-blue-500 text-white rounded"
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
            {/* Local video */}
            <div className="m-2">
              <video
                ref={localVideoRef}
                playsInline
                autoPlay
                muted
                className="w-64 h-48 bg-black border-4 border-green-400 rounded-lg"
              />
              <div className="text-center text-white mt-2">You</div>
            </div>
            {/* Remote videos */}
            {participants.filter(pid => pid !== user.id).map(pid => (
              <div className="m-2" key={pid}>
                <video
                  ref={videoPeers[pid]?.remoteVideoRef || null}
                  playsInline
                  autoPlay
                  className="w-64 h-48 bg-black border-4 border-blue-400 rounded-lg"
                />
                <div className="text-center text-white mt-2">{pid}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MeetWithFriends;