// src/features/MeetWithFriends.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API, P2P_CONFIG, P2P_SIGNALING_URL } from "../shared/config";
import { AppContext } from "../shared/AppContext";
import { WebRTCManager } from "../components/WebRTCManager";
import { DenoP2PSignaling } from "../components/DenoP2PSignaling";
import { useTranslation } from "react-i18next";
import { FaExpand, FaCompress } from "react-icons/fa";

// P2P Mesh Configuration
const MAX_P2P_PARTICIPANTS = P2P_CONFIG.MAX_PARTICIPANTS;

export default function MeetWithFriends() {
  const { user, meetFullscreen, setMeetFullscreen } = useContext(AppContext);
  const { t } = useTranslation();

  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [socket, setSocket] = useState(null);

  // P2P Video call state
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // userId -> MediaStream
  const [participants, setParticipants] = useState([]);
  const [p2pConnections, setP2pConnections] = useState(new Map()); // userId -> WebRTCManager
  const [connectionStates, setConnectionStates] = useState(new Map()); // userId -> connectionState
  const [p2pStats, setP2pStats] = useState({
    totalConnections: 0,
    connectedPeers: 0,
    failedConnections: 0
  });

  // Media control states
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // P2P Signaling
  const [denoSignaling, setDenoSignaling] = useState(null);
  const [signalingConnected, setSignalingConnected] = useState(false);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map()); // userId -> videoRef
  const connectionTimeouts = useRef(new Map());
  const retryAttempts = useRef(new Map()); // userId -> attemptCount

  // Socket.IO connection for real-time room updates
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔌 Connecting to room management socket...');
    const newSocket = io(P2P_SIGNALING_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to room management socket');
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from room management socket');
    });

    // Listen for real-time room updates
    newSocket.on('room-created', (room) => {
      console.log('🆕 New room created:', room.name);
      setRooms(prev => {
        // Avoid duplicates
        const exists = prev.find(r => r.name === room.name);
        if (exists) return prev;
        return [...prev, room];
      });
    });

    newSocket.on('room-updated', (room) => {
      console.log('🔄 Room updated:', room.name, 'participants:', room.participants.length);
      setRooms(prev => prev.map(r => r.name === room.name ? room : r));
    });

    newSocket.on('room-deleted', (data) => {
      console.log('🗑️ Room deleted:', data.name);
      setRooms(prev => prev.filter(r => r.name !== data.name));
      
      // If user was in the deleted room, handle cleanup
      if (joinedRoom === data.name) {
        console.log('🔄 Current room was deleted, leaving...');
        leaveRoom();
      }
    });

    setSocket(newSocket);

    return () => {
      console.log('🧹 Cleaning up room management socket');
      newSocket.disconnect();
    };
  }, [user?.id]);

  // Fullscreen toggle function
  const toggleFullscreen = () => {
    setMeetFullscreen(!meetFullscreen);
  };

  // Media control functions
  const toggleAudio = () => {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const newMutedState = !isAudioMuted;
      audioTracks[0].enabled = !newMutedState;
      setIsAudioMuted(newMutedState);
      console.log(`🎤 Audio ${newMutedState ? 'muted' : 'unmuted'}`);
    }
  };

  const toggleVideo = () => {
    if (!localStream) return;

    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      const newVideoOffState = !isVideoOff;
      videoTracks[0].enabled = !newVideoOffState;
      setIsVideoOff(newVideoOffState);
      console.log(`📹 Video ${newVideoOffState ? 'disabled' : 'enabled'}`);
    }
  };

  // Initialize Deno P2P signaling (replaces Socket.IO)
  useEffect(() => {
    if (!joinedRoom || !user?.id) return;

    console.log('🔌 Initializing Deno P2P signaling for room:', joinedRoom);
    
    const signaling = new DenoP2PSignaling(joinedRoom, user.id);
    
    // Set up signaling event handlers
    signaling.onConnected = () => {
      console.log('✅ Connected to Deno P2P signaling server');
      setSignalingConnected(true);
    };

    signaling.onDisconnected = () => {
      console.log('🔌 Disconnected from Deno P2P signaling server');
      setSignalingConnected(false);
    };

    signaling.onError = (error) => {
      console.error('❌ Deno P2P signaling error:', error);
      setSignalingConnected(false);
    };

    // Handle participants updates from Deno server
    signaling.onParticipantsUpdate = (participantList, newUser, leftUser) => {
      console.log('👥 P2P Participants updated:', participantList);
      
      // Enforce P2P mesh limit
      if (participantList.length > MAX_P2P_PARTICIPANTS) {
        console.warn(`⚠️ Too many participants (${participantList.length}). P2P mesh limited to ${MAX_P2P_PARTICIPANTS}`);
        alert(`Room limited to ${MAX_P2P_PARTICIPANTS} participants for optimal P2P performance.`);
        participantList = participantList.slice(0, MAX_P2P_PARTICIPANTS);
      }
      
      setParticipants(participantList);

      if (newUser) {
        console.log(`👋 New user joined: ${newUser}`);
      }
      if (leftUser) {
        console.log(`👋 User left: ${leftUser}`);
      }
    };

    // Handle P2P WebRTC signals from Deno server
    signaling.onP2PSignal = (fromUserId, signal) => {
      console.log('📡 Received P2P signal from', fromUserId, ':', signal.type);

      setP2pConnections(currentConnections => {
        const manager = currentConnections.get(fromUserId);
        if (manager) {
          manager.handleSignal({ signal }).catch(err => {
            console.error('❌ Error handling P2P signal from', fromUserId, ':', err);
            updateConnectionState(fromUserId, 'failed');
          });
        } else {
          console.warn('⚠️ No P2P WebRTC manager found for user:', fromUserId);
        }
        return currentConnections;
      });
    };

    // Connect to Deno signaling server
    signaling.connect();
    setDenoSignaling(signaling);

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up Deno P2P signaling');
      signaling.disconnect();
      setDenoSignaling(null);
      setSignalingConnected(false);
    };
  }, [joinedRoom, user?.id]);

  // Helper function to update connection states
  const updateConnectionState = (userId, state) => {
    setConnectionStates(prev => {
      const newMap = new Map(prev);
      newMap.set(userId, state);
      return newMap;
    });

    // Update P2P stats
    setTimeout(() => {
      setConnectionStates(currentStates => {
        const connections = Array.from(currentStates.values());
        setP2pStats({
          totalConnections: connections.length,
          connectedPeers: connections.filter(s => s === 'connected').length,
          failedConnections: connections.filter(s => s === 'failed').length
        });
        return currentStates;
      });
    }, 100);
  };

  // Fetch rooms from Vercel backend (non-P2P API calls)
  useEffect(() => {
    async function fetchRooms() {
      try {
        console.log('📋 Fetching rooms from backend...');
        const res = await axios.get(`${API}/rooms`);
        console.log('✅ Rooms fetched:', res.data.length, 'rooms');
        setRooms(res.data);
      } catch (e) {
        console.error("❌ Error fetching rooms:", e);
      }
    }
    fetchRooms();
  }, []);

  // Handle P2P mesh connections when participants change
  useEffect(() => {
    if (!isInCall || !localStream || !joinedRoom || !user?.id || !denoSignaling || !signalingConnected) {
      return;
    }

    console.log('🔄 Processing P2P mesh changes for', user.id);
    console.log('Current participants:', participants);
    console.log('Current P2P connections:', Array.from(p2pConnections.keys()));

    // Create P2P connections for new participants (full mesh)
    participants.forEach(async (participantId) => {
      if (participantId === user.id) return; // Skip self

      if (!p2pConnections.has(participantId)) {
        console.log('🆕 Creating P2P mesh connection for participant:', participantId);
        await createP2PConnection(participantId);
      }
    });

    // Clean up connections for participants who left
    const currentConnectionKeys = Array.from(p2pConnections.keys());
    currentConnectionKeys.forEach((participantId) => {
      if (!participants.includes(participantId)) {
        console.log('🧹 Cleaning up P2P connection for participant who left:', participantId);
        cleanupP2PConnection(participantId);
      }
    });

    // Update P2P statistics
    updateP2PStats();
  }, [participants, isInCall, localStream, joinedRoom, user?.id, denoSignaling, signalingConnected]);

  const createP2PConnection = async (participantId) => {
    try {
      // Check retry attempts
      const attempts = retryAttempts.current.get(participantId) || 0;
      if (attempts >= P2P_CONFIG.MAX_RETRY_ATTEMPTS) {
        console.log(`⚠️ Max retry attempts reached for P2P connection to ${participantId}`);
        updateConnectionState(participantId, 'failed');
        return;
      }

      // Create video ref
      const remoteVideoRef = React.createRef();
      remoteVideoRefs.current.set(participantId, remoteVideoRef);

      // Determine who initiates (consistent ordering for mesh)
      const isInitiator = user.id.localeCompare(participantId) < 0;
      
      // Create P2P manager with Deno signaling
      const manager = new WebRTCManager(
        localVideoRef,
        remoteVideoRef,
        denoSignaling, // Use Deno signaling instead of Socket.IO
        joinedRoom,
        user.id,
        participantId, // target user ID
        user.id.localeCompare(participantId) > 0 // polite role
      );

      // Set up connection failure handling
      manager.onConnectionFailed = () => {
        console.log('🔄 P2P Connection failed with', participantId, 'attempting retry');
        
        // Increment retry count
        const newAttempts = (retryAttempts.current.get(participantId) || 0) + 1;
        retryAttempts.current.set(participantId, newAttempts);
        
        // Clean up the failed connection
        cleanupP2PConnection(participantId);
        
        // Retry after a delay if under max attempts
        if (newAttempts < P2P_CONFIG.MAX_RETRY_ATTEMPTS) {
          const timeoutId = setTimeout(() => {
            console.log(`🔁 Retrying P2P connection with ${participantId} (attempt ${newAttempts + 1}/${P2P_CONFIG.MAX_RETRY_ATTEMPTS})`);
            createP2PConnection(participantId);
          }, P2P_CONFIG.RETRY_DELAY_BASE * newAttempts); // Exponential backoff
          
          connectionTimeouts.current.set(participantId, timeoutId);
        } else {
          console.log(`❌ P2P connection to ${participantId} failed permanently after ${P2P_CONFIG.MAX_RETRY_ATTEMPTS} attempts`);
          updateConnectionState(participantId, 'failed');
        }
      };

      // Handle successful connection
      manager.onConnectionEstablished = (targetUserId) => {
        console.log(`✅ P2P connection established with ${targetUserId}`);
        updateConnectionState(targetUserId, 'connected');
        retryAttempts.current.delete(targetUserId); // Reset retry count
      };

      // Handle remote stream
      manager.onRemoteStream = (stream) => {
        console.log('🎥 Received P2P remote stream from', participantId);
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
            console.log('📺 Setting P2P video element for', participantId);
            videoRef.current.srcObject = stream;
            videoRef.current.volume = 1.0;
            videoRef.current.muted = false;
            
            videoRef.current.onloadedmetadata = () => {
              console.log('📊 P2P Video metadata loaded for', participantId);
            };
            
            videoRef.current.play().catch(e => {
              console.log('⚠️ P2P Autoplay prevented for', participantId, ':', e.message);
            });
          }
        }, 100);
      };

      // Store manager
      setP2pConnections(prev => {
        const newMap = new Map(prev);
        newMap.set(participantId, manager);
        return newMap;
      });

      updateConnectionState(participantId, 'connecting');

      // Initialize P2P connection
      console.log('🚀 Initializing P2P mesh connection with', participantId, 'as initiator:', isInitiator);
      await manager.initialize(localStream, isInitiator);

    } catch (error) {
      console.error('❌ Failed to create P2P connection with', participantId, ':', error);
      updateConnectionState(participantId, 'failed');
    }
  };

  const cleanupP2PConnection = (participantId) => {
    // Clear any pending timeouts
    const timeoutId = connectionTimeouts.current.get(participantId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      connectionTimeouts.current.delete(participantId);
    }

    // Cleanup manager
    setP2pConnections(prev => {
      const manager = prev.get(participantId);
      if (manager) {
        try {
          manager.destroy();
        } catch (e) {
          console.warn('⚠️ Error destroying P2P manager for', participantId, ':', e);
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
    
    // Cleanup connection state
    setConnectionStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(participantId);
      return newMap;
    });
  };

  const updateP2PStats = () => {
    const states = Array.from(connectionStates.values());
    setP2pStats({
      totalConnections: states.length,
      connectedPeers: states.filter(s => s === 'connected').length,
      failedConnections: states.filter(s => s === 'failed').length
    });
  };

  // Create room (using Vercel backend)
  async function createRoom() {
    if (!newRoomName.trim()) return;
    
    try {
      console.log('🏗️ Creating room:', newRoomName);
      const { data } = await axios.post(`${API}/rooms/create`, {
        name: newRoomName,
        userId: user.id,
      });
      
      setNewRoomName("");
      console.log('✅ Room created successfully:', data);
      
      // Automatically join the created room
      await joinRoom(data.name);
      
    } catch (e) {
      const errorMsg = e.response?.data?.error || e.message;
      console.error('❌ Failed to create room:', errorMsg);
      alert("Failed to create room: " + errorMsg);
    }
  }

  // Join room with P2P mesh
  async function joinRoom(roomName) {
    if (!user?.id) {
      console.error('❌ Cannot join room: user not ready');
      return;
    }

    console.log('🚪 Joining P2P room:', roomName);
    
    try {
      // Notify backend that user is joining
      const response = await axios.post(`${API}/rooms/join`, {
        roomName: roomName,
        userId: user.id
      });

      console.log('✅ Successfully joined room on backend:', response.data);
      setJoinedRoom(roomName);

      // Get media access with P2P optimized settings
      const stream = await navigator.mediaDevices.getUserMedia({
        video: P2P_CONFIG.VIDEO_CONSTRAINTS,
        audio: P2P_CONFIG.AUDIO_CONSTRAINTS
      });

      console.log('🎥 P2P Local stream obtained:', stream.getTracks().map(t => ({ 
        kind: t.kind, 
        enabled: t.enabled 
      })));

      setLocalStream(stream);
      setIsInCall(true);

      // Reset media control states
      setIsAudioMuted(false);
      setIsVideoOff(false);

      // Set local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Note: Deno signaling connection will be established by the useEffect above

    } catch (error) {
      console.error('❌ Error joining room:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert('Could not join room: ' + errorMsg);
      setJoinedRoom(null);
    }
  }

  // Stop P2P video call
  function leaveRoom() {
    console.log('🛑 Leaving P2P room:', joinedRoom);

    // Reset fullscreen when leaving room
    setMeetFullscreen(false);

    // Notify backend that user is leaving
    if (joinedRoom && user?.id) {
      axios.post(`${API}/rooms/leave`, {
        roomName: joinedRoom,
        userId: user.id
      }).then(() => {
        console.log('✅ Successfully left room on backend');
      }).catch(error => {
        console.error('❌ Error leaving room on backend:', error);
      });
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Clean up all P2P connections
    p2pConnections.forEach((manager, participantId) => {
      cleanupP2PConnection(participantId);
    });

    // Clear timeouts and retry attempts
    connectionTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    connectionTimeouts.current.clear();
    retryAttempts.current.clear();

    // Disconnect from Deno signaling
    if (denoSignaling) {
      denoSignaling.disconnect();
    }

    setIsInCall(false);
    setParticipants([]);
    setP2pConnections(new Map());
    setRemoteStreams(new Map());
    setConnectionStates(new Map());
    setP2pStats({ totalConnections: 0, connectedPeers: 0, failedConnections: 0 });
    setSignalingConnected(false);
    remoteVideoRefs.current.clear();

    // Reset media control states
    setIsAudioMuted(false);
    setIsVideoOff(false);

    setJoinedRoom(null);
  }

  // Send P2P message to all connected peers
  const sendP2PMessageToAll = (message) => {
    let sentCount = 0;
    p2pConnections.forEach((manager, participantId) => {
      if (manager.sendP2PMessage && manager.sendP2PMessage(message)) {
        sentCount++;
      }
    });
    console.log(`📤 P2P message sent to ${sentCount}/${p2pConnections.size} peers`);
    return sentCount;
  };

  if (!user?.id) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center p-12 bg-blue-300 dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
          <div className="text-6xl mb-6">🔐</div>
         <h2 className="text-white text-3xl font-bold mb-4">Authentication Required</h2>
         <p className="text-gray-300 text-lg">Please log in to access P2P video rooms</p>
       </div>
     </div>
   );
 }

 return (
   <div className="w-full h-full bg-blue-300 dark:bg-gray-900 relative overflow-hidden">
     {!joinedRoom ? (
       <div className="flex flex-col items-center justify-center h-full p-8">
         <h2 className="text-black dark:text-white text-3xl mb-4 font-bold">
           🔗 {t("MeetWithFriends.Title")}
         </h2>
         
         <div className="mb-6 text-center">
           <p className="text-gray-600 dark:text-gray-400 text-sm">
             ⚡ True Peer-to-Peer Video Calls via Deno Deploy • Maximum {MAX_P2P_PARTICIPANTS} participants per room
           </p>
           <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
             🔴 Live: {socket?.connected ? 'Connected' : 'Disconnected'} • Rooms auto-update in real-time
           </p>
         </div>

         <div className="mb-8 flex items-center">
           <input
             type="text"
             className="px-4 py-2 rounded-l border-none outline-none text-lg"
             placeholder="Enter room name"
             value={newRoomName}
             onChange={(e) => setNewRoomName(e.target.value)}
             onKeyPress={(e) => e.key === 'Enter' && createRoom()}
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
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
             {rooms.map((room) => {
               const participantCount = room.participants?.length || 0;
               const isRoomFull = participantCount >= MAX_P2P_PARTICIPANTS;
               
               return (
                 <div
                   key={room._id}
                   className={`flex flex-col justify-between border rounded-xl p-6 shadow-md hover:shadow-xl transition duration-300 ${
                     isRoomFull 
                       ? 'bg-red-100 dark:bg-red-900 border-red-500' 
                       : 'bg-blue-100 dark:bg-[#2b2b2f] border-blue-700 dark:border-yellow-400'
                   }`}
                   style={{ minHeight: '200px' }}
                 >
                   <div>
                     <h4 className={`text-xl font-semibold mb-1 ${
                       isRoomFull ? 'text-red-900 dark:text-red-300' : 'text-blue-900 dark:text-white'
                     }`}>
                       {room.name}
                     </h4>
                     <p className="text-gray-700 dark:text-gray-400 text-sm">
                       👥 {participantCount}/{MAX_P2P_PARTICIPANTS} participants
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
                       Created: {new Date(room.createdAt).toLocaleTimeString()}
                     </p>
                   </div>

                   <button
                     onClick={() => joinRoom(room.name)}
                     disabled={isRoomFull}
                     className={`mt-4 font-semibold py-2 px-4 rounded-lg text-center transition-all ${
                       isRoomFull
                         ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                         : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white'
                     }`}
                   >
                     {isRoomFull ? '🚫 Room Full' : '🔗 Join Call'}
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
       <div className="w-full h-full flex flex-col bg-gray-900">
         {/* P2P Room Header */}
         <div className="flex justify-between items-center w-full p-6 bg-gray-800 border-b border-gray-700">
           <div>
             <h2 className="text-white text-2xl font-bold">
               {joinedRoom} Room
             </h2>
             <p className="text-gray-300 text-sm mt-1">
               👥 {participants.length}/{MAX_P2P_PARTICIPANTS} participants 
               {signalingConnected && <span className="text-green-400 ml-2">🟢 Connected</span>}
               {!signalingConnected && <span className="text-red-400 ml-2">🔴 Connecting...</span>}
             </p>
             {p2pStats.totalConnections > 0 && (
               <p className="text-gray-400 text-xs mt-1">
                 P2P: {p2pStats.connectedPeers}/{p2pStats.totalConnections} connected
                 {p2pStats.failedConnections > 0 && `, ${p2pStats.failedConnections} failed`}
               </p>
             )}
           </div>
           
           <div className="flex gap-3">
             {/* Fullscreen Toggle Button */}
             <button
               onClick={toggleFullscreen}
               className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm shadow-lg transition-colors flex items-center gap-2"
               title={meetFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
             >
               {meetFullscreen ? <FaCompress /> : <FaExpand />}
               {meetFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
             </button>

             {/* Media Control Buttons */}
             <button
               onClick={toggleAudio}
               className={`px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition-colors ${
                 isAudioMuted 
                   ? 'bg-red-600 hover:bg-red-700 text-white' 
                   : 'bg-green-600 hover:bg-green-700 text-white'
               }`}
               title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}>
              {isAudioMuted ? '🔇 Unmute' : '🎤 Mute'}
            </button>

            <button
              onClick={toggleVideo}
              className={`px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition-colors ${
                isVideoOff 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? '📹 Video On' : '📹 Video Off'}
            </button>

            <button
              onClick={leaveRoom}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold text-lg shadow-lg transition-colors"
            >
              🚪 Leave Room
            </button>
          </div>
        </div>

        {/* P2P Video Grid */}
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
              {/* Media status indicators */}
              <div className="absolute top-2 left-2 flex gap-1">
                {isAudioMuted && (
                  <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                    🔇 MUTED
                  </div>
                )}
                {isVideoOff && (
                  <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                    📹 OFF
                  </div>
                )}
              </div>
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm font-semibold">
                You ({user.id.substring(0, 8)}...)
              </div>
              {/* Connection status indicator */}
              <div className="absolute top-2 right-2">
                {signalingConnected ? (
                  <div className="bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold">
                    🟢 LIVE
                  </div>
                ) : (
                  <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                    🔴 CONNECTING
                  </div>
                )}
              </div>
            </div>

            {/* P2P Remote Videos */}
            {participants.filter(pid => pid !== user.id).map((participantId) => {
              if (!remoteVideoRefs.current.has(participantId)) {
                remoteVideoRefs.current.set(participantId, React.createRef());
              }
              
              const videoRef = remoteVideoRefs.current.get(participantId);
              const stream = remoteStreams.get(participantId);
              const connectionState = connectionStates.get(participantId) || 'unknown';
              
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
                      console.log('📊 P2P Video metadata loaded for', participantId);
                    }}
                    onPlay={() => {
                      console.log('▶️ P2P Video started playing for', participantId);
                    }}
                    onError={(e) => {
                      console.error('❌ P2P Video error for', participantId, ':', e);
                    }}
                  />
                  
                  {/* Connection state overlay */}
                  {!stream && (
                    <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center">
                      <div className="text-center text-white">
                        <div className="text-4xl mb-2">
                          {connectionState === 'connecting' && '🔄'}
                          {connectionState === 'connected' && '✅'}
                          {connectionState === 'failed' && '❌'}
                          {connectionState === 'unknown' && '⏳'}
                        </div>
                        <p className="text-sm font-semibold capitalize">
                          {connectionState === 'connecting' && 'Connecting...'}
                          {connectionState === 'connected' && 'Connected'}
                          {connectionState === 'failed' && 'Connection Failed'}
                          {connectionState === 'unknown' && 'Waiting...'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm font-semibold">
                    {participantId.substring(0, 8)}...
                  </div>
                  
                  {/* Connection status indicator */}
                  <div className="absolute top-2 right-2">
                    {connectionState === 'connected' && stream && (
                      <div className="bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold">
                        🟢 P2P
                      </div>
                    )}
                    {connectionState === 'connecting' && (
                      <div className="bg-yellow-600 text-white px-2 py-1 rounded text-xs font-semibold">
                        🟡 CONNECTING
                      </div>
                    )}
                    {connectionState === 'failed' && (
                      <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                        🔴 FAILED
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty slots for potential participants */}
            {participants.length < MAX_P2P_PARTICIPANTS && (
              <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-600 border-dashed flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-2">👤</div>
                  <p className="text-sm font-semibold">
                    Waiting for participants...
                  </p>
                  <p className="text-xs mt-1">
                    {MAX_P2P_PARTICIPANTS - participants.length} slots available
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* P2P Statistics Panel (Debug Info) */}
          {process.env.NODE_ENV === 'development' && p2pStats.totalConnections > 0 && (
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg text-xs">
              <h4 className="font-semibold mb-1">P2P Statistics</h4>
              <p>Total Connections: {p2pStats.totalConnections}</p>
              <p>Connected Peers: {p2pStats.connectedPeers}</p>
              <p>Failed Connections: {p2pStats.failedConnections}</p>
              <p>Success Rate: {p2pStats.totalConnections > 0 ? Math.round((p2pStats.connectedPeers / p2pStats.totalConnections) * 100) : 0}%</p>
            </div>
          )}

          {/* Room Info Panel */}
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white p-3 rounded-lg text-xs">
            <h4 className="font-semibold mb-1">Room Info</h4>
            <p>Room: {joinedRoom}</p>
            <p>Participants: {participants.length}/{MAX_P2P_PARTICIPANTS}</p>
            <p>Your ID: {user.id.substring(0, 12)}...</p>
            <p>Signaling: {signalingConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
          </div>
        </div>
      </div>
    )}
  </div>
);
}