// src/MeetWithFriends.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API } from "../config";
import { AppContext } from "../AppContext";
import { WebRTCManager } from "./WebRTCManager";
import { useTranslation } from "react-i18next";

export default function MeetWithFriends() {
  const { user } = useContext(AppContext);
  /* ---- Translation ---- */
      const { t } = useTranslation();

  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [roomParticipants, setRoomParticipants] = useState(new Map()); // roomName -> participant count

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
    const socket = io(API, {
      withCredentials: false, // Match backend credentials: false
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    if (user?.id) {
      socket.emit('register', user.id);
    }

    // Listen for room participants updates
    socket.on('room-participants', (participantList) => {
      console.log('Room participants updated:', participantList, 'for user', user?.id);
      // Always include self in participants for robust connection logic
      if (user?.id && !participantList.includes(user.id)) {
        participantList.push(user.id);
      }
      setParticipants(participantList);
    });

    // Listen for WebRTC signals
    socket.on('signal', async ({ userId, signal }) => {
      console.log('Received signal from', userId, ':', signal.type);

      // Get the current webRTCManagers state
      setWebRTCManagers(currentManagers => {
        const manager = currentManagers.get(userId);
        if (manager) {
          manager.handleSignal({ signal }).catch(err => {
            console.error('Error handling signal:', err);
          });
        } else {
          console.warn('No WebRTC manager found for user:', userId);
        }
        return currentManagers;
      });
    });

    // Listen for room participant counts (for room list) - GLOBAL updates
    socket.on('room-participant-count', ({ roomName, count }) => {
      console.log('Received participant count for room', roomName, ':', count);
      setRoomParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(roomName, count);
        return newMap;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  // Request participant counts periodically to keep them updated
  useEffect(() => {
    if (!socketRef.current) return;

    const requestCounts = () => {
      rooms.forEach(room => {
        socketRef.current.emit('get-room-participant-count', room.name);
      });
    };

    // Initial request
    requestCounts();

    // Request every 5 seconds to keep counts updated
    const interval = setInterval(requestCounts, 5000);

    return () => clearInterval(interval);
  }, [rooms]);

  // 1) Fetch the list of rooms on mount and get participant counts
  useEffect(() => {
    async function fetchRooms() {
      try {        const res = await axios.get(`${API}/rooms`);
        setRooms(res.data);
        // Request participant counts for all rooms (use room.name for consistency)
        if (socketRef.current) {
          res.data.forEach(room => {
            socketRef.current.emit('get-room-participant-count', room.name);
          });
        }
      } catch (e) {
        console.error("Error fetching rooms:", e);
      }
    }
    fetchRooms();
  }, []);
  // Request participant counts when socket is ready
  useEffect(() => {
    if (socketRef.current && rooms.length > 0) {
      rooms.forEach(room => {
        socketRef.current.emit('get-room-participant-count', room.name);
      });
    }
  }, [rooms]);
    // Handle participants joining/leaving and create WebRTC connections
  useEffect(() => {
    if (!isInCall || !localStream || !joinedRoom || !user?.id) return;

    console.log('Current participants for', user.id, ':', participants);
    console.log('Current webRTC managers for', user.id, ':', Array.from(webRTCManagers.keys()));

    // Create connections for new participants
    participants.forEach(async (participantId) => {
      if (participantId === user.id) return; // Skip self

      if (!webRTCManagers.has(participantId)) {
        console.log('Creating WebRTC connection for participant:', participantId, 'from user', user.id);        // Create new video element ref for this participant
        const remoteVideoRef = React.createRef();
        remoteVideoRefs.current.set(participantId, remoteVideoRef);

        const manager = new WebRTCManager(
          localVideoRef,
          remoteVideoRef,
          socketRef.current,
          joinedRoom,
          user.id,
          user.id.localeCompare(participantId) > 0 // Use robust polite/impolite assignment
        );        manager.onConnectionFailed = () => {
          console.log('Connection failed with', participantId, 'attempting retry');
          
          // Clean up the failed connection
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
          
          // Retry connection after a short delay
          setTimeout(async () => {
            console.log('Retrying connection with', participantId);
            
            // Create new video element ref for this participant
            const newRemoteVideoRef = React.createRef();
            remoteVideoRefs.current.set(participantId, newRemoteVideoRef);
            
            const newManager = new WebRTCManager(
              localVideoRef,
              newRemoteVideoRef,
              socketRef.current,
              joinedRoom,
              user.id,
              user.id.localeCompare(participantId) > 0
            );
            
            // Set up callbacks again
            newManager.onConnectionFailed = manager.onConnectionFailed;
            newManager.onRemoteStream = manager.onRemoteStream;
            
            // Update managers state
            setWebRTCManagers(prev => {
              const newMap = new Map(prev);
              newMap.set(participantId, newManager);
              return newMap;
            });
            
            // Initialize the new connection
            const isInitiator = user.id.localeCompare(participantId) < 0;
            try {
              await newManager.initialize(localStream, isInitiator);
            } catch (error) {
              console.error('Failed to initialize retry connection:', error);
            }
          }, 2000);
        };// Handle remote stream - CRITICAL FIX
        manager.onRemoteStream = (stream) => {
          console.log('Received remote stream from', participantId);
          console.log('Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));

          // Update remoteStreams state immediately
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            newMap.set(participantId, stream);
            console.log('Updated remoteStreams state for', participantId);
            return newMap;
          });

          // Force immediate video element update
          setTimeout(() => {
            const videoRef = remoteVideoRefs.current.get(participantId);
            if (videoRef && videoRef.current) {
              console.log('Setting srcObject for video element of participant:', participantId);
              videoRef.current.srcObject = stream;
              videoRef.current.volume = 1.0;
              videoRef.current.muted = false;
                // Add event listeners to debug video playback
              videoRef.current.onloadedmetadata = () => {
                if (videoRef.current && videoRef.current.videoWidth !== undefined && videoRef.current.videoHeight !== undefined) {
                  console.log('Video metadata loaded for', participantId, 'dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                } else {
                  console.log('Video metadata loaded for', participantId, 'but dimensions not available yet');
                }
              };
              
              videoRef.current.onplay = () => {
                console.log('Video started playing for', participantId);
              };
              
              videoRef.current.onerror = (e) => {
                console.error('Video error for', participantId, ':', e);
              };
              
              videoRef.current.play().then(() => {
                console.log('Video play() succeeded for', participantId);
              }).catch(e => {
                console.log('Autoplay prevented for', participantId, ':', e);
              });
            } else {
              console.warn('Video ref not found for participant:', participantId);
            }
          }, 100);
        };

        // Update managers state
        setWebRTCManagers(prev => {
          const newMap = new Map(prev);
          newMap.set(participantId, manager);
          return newMap;
        });        // Initialize the connection - FIXED: proper initiator logic
        const isInitiator = user.id.localeCompare(participantId) < 0;
        console.log('Initializing connection with', participantId, 'as initiator:', isInitiator);

        try {
          await manager.initialize(localStream, isInitiator);
        } catch (error) {
          console.error('Failed to initialize WebRTC connection:', error);
        }
      }
    });

    // Clean up connections for participants who left
    const currentManagerKeys = Array.from(webRTCManagers.keys());
    currentManagerKeys.forEach((participantId) => {
      if (!participants.includes(participantId)) {
        console.log('Cleaning up connection for participant who left:', participantId);
        const manager = webRTCManagers.get(participantId);
        if (manager) {
          if (typeof manager.destroy === 'function') manager.destroy();
          else if (typeof manager.cleanup === 'function') manager.cleanup();
        }

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
  }, [participants, isInCall, localStream, joinedRoom, user?.id]);

  // Effect to bind remote streams to video elements when streams change
  useEffect(() => {
    console.log('Remote streams changed, updating video elements');
    
    remoteStreams.forEach((stream, participantId) => {
      const videoRef = remoteVideoRefs.current.get(participantId);
      if (videoRef && videoRef.current) {
        console.log('Binding stream to video element for participant:', participantId);
        console.log('Stream details:', {
          id: stream.id,
          tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
        });
        
        // Only set if not already set or different stream
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.volume = 1.0;
          videoRef.current.muted = false;
          
          videoRef.current.play().then(() => {
            console.log('Video playback started successfully for', participantId);
          }).catch(e => {
            console.log('Autoplay prevented for', participantId, ':', e);
            // Try to enable playback with user interaction
            videoRef.current.controls = true;
          });
        }
      } else {
        console.warn('Video ref not available for participant:', participantId);
      }
    });
  }, [remoteStreams]);

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

      // Automatically join the created room
      await joinRoom(data.name);
    } catch (e) {
      alert("Failed to create room: " + e.message);
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

  // 3) Join an existing room by name and automatically start video call
  async function joinRoom(roomName) {
    if (!user?.id) return;
    setJoinedRoom(roomName);

    // Automatically start video call when joining room
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      console.log('Local stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));

      setLocalStream(stream);
      setIsInCall(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Join the room via socket (with small delay to ensure socket is ready)
      console.log('Joining room via socket:', roomName, 'with user ID:', user.id);
      setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.emit('join-room', {
            roomId: roomName,
            userId: user.id
          });
        }
      }, 100);

    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions and try again.');
      setJoinedRoom(null); // Go back to room list if media access fails
    }
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
          <h2 className="text-white text-3xl mb-8 font-bold"> {t("MeetWithFriends.Title")}</h2>

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
            <h3 className="text-white text-xl mb-4">{t("MeetWithFriends.availableRooms")}</h3>
            <ul className="space-y-3">              {rooms.map((r) => {
                // Use room.name for participant count lookup (consistent with backend)
                const participantCount = roomParticipants.get(r.name) || 0;
                return (
                  <li
                    key={r._id}
                    className="flex justify-between items-center bg-gray-800 p-4 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="text-white text-lg font-medium">{r.name}</span>
                      <span className="text-gray-400 text-sm">
                        👥 {participantCount} {t("MeetWithFriends.participant")}{participantCount !== 1 ? t("MeetWithFriends.s") : ''} {t("MeetWithFriends.online")}
                      </span>
                    </div>
                    <button
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold transition-colors"
                      onClick={() => joinRoom(r.name)}
                    >
                      🎥 {t("MeetWithFriends.joinCall")}
                    </button>
                  </li>
                );
              })}
            </ul>
            {rooms.length === 0 && (
              <p className="text-gray-400 text-center py-8">{t("MeetWithFriends.noRooms")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col bg-gray-900">
          {/* Room Header */}
          <div className="flex justify-between items-center w-full p-6 bg-gray-800 border-b border-gray-700">            <div>
              <h2 className="text-white text-2xl font-bold">🎥 {t("MeetWithFriends.room")} {joinedRoom}</h2>
              <p className="text-gray-300 text-sm mt-1">
                👥 {participants.length} {t("MeetWithFriends.participant")}{participants.length !== 1 ? t("MeetWithFriends.s") : ''} in call
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

          {/* Video Call Interface */}
          <div className="flex-1 bg-black p-6 overflow-hidden">
            {/* Video Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full min-h-0">
              {/* Local Video */}              <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-green-500">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              
              </div>{/* Remote Videos */}
              {participants.filter(pid => pid !== user.id).map((participantId) => {
                const stream = remoteStreams.get(participantId);
                
                // Ensure we have a ref for this participant
                if (!remoteVideoRefs.current.has(participantId)) {
                  remoteVideoRefs.current.set(participantId, React.createRef());
                }
                
                const videoRef = remoteVideoRefs.current.get(participantId);
                
                return (
                  <div key={participantId} className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-blue-500">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      controls={false}
                      volume={1.0}
                      muted={false}
                      className="w-full h-full object-cover"                      onLoadedMetadata={(e) => {
                        if (e.target && e.target.videoWidth !== undefined && e.target.videoHeight !== undefined) {
                          console.log('Video metadata loaded for', participantId, 'dimensions:', e.target.videoWidth, 'x', e.target.videoHeight);
                        } else {
                          console.log('Video metadata loaded for', participantId, 'but dimensions not available yet');
                        }
                      }}
                      onPlay={() => {
                        console.log('Video started playing for', participantId);
                      }}
                      onError={(e) => {
                        console.error('Video error for', participantId, ':', e);
                      }}                    />
                   
                    {/* Debug info */}
                    <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                      {stream ? `✅ Stream (${stream.getTracks().length} tracks)` : '❌ No stream'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Call Controls & Info */}            <div className="mt-6 text-center">
              <div className="bg-gray-800 rounded-lg p-4 inline-block">
                <p className="text-white text-lg font-semibold">
                  👥 {t("MeetWithFriends.activeParticipants")} {participants.length}
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  {t("MeetWithFriends.videoCallInProgress")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
