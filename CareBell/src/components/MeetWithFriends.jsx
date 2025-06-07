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
      <div className="w-full h-full bg-black flex items-center justify-center">
        <h2 className="text-white text-xl">Please log in to use video rooms</h2>
      </div>
    );
  }

  // Main render
  return (
    <div className="w-full h-full bg-black relative">
      {/* 5) If no room is joined, show room list + "Create Room" input */}
      {!joinedRoom ? (
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-white text-2xl mb-4">Video Rooms</h2>

          <div className="mb-4 flex items-center">
            <input
              type="text"
              className="px-2 py-1 rounded mr-2"
              placeholder="Room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
            />
            <button
              className="px-4 py-2 bg-green-600 text-white rounded"
              onClick={createRoom}
            >
              Create Room
            </button>
          </div>

          <ul className="text-white w-96">
            {rooms.map((r) => (
              <li
                key={r._id}
                className="flex justify-between items-center mb-2 bg-gray-800 p-2 rounded"
              >
                <span>{r.name}</span>
                <button
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                  onClick={() => joinRoom(r.name)}
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col">
          {/* Room Header */}
          <div className="flex justify-between items-center w-full p-4 bg-gray-900">
            <span className="text-white text-lg">Room: {joinedRoom}</span>
            <div className="flex gap-2">
              {!isInCall ? (
                <button
                  onClick={startVideoCall}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Start Video Call
                </button>
              ) : (
                <button
                  onClick={stopVideoCall}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  End Call
                </button>
              )}
              <button
                onClick={leaveRoom}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Leave Room
              </button>
            </div>
          </div>

          {/* Video Call Interface */}
          {isInCall ? (
            <div className="flex-1 bg-black p-4">
              {/* Video Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
                {/* Local Video */}
                <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                    You
                  </div>
                </div>

                {/* Remote Videos */}
                {participants.map((participantId) => {
                  const videoRef = remoteVideoRefs.current.get(participantId);
                  return (
                    <div key={participantId} className="relative bg-gray-800 rounded-lg overflow-hidden">
                      <video
                        ref={(el) => {
                          if (videoRef) videoRef.current = el;
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                        User {participantId}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Call Info */}
              <div className="mt-4 text-center text-white">
                <p>Participants: {participants.length + 1}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-4">Ready to start video call</h3>
                <p className="text-gray-600 mb-4">
                  Click "Start Video Call" to begin the meeting
                </p>
                <p className="text-sm text-gray-500">
                  Participants in room: {participants.length + 1}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
