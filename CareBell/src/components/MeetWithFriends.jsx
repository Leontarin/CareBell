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
          const success = await currentPeers[remoteUserId].handleSignal({ signal });
          if (!success) {
            console.warn(`Failed to handle signal for user ${remoteUserId}, will recreate peer connection`);
            // Force creating a new peer on next participants update
            setVideoPeers(prev => {
              const copy = { ...prev };
              delete copy[remoteUserId];
              return copy;
            });
            
            // Queue the signal
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
        // Do NOT manually add to participants here. Only trust backend updates.
        // If the peer is never created, check backend emits correct participant list.
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
    
    // For each participant (except self), create a peer if not exists
    participants.forEach(async (remoteUserId) => {
      if (remoteUserId === user.id) return;
      
      console.log(`Checking peer for user ${remoteUserId}`);
      
      if (!videoPeers[remoteUserId]) {
        console.log(`Creating new peer for user ${remoteUserId}`);
        
        let remoteVideoRef = remoteVideoRefs[remoteUserId];
        if (!remoteVideoRef) {
          remoteVideoRef = React.createRef();
          setRemoteVideoRefs(prev => ({ ...prev, [remoteUserId]: remoteVideoRef }));
        }        const manager = new WebRTCManager(
          localVideoRef,
          remoteVideoRef,
          socketRef.current,
          joinedRoom,
          user.id // pass userId to manager
        );
        
        // CRITICAL: Update ref IMMEDIATELY to avoid race condition with incoming signals
        videoPeersRef.current = { ...videoPeersRef.current, [remoteUserId]: manager };
        
        // Then update state (this will trigger re-render but ref is already updated)
        setVideoPeers(prev => ({ ...prev, [remoteUserId]: manager }));
        
        try {
          // Initialize the peer connection
          await manager.initialize(localStreamRef.current, user.id < remoteUserId);
          console.log(`Peer initialized successfully for user ${remoteUserId}`);
          
          // Process any pending signals for this user
          if (pendingSignals[remoteUserId] && pendingSignals[remoteUserId].length > 0) {
            console.log(`Processing ${pendingSignals[remoteUserId].length} pending signals for user ${remoteUserId}`);
            for (const signal of pendingSignals[remoteUserId]) {
              try {
                await manager.handleSignal({ signal });
              } catch (error) {
                console.error(`Error processing pending signal:`, error);
              }
            }
            setPendingSignals(prev => {
              const copy = { ...prev };
              delete copy[remoteUserId];
              return copy;
            });
          }
        } catch (error) {
          console.error(`Failed to initialize peer for user ${remoteUserId}:`, error);
          // Remove the failed peer
          setVideoPeers(prev => {
            const copy = { ...prev };
            delete copy[remoteUserId];
            return copy;
          });
        }
      }
    });
    
    // Remove peers and refs for users who left
    Object.keys(videoPeers).forEach(peerId => {
      if (!participants.includes(peerId)) {
        console.log(`Removing peer for user ${peerId}`);
        videoPeers[peerId].destroy();
        setVideoPeers(prev => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
        setRemoteVideoRefs(prev => {
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
    console.log('Cleaning up all peers');
    Object.values(videoPeersRef.current).forEach(manager => {
      if (manager && manager.destroy) {
        manager.destroy();
      }
    });
    setVideoPeers({});
    videoPeersRef.current = {};
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
            </div>            {/* Remote videos */}
            {participants.filter(pid => pid !== user.id).map(pid => {
              // Ensure we have a ref for this participant
              if (!remoteVideoRefs[pid]) {
                const newRef = React.createRef();
                setRemoteVideoRefs(prev => ({ ...prev, [pid]: newRef }));
              }
              
              return (
                <div className="m-2" key={pid}>
                  <video
                    ref={remoteVideoRefs[pid]}
                    playsInline
                    autoPlay
                    className="w-64 h-48 bg-black border-4 border-blue-400 rounded-lg"
                  />
                  <div className="text-center text-white mt-2">{pid}</div>
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