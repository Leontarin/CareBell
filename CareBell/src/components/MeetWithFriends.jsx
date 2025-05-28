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
  const [remoteVideoRefs, setRemoteVideoRefs] = useState({}); // userId -> React ref
  const [loading, setLoading] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [pendingSignals, setPendingSignals] = useState({}); // userId -> array of signals
  const [connectionRetries, setConnectionRetries] = useState({}); // userId -> retry count

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const socketRef = useRef();
  const videoPeersRef = useRef({}); // Keep a ref to the current peers

  // Update the ref whenever videoPeers changes
  useEffect(() => {
    videoPeersRef.current = videoPeers;
  }, [videoPeers]);

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
    socketRef.current.emit("register", user.id);    // Listen for participants update
    socketRef.current.on("room-participants", (userIds) => {
      console.log('room-participants update:', userIds);
      setParticipants(userIds);
    });    // Listen for WebRTC signals with enhanced handling
    socketRef.current.on("signal", async ({ userId: remoteUserId, signal }) => {
      console.log(`Received signal of type ${signal.type} from user ${remoteUserId}`);
      
      if (remoteUserId === user.id) {
        console.log('Ignoring signal from self');
        return;
      }
      
      // Use ref to get current peers to avoid stale closure
      const currentPeers = videoPeersRef.current;
      
      // Check if we have an active peer for this user
      if (currentPeers[remoteUserId] && currentPeers[remoteUserId].handleSignal) {
        console.log(`Processing signal of type ${signal.type} for existing peer ${remoteUserId}`);
        try {
          // Add a small delay to prevent signal flooding
          await new Promise(resolve => setTimeout(resolve, 10));
          const success = await currentPeers[remoteUserId].handleSignal({ signal });
          if (!success) {
            console.warn(`Failed to handle signal for user ${remoteUserId}, queuing for retry`);
            // Queue the signal instead of immediately recreating peer
            setPendingSignals(prev => ({
              ...prev,
              [remoteUserId]: [...(prev[remoteUserId] || []), signal]
            }));
          }
        } catch (error) {
          console.error(`Error handling signal for user ${remoteUserId}:`, error);
          // Queue the signal for retry
          setPendingSignals(prev => ({
            ...prev,
            [remoteUserId]: [...(prev[remoteUserId] || []), signal]
          }));
        }
      } else {
        // Queue the signal for later processing
        console.log(`Queueing signal of type ${signal.type} for user ${remoteUserId} - no peer yet`);
        setPendingSignals(prev => ({
          ...prev,
          [remoteUserId]: [...(prev[remoteUserId] || []), signal]
        }));
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
    console.log(`Attempting to join room ${roomId} as user ${user.id}`);
    
    // Get local media
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      console.log('Local media stream acquired successfully');
    } catch (err) {
      console.error('Failed to get local media:', err);
      alert("Could not access camera/mic: " + err.message);
      return;
    }
    
    socketRef.current.emit("join-room", { roomId, userId: user.id });
    setJoinedRoom(roomId);
    console.log(`Emitted join-room event for room ${roomId}`);
  };
  // Leave a room
  const leaveRoom = () => {
    if (!joinedRoom || !user?.id) return;
    console.log(`Leaving room ${joinedRoom} as user ${user.id}`);
    
    socketRef.current.emit("leave-room", { roomId: joinedRoom, userId: user.id });
    setJoinedRoom(null);
    setParticipants([]);
    cleanupAllPeers();
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    console.log('Left room and cleaned up resources');
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
  };  // WebRTC peer management
  useEffect(() => {
    if (!joinedRoom || !localStreamRef.current) return;
    
    console.log('Managing peers for participants:', participants);
    
    // SEQUENTIAL peer creation to prevent race conditions
    const createPeersSequentially = async () => {
      for (const remoteUserId of participants) {
        if (remoteUserId === user.id) continue;
        if (!videoPeers[remoteUserId]) {
          try {
            let remoteVideoRef = remoteVideoRefs[remoteUserId];
            if (!remoteVideoRef) {
              remoteVideoRef = React.createRef();
              setRemoteVideoRefs(prev => ({ ...prev, [remoteUserId]: remoteVideoRef }));
            }
            const polite = user.id > remoteUserId; // true if my id is higher
            const manager = new WebRTCManager(
              localVideoRef,
              remoteVideoRef,
              socketRef.current,
              joinedRoom,
              user.id,
              polite // pass polite flag per peer
            );
            manager.onConnectionFailed = () => {
              setConnectionRetries(prev => ({
                ...prev,
                [remoteUserId]: (prev[remoteUserId] || 0) + 1
              }));
              // Clean up all state for this peer
              setVideoPeers(prev => {
                const copy = { ...prev };
                delete copy[remoteUserId];
                return copy;
              });
              setRemoteVideoRefs(prev => {
                const copy = { ...prev };
                delete copy[remoteUserId];
                return copy;
              });
              setPendingSignals(prev => {
                const copy = { ...prev };
                delete copy[remoteUserId];
                return copy;
              });
              videoPeersRef.current = { ...videoPeersRef.current };
              delete videoPeersRef.current[remoteUserId];
            };
            videoPeersRef.current = { ...videoPeersRef.current, [remoteUserId]: manager };
            setVideoPeers(prev => ({ ...prev, [remoteUserId]: manager }));
            // Add a small random delay to further reduce race conditions
            const userIndex = participants.indexOf(remoteUserId);
            const delay = userIndex * 200 + Math.floor(Math.random() * 100);
            await new Promise(resolve => setTimeout(resolve, delay));
            const shouldCreateOffer = user.id.localeCompare(remoteUserId) < 0;
            await manager.initialize(localStreamRef.current, shouldCreateOffer);
            // Process any pending signals for this user SEQUENTIALLY
            if (pendingSignals[remoteUserId] && pendingSignals[remoteUserId].length > 0) {
              for (const signal of pendingSignals[remoteUserId]) {
                try {
                  await manager.handleSignal({ signal });
                  await new Promise(resolve => setTimeout(resolve, 50));
                } catch (error) {
                  console.error(`Error processing pending ${signal.type} signal for user ${remoteUserId}:`, error);
                }
              }
              setPendingSignals(prev => {
                const copy = { ...prev };
                delete copy[remoteUserId];
                return copy;
              });
            }
          } catch (error) {
            setVideoPeers(prev => {
              const copy = { ...prev };
              delete copy[remoteUserId];
              return copy;
            });
            setRemoteVideoRefs(prev => {
              const copy = { ...prev };
              delete copy[remoteUserId];
              return copy;
            });
            setPendingSignals(prev => {
              const copy = { ...prev };
              delete copy[remoteUserId];
              return copy;
            });
            videoPeersRef.current = { ...videoPeersRef.current };
            delete videoPeersRef.current[remoteUserId];
          }
        }
      }
    };

    // Call the async function
    createPeersSequentially();
      
    // Remove peers and refs for users who left
    Object.keys(videoPeers).forEach(peerId => {
      if (!participants.includes(peerId)) {
        console.log(`Removing peer for user ${peerId} who left the room`);
        if (videoPeers[peerId] && videoPeers[peerId].destroy) {
          videoPeers[peerId].destroy();
        }
        
        // Clean up state
        setVideoPeers(prev => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
        
        // Clean up refs
        setRemoteVideoRefs(prev => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
          // Clean up pending signals
        setPendingSignals(prev => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
        
        // Clean up connection retries
        setConnectionRetries(prev => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
        
        // Clean up videoPeersRef
        videoPeersRef.current = { ...videoPeersRef.current };
        delete videoPeersRef.current[peerId];
      }
    });
    // eslint-disable-next-line
  }, [participants, joinedRoom, localStreamRef.current]);

  // Ensure local video is always set when joining a room or stream changes
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [joinedRoom, localStreamRef.current]);  const cleanupAllPeers = () => {
    console.log('Cleaning up all peers');
    Object.values(videoPeersRef.current).forEach(manager => {
      if (manager && manager.destroy) {
        manager.destroy();
      }
    });
    setVideoPeers({});
    setRemoteVideoRefs({});
    setPendingSignals({});
    setConnectionRetries({});
    videoPeersRef.current = {};
  };

  // Manual peer recreation for debugging
  const recreatePeer = (userId) => {
    console.log(`Manually recreating peer for user ${userId}`);
    
    // Clean up existing peer
    if (videoPeers[userId]) {
      videoPeers[userId].destroy();
    }
    
    // Remove from state to trigger recreation
    setVideoPeers(prev => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
    
    // Reset retry count
    setConnectionRetries(prev => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
    
    // Update ref
    videoPeersRef.current = { ...videoPeersRef.current };
    delete videoPeersRef.current[userId];
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
      ) : (        <div className="w-full h-full flex flex-col items-center">
          <div className="flex justify-between w-full p-4">
            <span className="text-white text-lg">Room: {rooms.find(r => r._id === joinedRoom)?.name}</span>
            <button onClick={leaveRoom} className="px-4 py-2 bg-red-600 text-white rounded">Leave Room</button>
          </div>
            {/* Debug panel for multi-user monitoring */}
          <div className="absolute top-4 right-4 bg-gray-800 text-white p-2 rounded text-sm opacity-80 max-w-md">
            <div>Room ID: {joinedRoom}</div>
            <div>Total Participants: {participants.length}</div>
            <div>Active Peers: {Object.keys(videoPeers).length}</div>
            <div>Pending Signals: {Object.keys(pendingSignals).reduce((acc, key) => acc + pendingSignals[key].length, 0)}</div>
            <div>Remote Video Refs: {Object.keys(remoteVideoRefs).length}</div>
              {/* Connection Status per user */}
            <div className="mt-2 border-t border-gray-600 pt-2">
              <div className="font-bold">Connection Status:</div>
              {participants.filter(pid => pid !== user.id).map(pid => {
                const peer = videoPeers[pid];
                const retries = connectionRetries[pid] || 0;
                let status = '🔄 Connecting...';
                let details = '';
                
                if (peer) {
                  const state = peer.getConnectionState && peer.getConnectionState();
                  if (state && state !== 'no-peer') {
                    const { connectionState, iceConnectionState, attempts } = state;
                    if (connectionState === 'connected' && iceConnectionState === 'connected') {
                      status = '✅ Connected';
                      details = `(${attempts} attempts)`;
                    } else if (connectionState === 'failed' || iceConnectionState === 'failed') {
                      status = '❌ Failed';
                      details = `(${retries} retries, ${attempts} attempts)`;
                    } else {
                      status = '🔄 Connecting...';
                      details = `(${connectionState}/${iceConnectionState}, ${attempts} attempts)`;
                    }
                  } else {
                    status = '✅ Peer Created';
                  }
                } else if (retries > 0) {
                  status = retries >= 3 ? '💀 Max Retries' : '🔄 Retrying...';
                  details = `(${retries}/3 retries)`;
                }
                  return (
                  <div key={pid} className="text-xs flex justify-between items-center">
                    <span>{pid.slice(-6)}: {status} {details}</span>
                    {(!peer || retries > 0) && retries < 3 && (
                      <button 
                        onClick={() => recreatePeer(pid)}
                        className="ml-2 px-1 py-0 bg-yellow-600 text-white rounded text-xs"
                        title="Retry connection"
                      >
                        🔄
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
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
            </div>            {/* Remote videos - Improved for multiple users */}
            {participants.filter(pid => pid !== user.id).map(pid => {
              return (
                <div className="m-2" key={pid}>
                  <video
                    ref={remoteVideoRefs[pid]}
                    playsInline
                    autoPlay
                    className="w-64 h-48 bg-black border-4 border-blue-400 rounded-lg"
                  />
                  <div className="text-center text-white mt-2">
                    User: {pid}
                    {videoPeers[pid] ? ' (Connected)' : ' (Connecting...)'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MeetWithFriends;