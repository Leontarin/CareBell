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

  const [participantNames, setParticipantNames] = useState(new Map());

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
  const remoteVideoRefs = useRef(new Map());
  const connectionTimeouts = useRef(new Map());
  const retryAttempts = useRef(new Map()); 

  // cleanup when user closes browser tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (joinedRoom && user?.id) {
        // Create proper FormData for sendBeacon
        const formData = new FormData();
        formData.append('roomName', joinedRoom);
        formData.append('userId', user.id);
        
        navigator.sendBeacon(`${API}/rooms/leave`, formData);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && joinedRoom) {
        // Optionally pause video when tab is hidden
        if (localStream) {
          localStream.getVideoTracks().forEach(track => {
            track.enabled = false;
          });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [joinedRoom, user?.id, localStream]);

  // Socket.IO connection for real-time room updates
  useEffect(() => {
    if (!user?.id) return;

    const newSocket = io(P2P_SIGNALING_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to room management socket');
      // Register user for real-time updates
      newSocket.emit('register', user.id);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from room management socket');
    });

    // REAL-TIME ROOM UPDATES
    newSocket.on('room-created', (room) => {
      console.log('🆕 Real-time: Room created', room.name);
      setRooms(prev => {
        // Avoid duplicates
        const exists = prev.find(r => r.name === room.name);
        if (exists) return prev;
        return [...prev, room];
      });
    });

    newSocket.on('room-updated', (room) => {
  console.log('🔄 Real-time: Room updated', room.name, 'participants:', room.participants?.length || 0);
  
  // Update participant names if available
  if (room.participantDetails) {
    const nameMap = new Map();
    room.participantDetails.forEach(p => {
      nameMap.set(p.userId, p.fullName);
    });
    setParticipantNames(prev => new Map([...prev, ...nameMap]));
  }
  
  setRooms(prev => prev.map(r => r.name === room.name ? room : r));
  
  // If we're in this room, update our participants
  if (joinedRoom === room.name) {
    const currentParticipants = participants;
    const newParticipants = room.participants || [];
    
    // Find who left
    const leftParticipants = currentParticipants.filter(p => !newParticipants.includes(p));
    
    // Clean up connections for participants who left
    leftParticipants.forEach(participantId => {
      if (participantId !== user.id) {
        cleanupP2PConnection(participantId);
      }
    });
  }
});

    newSocket.on('room-deleted', (data) => {
      console.log('🗑️ Real-time: Room deleted', data.name);
      setRooms(prev => prev.filter(r => r.name !== data.name));
      
      // If user was in the deleted room, handle cleanup
      if (joinedRoom === data.name) {
        leaveRoom();
      }
    });

    // REAL-TIME PARTICIPANT COUNT UPDATES
    newSocket.on('room-participant-count', ({ roomName, count }) => {
      console.log(`📊 Real-time: Participant count for ${roomName}: ${count}`);
      setRooms(prev => prev.map(room => 
        room.name === roomName 
          ? { ...room, participants: new Array(count).fill('participant') } // Just for count display
          : room
      ));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id, joinedRoom, participants]);

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
    }
  };

  const toggleVideo = () => {
    if (!localStream) return;

    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      const newVideoOffState = !isVideoOff;
      videoTracks[0].enabled = !newVideoOffState;
      setIsVideoOff(newVideoOffState);
    }
  };

  // Initialize Deno P2P signaling (replaces Socket.IO)
  useEffect(() => {
    if (!joinedRoom || !user?.id) return;

    const signaling = new DenoP2PSignaling(joinedRoom, user.id);
    
    // Set up signaling event handlers
    signaling.onConnected = () => {
      setSignalingConnected(true);
    };

    signaling.onDisconnected = () => {
      setSignalingConnected(false);
    };

    signaling.onError = (error) => {
      setSignalingConnected(false);
    };

    // Handle participants updates from Deno server
    signaling.onParticipantsUpdate = (participantList, newUser, leftUser) => {
      // Enforce P2P mesh limit
      if (participantList.length > MAX_P2P_PARTICIPANTS) {
        alert(`Room limited to ${MAX_P2P_PARTICIPANTS} participants for optimal P2P performance.`);
        participantList = participantList.slice(0, MAX_P2P_PARTICIPANTS);
      }
      
      setParticipants(participantList);

      // NEW: Handle when someone leaves
      if (leftUser && leftUser !== user.id) {
        console.log('🚪 Participant left:', leftUser);
        cleanupP2PConnection(leftUser);
      }
    };

    // Handle P2P WebRTC signals from Deno server
    signaling.onP2PSignal = (fromUserId, signal) => {
      setP2pConnections(currentConnections => {
        const manager = currentConnections.get(fromUserId);
        if (manager) {
          manager.handleSignal({ signal }).catch(err => {
            updateConnectionState(fromUserId, 'failed');
          });
        } 
        return currentConnections;
      });
    };

    // Connect to Deno signaling server
    signaling.connect();
    setDenoSignaling(signaling);

    // Cleanup on unmount
    return () => {
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

  const fetchParticipantNames = async (userIds) => {
  const nameMap = new Map();
  
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const response = await axios.get(`${API}/users/${userId}`);
        nameMap.set(userId, response.data.fullName || `User ${userId.slice(-4)}`);
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        nameMap.set(userId, `User ${userId.slice(-4)}`);
      }
    })
  );
  
  setParticipantNames(prev => new Map([...prev, ...nameMap]));
  return nameMap;
};

  // FETCH ROOMS INITIALLY AND SET UP PERIODIC REFRESH
  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await axios.get(`${API}/rooms`);
        console.log('📋 Fetched rooms:', res.data.length);
        setRooms(res.data);
      } catch (e) {
        console.error("❌ Error fetching rooms:", e);
      }
    }
    
    // Initial fetch
    fetchRooms();
    
    // Periodic refresh every 30 seconds as backup
    const interval = setInterval(fetchRooms, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Handle P2P mesh connections when participants change
  useEffect(() => {
    if (!isInCall || !localStream || !joinedRoom || !user?.id || !denoSignaling || !signalingConnected) {
      return;
    }

    // Create P2P connections for new participants (full mesh)
    participants.forEach(async (participantId) => {
      if (participantId === user.id) return; // Skip self

      if (!p2pConnections.has(participantId)) {
        await createP2PConnection(participantId);
      }
    });

    // Clean up connections for participants who left
    const currentConnectionKeys = Array.from(p2pConnections.keys());
    currentConnectionKeys.forEach((participantId) => {
      if (!participants.includes(participantId)) {
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
        // Increment retry count
        const newAttempts = (retryAttempts.current.get(participantId) || 0) + 1;
        retryAttempts.current.set(participantId, newAttempts);
        
        // Clean up the failed connection
        cleanupP2PConnection(participantId);
        
        // Retry after a delay if under max attempts
        if (newAttempts < P2P_CONFIG.MAX_RETRY_ATTEMPTS) {
          const timeoutId = setTimeout(() => {
            createP2PConnection(participantId);
          }, P2P_CONFIG.RETRY_DELAY_BASE * newAttempts); // Exponential backoff
          
          connectionTimeouts.current.set(participantId, timeoutId);
        } else {
          updateConnectionState(participantId, 'failed');
        }
      };

      // Handle successful connection
      manager.onConnectionEstablished = (targetUserId) => {
        updateConnectionState(targetUserId, 'connected');
        retryAttempts.current.delete(targetUserId); // Reset retry count
      };

      // Handle remote stream
      manager.onRemoteStream = (stream) => {
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
      await manager.initialize(localStream, isInitiator);

    } catch (error) {
      updateConnectionState(participantId, 'failed');
    }
  };

  const cleanupP2PConnection = (participantId) => {
    console.log('🧹 Cleaning up P2P connection for:', participantId);
    
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
      const stream = prev.get(participantId);
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('🎥 Stopped remote track for', participantId, ':', track.kind);
        });
      }
      
      const newMap = new Map(prev);
      newMap.delete(participantId);
      return newMap;
    });

    // Cleanup video ref
    const videoRef = remoteVideoRefs.current.get(participantId);
    if (videoRef?.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
    remoteVideoRefs.current.delete(participantId);
    
    // Cleanup connection state
    setConnectionStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(participantId);
      return newMap;
    });

    // Clear retry attempts
    retryAttempts.current.delete(participantId);
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
      const { data } = await axios.post(`${API}/rooms/create`, {
        name: newRoomName,
        userId: user.id,
      });
      
      console.log('✅ Room created:', data.name);
      setNewRoomName("");
      
      // FORCE REFRESH ROOMS AFTER CREATING
      const res = await axios.get(`${API}/rooms`);
      setRooms(res.data);
      
      // Automatically join the created room
      await joinRoom(data.name);
      
    } catch (e) {
      const errorMsg = e.response?.data?.error || e.message;
      alert("Failed to create room: " + errorMsg);
    }
  }

  // Join room with P2P mesh
  async function joinRoom(roomName) {
  if (!user?.id) {
    return;
  }

  try {
    // Notify backend that user is joining
    const response = await axios.post(`${API}/rooms/join`, {
      roomName: roomName,
      userId: user.id
    });

    setJoinedRoom(roomName);

    // Fetch participant names for the room
    if (response.data.participants) {
      await fetchParticipantNames(response.data.participants);
    }

    // Get media access with P2P optimized settings
    const stream = await navigator.mediaDevices.getUserMedia({
      video: P2P_CONFIG.VIDEO_CONSTRAINTS,
      audio: P2P_CONFIG.AUDIO_CONSTRAINTS
    });

    setLocalStream(stream);
    setIsInCall(true);

    // Reset media control states
    setIsAudioMuted(false);
    setIsVideoOff(false);

    // Set local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    alert('Could not join room: ' + errorMsg);
    setJoinedRoom(null);
  }
}

  // Stop P2P video call
  function leaveRoom() {
    console.log('🚪 Leaving room:', joinedRoom);

    // Reset fullscreen when leaving room
    setMeetFullscreen(false);

    // Notify backend that user is leaving
    if (joinedRoom && user?.id) {
      axios.post(`${API}/rooms/leave`, {
        roomName: joinedRoom,
        userId: user.id
      }).then(() => {
        console.log('✅ Successfully left room on backend');
        
        // FORCE REFRESH ROOMS AFTER LEAVING
        axios.get(`${API}/rooms`).then(res => {
          setRooms(res.data);
        }).catch(err => console.error('Failed to refresh rooms:', err));
        
      }).catch(error => {
        console.error('❌ Error leaving room on backend:', error);
      });
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🎥 Stopped track:', track.kind);
      });
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
      setDenoSignaling(null);
    }

    // NEW: Clear all video refs
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    remoteVideoRefs.current.forEach((ref, participantId) => {
      if (ref.current) {
        ref.current.srcObject = null;
      }
    });

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
           {t("MeetWithFriends.Title")}5
         </h2>
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
            : room.isTemporary === false
            ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-500'
            : 'bg-blue-100 dark:bg-[#2b2b2f] border-blue-700 dark:border-yellow-400'
        }`}
        style={{ minHeight: '250px' }} // Increased height for participant names
      >
        <div>
          <h4 className={`text-xl font-semibold mb-1 flex items-center gap-2 ${
            isRoomFull ? 'text-red-900 dark:text-red-300' 
            : room.isTemporary === false ? 'text-yellow-900 dark:text-yellow-300'
            : 'text-blue-900 dark:text-white'
          }`}>
            {room.isTemporary === false && <span title="Default Room">⭐</span>}
            {room.name}
          </h4>
          
          <p className="text-gray-700 dark:text-gray-400 text-sm mb-2">
            👥 {participantCount}/{MAX_P2P_PARTICIPANTS} participants
          </p>
          
          {/* Show participant names */}
          {room.participantDetails && room.participantDetails.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-600 dark:text-gray-500 mb-1">Participants:</p>
              <div className="flex flex-wrap gap-1">
                {room.participantDetails.slice(0, 3).map((participant) => (
                  <span 
                    key={participant.userId}
                    className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs"
                  >
                    {participant.fullName}
                  </span>
                ))}
                {room.participantDetails.length > 3 && (
                  <span className="text-gray-500 text-xs">
                    +{room.participantDetails.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
          
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
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs font-semibold">
            You
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
  const participantName = participantNames.get(participantId) || `User ${participantId.slice(-4)}`;
  
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
      
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs font-semibold">
        {participantName}
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
