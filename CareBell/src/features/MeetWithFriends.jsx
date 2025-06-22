// src/MeetWithFriends.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API } from "../shared/config";
import { AppContext } from "../shared/AppContext";
import { WebRTCManager } from "../components/WebRTCManager";
import { useTranslation } from "react-i18next";

export default function MeetWithFriends() {
  const { user } = useContext(AppContext);
  const { t } = useTranslation();

  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [roomParticipants, setRoomParticipants] = useState(new Map());

  // Video call state
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [webRTCManagers, setWebRTCManagers] = useState(new Map());

  // Refs
  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const connectionTimeouts = useRef(new Map());

  // Initialize socket connection
  useEffect(() => {
    console.log('🔌 Initializing socket connection to:', API);
    
    const socket = io(API, {
      withCredentials: false,
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Socket connected successfully:', socket.id);
      if (user?.id) {
        console.log('👤 Registering user:', user.id);
        socket.emit('register', user.id);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    // Listen for room participants updates
    socket.on('room-participants', (participantList) => {
      console.log('👥 Room participants updated:', participantList, 'for user', user?.id);
      
      // Ensure current user is in the list
      if (user?.id && !participantList.includes(user.id)) {
        participantList = [...participantList, user.id];
      }
      
      setParticipants(participantList);
    });

    // Listen for WebRTC signals
    socket.on('signal', async ({ userId, signal }) => {
      console.log('📡 Received signal from', userId, ':', signal.type);

      setWebRTCManagers(currentManagers => {
        const manager = currentManagers.get(userId);
        if (manager) {
          manager.handleSignal({ signal }).catch(err => {
            console.error('❌ Error handling signal from', userId, ':', err);
          });
        } else {
          console.warn('⚠️ No WebRTC manager found for user:', userId);
        }
        return currentManagers;
      });
    });

    // Listen for room participant counts
    socket.on('room-participant-count', ({ roomName, count }) => {
      console.log('📊 Received participant count for room', roomName, ':', count);
      setRoomParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(roomName, count);
        return newMap;
      });
    });

    return () => {
      console.log('🧹 Cleaning up socket connection');
      socket.disconnect();
    };
  }, [user?.id]);

  // Request participant counts for rooms
  useEffect(() => {
    if (!socketRef.current?.connected || rooms.length === 0) return;

    const requestCounts = () => {
      rooms.forEach(room => {
        socketRef.current.emit('get-room-participant-count', room.name);
      });
    };

    requestCounts();
    const interval = setInterval(requestCounts, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [rooms, socketRef.current?.connected]);

  // Fetch rooms on mount
  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await axios.get(`${API}/rooms`);
        setRooms(res.data);
        
        // Request participant counts after rooms are loaded
        if (socketRef.current?.connected) {
          res.data.forEach(room => {
            socketRef.current.emit('get-room-participant-count', room.name);
          });
        }
      } catch (e) {
        console.error("❌ Error fetching rooms:", e);
      }
    }
    fetchRooms();
  }, []);

  // Handle WebRTC connections when participants change
  useEffect(() => {
    if (!isInCall || !localStream || !joinedRoom || !user?.id || participants.length === 0) {
      return;
    }

    console.log('🔄 Processing participant changes for', user.id);
    console.log('Current participants:', participants);
    console.log('Current managers:', Array.from(webRTCManagers.keys()));

    // Create connections for new participants
    participants.forEach(async (participantId) => {
      if (participantId === user.id) return; // Skip self

      if (!webRTCManagers.has(participantId)) {
        console.log('🆕 Creating WebRTC connection for participant:', participantId);
        await createWebRTCConnection(participantId);
      }
    });

    // Clean up connections for participants who left
    const currentManagerKeys = Array.from(webRTCManagers.keys());
    currentManagerKeys.forEach((participantId) => {
      if (!participants.includes(participantId)) {
        console.log('🧹 Cleaning up connection for participant who left:', participantId);
        cleanupWebRTCConnection(participantId);
      }
    });
  }, [participants, isInCall, localStream, joinedRoom, user?.id]);

  const createWebRTCConnection = async (participantId) => {
    try {
      // Create video ref
      const remoteVideoRef = React.createRef();
      remoteVideoRefs.current.set(participantId, remoteVideoRef);

      // Determine who initiates the connection (consistent ordering)
      const isInitiator = user.id.localeCompare(participantId) < 0;
      
      const manager = new WebRTCManager(
        localVideoRef,
        remoteVideoRef,
        socketRef.current,
        joinedRoom,
        user.id,
        user.id.localeCompare(participantId) > 0 // polite role
      );

      // Set up connection retry logic
      manager.onConnectionFailed = () => {
        console.log('🔄 Connection failed with', participantId, 'attempting retry');
        
        // Clear the failed connection
        cleanupWebRTCConnection(participantId);
        
        // Retry after a delay
        const timeoutId = setTimeout(() => {
          console.log('🔁 Retrying connection with', participantId);
          createWebRTCConnection(participantId);
        }, 2000);
        
        connectionTimeouts.current.set(participantId, timeoutId);
      };

      // Handle remote stream
      manager.onRemoteStream = (stream) => {
        console.log('🎥 Received remote stream from', participantId);
        console.log('Stream tracks:', stream.getTracks().map(t => ({ 
          kind: t.kind, 
          enabled: t.enabled, 
          readyState: t.readyState 
        })));

        // Update state
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(participantId, stream);
          return newMap;
        });

        // Set video element
        setTimeout(() => {
          const videoRef = remoteVideoRefs.current.get(participantId);
          if (videoRef?.current) {
            console.log('📺 Setting video element for', participantId);
            videoRef.current.srcObject = stream;
            videoRef.current.volume = 1.0;
            videoRef.current.muted = false;
            
            videoRef.current.onloadedmetadata = () => {
              console.log('📊 Video metadata loaded for', participantId);
            };
            
            videoRef.current.play().catch(e => {
              console.log('⚠️ Autoplay prevented for', participantId, ':', e.message);
            });
          }
        }, 100);
      };

      // Store manager
      setWebRTCManagers(prev => {
        const newMap = new Map(prev);
        newMap.set(participantId, manager);
        return newMap;
      });

      // Initialize connection
      console.log('🚀 Initializing connection with', participantId, 'as initiator:', isInitiator);
      await manager.initialize(localStream, isInitiator);

    } catch (error) {
      console.error('❌ Failed to create WebRTC connection with', participantId, ':', error);
    }
  };

  const cleanupWebRTCConnection = (participantId) => {
    // Clear any pending timeouts
    const timeoutId = connectionTimeouts.current.get(participantId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      connectionTimeouts.current.delete(participantId);
    }

    // Cleanup manager
    setWebRTCManagers(prev => {
      const manager = prev.get(participantId);
      if (manager) {
        try {
          manager.destroy();
        } catch (e) {
          console.warn('⚠️ Error destroying manager for', participantId, ':', e);
        }
      }
      
      const newMap = new Map(prev);
      newMap.delete(participantId);
      return newMap;
    });

    // Cleanup stream
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(participantId);
      return newMap;
    });

    // Cleanup video ref
    remoteVideoRefs.current.delete(participantId);
  };

  // Create room
  async function createRoom() {
    if (!newRoomName.trim()) return;
    try {
      const { data } = await axios.post(`${API}/rooms/create`, {
        name: newRoomName,
        userId: user.id,
      });
      setNewRoomName("");
      setRooms((prev) => [...prev, data]);
      await joinRoom(data.name);
    } catch (e) {
      alert("Failed to create room: " + e.message);
    }
  }

  // Join room
  async function joinRoom(roomName) {
    if (!user?.id || !socketRef.current?.connected) {
      console.error('❌ Cannot join room: user or socket not ready');
      return;
    }

    console.log('🚪 Joining room:', roomName);
    setJoinedRoom(roomName);

    try {
      // Get media access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('🎥 Local stream obtained:', stream.getTracks().map(t => ({ 
        kind: t.kind, 
        enabled: t.enabled 
      })));

      setLocalStream(stream);
      setIsInCall(true);

      // Set local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Join room via socket with a small delay
      setTimeout(() => {
        if (socketRef.current?.connected) {
          console.log('📡 Emitting join-room event');
          socketRef.current.emit('join-room', {
            roomId: roomName,
            userId: user.id
          });
        }
      }, 100);

    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions and try again.');
      setJoinedRoom(null);
    }
  }

  // Stop video call
  function stopVideoCall() {
    console.log('🛑 Stopping video call');

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Clean up all WebRTC connections
    webRTCManagers.forEach((manager, participantId) => {
      cleanupWebRTCConnection(participantId);
    });

    // Clear timeouts
    connectionTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    connectionTimeouts.current.clear();

    // Leave room via socket
    if (socketRef.current?.connected && joinedRoom) {
      socketRef.current.emit('leave-room', {
        roomId: joinedRoom,
        userId: user.id
      });
    }

    setIsInCall(false);
    setParticipants([]);
    setWebRTCManagers(new Map());
    setRemoteStreams(new Map());
    remoteVideoRefs.current.clear();
  }

  // Leave room
  function leaveRoom() {
    stopVideoCall();
    setJoinedRoom(null);
  }

  if (!user?.id) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center p-12 bg-blue-300 dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-white text-3xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-300 text-lg">Please log in to access video rooms</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-blue-300 dark:bg-gray-900 relative overflow-hidden">
      {!joinedRoom ? (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <h2 className="text-black dark:text-white text-3xl mb-8 font-bold">
            {t("MeetWithFriends.Title")}
          </h2>

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
              {t("MeetWithFriends.createRoom")}
            </button>
          </div>

          <div className="w-full max-w-2xl">
            <h3 className="text-black dark:text-white text-xl mb-4">
              {t("MeetWithFriends.availableRooms")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((r) => {
                const participantCount = roomParticipants.get(r.name) || 0;
                return (
                  <div
                    key={r._id}
                    className="flex flex-col justify-between bg-blue-100 dark:bg-[#2b2b2f] border border-blue-700 rounded-xl p-6 shadow-md hover:shadow-xl transition duration-300 dark:border-yellow-400"
                    style={{ minHeight: '200px' }}
                  >
                    <div>
                      <h4 className="text-blue-900 dark:text-white text-xl font-semibold mb-1">
                        {r.name}
                      </h4>
                      <p className="text-gray-700 dark:text-gray-400 text-sm">
                        👥 {participantCount} {t("MeetWithFriends.participant")}
                        {participantCount !== 1 ? t("MeetWithFriends.s") : ""} {t("MeetWithFriends.online")}
                      </p>
                    </div>

                    <button
                      onClick={() => joinRoom(r.name)}
                      className="mt-4 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold py-2 px-4 rounded-lg text-center transition-all"
                    >
                      🎥 {t("MeetWithFriends.joinCall")}
                    </button>
                  </div>
                );
              })}
            </div>

            {rooms.length === 0 && (
              <p className="text-gray-400 text-center py-8">
                {t("MeetWithFriends.noRooms")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col bg-gray-900">
          {/* Room Header */}
          <div className="flex justify-between items-center w-full p-6 bg-gray-800 border-b border-gray-700">
            <div>
              <h2 className="text-white text-2xl font-bold">
                🎥 {t("MeetWithFriends.room")} {joinedRoom}
              </h2>
              <p className="text-gray-300 text-sm mt-1">
                👥 {participants.length} {t("MeetWithFriends.participant")}
                {participants.length !== 1 ? t("MeetWithFriends.s") : ''} in call
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={stopVideoCall}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-lg shadow-lg transition-colors"
              >
                📞 {t("MeetWithFriends.endCall")}
              </button>
              <button
                onClick={leaveRoom}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold text-lg shadow-lg transition-colors"
              >
                🚪 {t("MeetWithFriends.leaveRoom")}
              </button>
            </div>
          </div>

          {/* Video Grid */}
          <div className="flex-1 bg-black p-6 overflow-hidden">
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
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                  You
                </div>
              </div>

              {/* Remote Videos */}
              {participants.filter(pid => pid !== user.id).map((participantId) => {
                // Ensure we have a ref for this participant
                if (!remoteVideoRefs.current.has(participantId)) {
                  remoteVideoRefs.current.set(participantId, React.createRef());
                  }
               
               const videoRef = remoteVideoRefs.current.get(participantId);
               const stream = remoteStreams.get(participantId);
               
               return (
                 <div key={participantId} className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-blue-500">
                   <video
                     ref={videoRef}
                     autoPlay
                     playsInline
                     controls={false}
                     volume={1.0}
                     muted={false}
                     className="w-full h-full object-cover"
                     onLoadedMetadata={(e) => {
                       console.log('📊 Video metadata loaded for', participantId);
                     }}
                     onPlay={() => {
                       console.log('▶️ Video started playing for', participantId);
                     }}
                     onError={(e) => {
                       console.error('❌ Video error for', participantId, ':', e);
                     }}
                   />
                   
                   {/* User label */}
                   <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                     {participantId}
                   </div>
                   
                   {/* Connection status */}
                   <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                     {stream ? `✅ Connected (${stream.getTracks().length} tracks)` : '🔄 Connecting...'}
                   </div>
                 </div>
               );
             })}
           </div>

           {/* Call Info */}
           <div className="mt-6 text-center">
             <div className="bg-gray-800 rounded-lg p-4 inline-block">
               <p className="text-white text-lg font-semibold">
                 👥 {t("MeetWithFriends.activeParticipants")} {participants.length}
               </p>
               <p className="text-gray-300 text-sm mt-1">
                 {t("MeetWithFriends.videoCallInProgress")}
               </p>
               
               {/* Debug info in development */}
               {process.env.NODE_ENV === 'development' && (
                 <div className="mt-2 text-xs text-gray-400">
                   <p>Socket: {socketRef.current?.connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
                   <p>Participants: {participants.join(', ')}</p>
                   <p>Connections: {Array.from(webRTCManagers.keys()).join(', ')}</p>
                 </div>
               )}
             </div>
           </div>
         </div>
       </div>
     )}
   </div>
 );
}