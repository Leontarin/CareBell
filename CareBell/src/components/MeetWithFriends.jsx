// src/MeetWithFriends.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API } from "../config";
import { AppContext } from "../AppContext";
import { WebRTCManager } from "./WebRTCManager";

export default function MeetWithFriends() {
  const { user } = useContext(AppContext);

  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");

  // Video call state
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // userId -> MediaStream
  const [participants, setParticipants] = useState([]);
  const [webRTCManagers, setWebRTCManagers] = useState(new Map()); // userId -> WebRTCManager

  // Refs
  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const remoteVideoRefs = useRef(new Map()); // userId -> videoRef

  // Initialize socket connection
  useEffect(() => {
    const socket = io(API);
    socketRef.current = socket;

    if (user?.id) {
      socket.emit('register', user.id);
    }

    // Listen for room participants updates
    socket.on('room-participants', (participantList) => {
      console.log('Room participants updated:', participantList);
      setParticipants(participantList.filter(p => p !== user?.id));
    });

    // Listen for WebRTC signals
    socket.on('signal', async ({ signal, fromUser }) => {
      console.log('Received signal from', fromUser, ':', signal.type);
      const manager = webRTCManagers.get(fromUser);
      if (manager) {
        await manager.handleSignal({ signal });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  // 1) Fetch the list of rooms on mount
  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await axios.get(`${API}/rooms`);
        setRooms(res.data);
      } catch (e) {
        console.error("Error fetching rooms:", e);
      }
    }
    fetchRooms();
  }, []);

  // Handle participants joining/leaving and create WebRTC connections
  useEffect(() => {
    if (!isInCall || !localStream || !joinedRoom) return;

    participants.forEach(async (participantId) => {
      if (!webRTCManagers.has(participantId)) {
        // Create new WebRTC connection for this participant
        const remoteVideoRef = { current: null };
        remoteVideoRefs.current.set(participantId, remoteVideoRef);

        const manager = new WebRTCManager(
          localVideoRef,
          remoteVideoRef,
          socketRef.current,
          joinedRoom,
          user.id,
          user.id < participantId // Use consistent polite/impolite assignment
        );

        manager.onConnectionFailed = () => {
          console.log('Connection failed with', participantId);
        };

        // Handle remote stream
        manager.onRemoteStream = (stream) => {
          setRemoteStreams(prev => new Map(prev.set(participantId, stream)));
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        };

        setWebRTCManagers(prev => new Map(prev.set(participantId, manager)));

        // Initialize the connection
        const isInitiator = user.id < participantId;
        await manager.initialize(localStream, isInitiator);
      }
    });

    // Clean up connections for participants who left
    webRTCManagers.forEach((manager, participantId) => {
      if (!participants.includes(participantId)) {
        manager.cleanup();
        setWebRTCManagers(prev => {
          const newMap = new Map(prev);
          newMap.delete(participantId);
          return newMap;
        });
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(participantId);
          return newMap;
        });
        remoteVideoRefs.current.delete(participantId);
      }
    });
  }, [participants, isInCall, localStream, joinedRoom, user?.id, webRTCManagers]);

  // 2) Create a new room on the backend and immediately join it
  async function createRoom() {
    if (!newRoomName.trim()) return;
    try {
      const { data } = await axios.post(`${API}/rooms/create`, {
        name: newRoomName,
        userId: user.id,
      });
      setNewRoomName("");
      setRooms((prev) => [...prev, data]);
      setJoinedRoom(data.name);
    } catch (e) {
      alert("Failed to create room: " + e.message);
    }
  }

  // Start video call
  async function startVideoCall() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setLocalStream(stream);
      setIsInCall(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Join the room via socket
      socketRef.current.emit('join-room', {
        roomId: joinedRoom,
        userId: user.id
      });

    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  }

  // Stop video call
  function stopVideoCall() {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close all WebRTC connections
    webRTCManagers.forEach(manager => {
      manager.cleanup();
    });
    setWebRTCManagers(new Map());
    setRemoteStreams(new Map());

    // Leave the room via socket
    if (socketRef.current && joinedRoom) {
      socketRef.current.emit('leave-room', {
        roomId: joinedRoom,
        userId: user.id
      });
    }

    setIsInCall(false);
    setParticipants([]);
  }

  // 3) Join an existing room by name
  function joinRoom(roomName) {
    if (!user?.id) return;
    setJoinedRoom(roomName);
  }

  // 4) Leave the current room
  function leaveRoom() {
    stopVideoCall();
    setJoinedRoom(null);
  }

  // If user is not defined, show a message
  if (!user?.id) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center p-12 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-white text-3xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-300 text-lg">Please log in to access video rooms</p>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="w-full h-full bg-gray-900 relative overflow-hidden">
      {/* 5) If no room is joined, show room list + "Create Room" input */}
      {!joinedRoom ? (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <h2 className="text-white text-3xl mb-8 font-bold">Video Rooms</h2>

          <div className="mb-8 flex items-center">
            <input
              type="text"
              className="px-4 py-2 rounded-l border-none outline-none text-lg"
              placeholder="Enter room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
            />
            <button
              className="px-6 py-2 bg-green-600 text-white rounded-r hover:bg-green-700 text-lg font-semibold"
              onClick={createRoom}
            >
              Create Room
            </button>
          </div>

          <div className="w-full max-w-2xl">
            <h3 className="text-white text-xl mb-4">Available Rooms:</h3>
            <ul className="space-y-3">
              {rooms.map((r) => (
                <li
                  key={r._id}
                  className="flex justify-between items-center bg-gray-800 p-4 rounded-lg shadow-lg"
                >
                  <span className="text-white text-lg font-medium">{r.name}</span>
                  <button
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                    onClick={() => joinRoom(r.name)}
                  >
                    Join Room
                  </button>
                </li>
              ))}
            </ul>
            {rooms.length === 0 && (
              <p className="text-gray-400 text-center py-8">No rooms available. Create one to get started!</p>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col bg-gray-900">
          {/* Room Header */}
          <div className="flex justify-between items-center w-full p-6 bg-gray-800 border-b border-gray-700">
            <div>
              <h2 className="text-white text-2xl font-bold">Room: {joinedRoom}</h2>
              <p className="text-gray-300 text-sm mt-1">
                {isInCall ? `${participants.length + 1} participants in call` : 'Ready to start video call'}
              </p>
            </div>
            <div className="flex gap-3">
              {!isInCall ? (
                <button
                  onClick={startVideoCall}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-lg shadow-lg transition-colors"
                >
                  🎥 Start Video Call
                </button>
              ) : (
                <button
                  onClick={stopVideoCall}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-lg shadow-lg transition-colors"
                >
                  📞 End Call
                </button>
              )}
              <button
                onClick={leaveRoom}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold text-lg shadow-lg transition-colors"
              >
                🚪 Leave Room
              </button>
            </div>
          </div>

          {/* Video Call Interface */}
          {isInCall ? (
            <div className="flex-1 bg-black p-6 overflow-hidden">
              {/* Video Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full min-h-0">
                {/* Local Video */}
                <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-green-500">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 bg-green-600 bg-opacity-90 text-white px-3 py-2 rounded-lg font-semibold">
                    📹 You (Local)
                  </div>
                  <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    🔴 LIVE
                  </div>
                </div>

                {/* Remote Videos */}
                {participants.map((participantId) => {
                  const videoRef = remoteVideoRefs.current.get(participantId);
                  return (
                    <div key={participantId} className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-blue-500">
                      <video
                        ref={(el) => {
                          if (videoRef) videoRef.current = el;
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-4 left-4 bg-blue-600 bg-opacity-90 text-white px-3 py-2 rounded-lg font-semibold">
                        👤 User {participantId}
                      </div>
                      <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                        🔴 LIVE
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Call Controls & Info */}
              <div className="mt-6 text-center">
                <div className="bg-gray-800 rounded-lg p-4 inline-block">
                  <p className="text-white text-lg font-semibold">
                    👥 Active Participants: {participants.length + 1}
                  </p>
                  <p className="text-gray-300 text-sm mt-1">
                    Video call in progress
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
              <div className="text-center p-12 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 max-w-lg">
                <div className="text-6xl mb-6">🎥</div>
                <h3 className="text-3xl font-bold text-white mb-6">Ready to Connect</h3>
                <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                  Click "Start Video Call" to begin your meeting with other participants
                </p>
                <div className="bg-gray-700 rounded-lg p-4 mb-6">
                  <p className="text-white font-semibold text-lg">
                    👥 Participants in room: {participants.length + 1}
                  </p>
                  {participants.length > 0 && (
                    <p className="text-green-400 text-sm mt-2">
                      ✅ Other participants are ready to connect
                    </p>
                  )}
                </div>
                <div className="text-gray-400 text-sm">
                  💡 Make sure your camera and microphone are ready
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
