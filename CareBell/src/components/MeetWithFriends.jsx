import React, { useState, useRef, useEffect, useContext } from "react";
import io from "socket.io-client";
import SimplePeer from "simple-peer";
import axios from "axios";
import { API } from "../config";
import { FaArrowLeft }     from "react-icons/fa";
import { useNavigate }     from "react-router-dom";
import { AppContext } from '../AppContext';


const SIGNALING_SERVER_URL = `${API}`;
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function MeetWithFriends() {
  const { user } = useContext(AppContext);
  
  const [allUsers, setAllUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // 'idle', 'calling', 'ringing', 'connected'
  const [roomId, setRoomId] = useState(null);
  const [otherUserId, setOtherUserId] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef();
  const peerRef = useRef();
  const localStreamRef = useRef();  useEffect(() => {
    fetchAllUsers();
    if (user?.id) {
      fetchContacts();
    }
  }, [user?.id]);

  // Set local video stream when video element is available and we have a stream
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [inCall, localStreamRef.current]);

  useEffect(() => {
    if (!user?.id) return;

    socketRef.current = io(SIGNALING_SERVER_URL, {
      transports: ["websocket"],
      secure: true,
      reconnection: true,
      rejectUnauthorized: false
    });

    socketRef.current.emit("register", user.id);

    // Incoming call from another user
    socketRef.current.on("incoming-call", ({ callerId }) => {
      setIncomingCall(callerId);
      setCallStatus('ringing');
    });

    // Call is pending (waiting for target to answer)
    socketRef.current.on("call-pending", ({ targetUserId }) => {
      setCallStatus('calling');
      setOtherUserId(targetUserId);
    });

    // Target user is busy (already in a call)
    socketRef.current.on("call-busy", ({ targetUserId }) => {
      alert(`${targetUserId} is currently busy`);
      cleanupCall();
    });

    // Call was accepted by target
    socketRef.current.on("call-accepted", ({ roomId }) => {
      setRoomId(roomId);
      setCallStatus('connected');
      setInCall(true);
    });    // Call connected (for the answering user)
    socketRef.current.on("call-connected", ({ roomId }) => {
      setRoomId(roomId);
      setCallStatus('connected');
      setInCall(true);
      if (localStreamRef.current) {
        createPeer(false);
      }
    });// Initiate WebRTC peer connection (caller side)
    socketRef.current.on("initiate-peer", () => {
      if (localStreamRef.current) {
        createPeer(true);
      }
    });

    // Call was declined on another device
    socketRef.current.on("call-declined", ({ reason }) => {
      if (reason === 'answered elsewhere') {
        setIncomingCall(null);
        setCallStatus('idle');
      }
    });

    // Call was rejected
    socketRef.current.on("call-rejected", () => {
      alert("Call was rejected");
      cleanupCall();
    });

    // Call ended
    socketRef.current.on("call-ended", () => {
      cleanupCall();
    });

    // WebRTC signaling
    socketRef.current.on("signal", (data) => {
      if (peerRef.current) {
        peerRef.current.signal(data.signal);
      }
    });    return () => {
      socketRef.current?.disconnect();
      cleanupCall();
    };
  }, [user?.id]);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/users`);
      setAllUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };
  const fetchContacts = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/users/others?excludeId=${user.id}`);
      setContacts(response.data);
      console.log("Contacts:", response.data);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  };  const initiateCall = async (targetUserId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      
      setOtherUserId(targetUserId);
      socketRef.current.emit("call-user", targetUserId);
    } catch (err) {
      console.error("Error initiating call:", err);
      alert("Error starting call: " + err.message);
      cleanupCall();
    }
  };
  const createPeer = (isInitiator) => {
    const peer = new SimplePeer({
      initiator: isInitiator,
      trickle: false,
      stream: localStreamRef.current,
      config: { iceServers: ICE_SERVERS },
    });

    peer.on("signal", (data) => {
      socketRef.current.emit("signal", { roomId, signal: data });
    });

    peer.on("stream", (remoteStream) => {
      remoteVideoRef.current.srcObject = remoteStream;
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      cleanupCall();
    });

    peerRef.current = peer;
  };
  const acceptCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      
      setOtherUserId(incomingCall);
      socketRef.current.emit("accept-call");
      setIncomingCall(null);
    } catch (err) {
      console.error("Error accepting call:", err);
      alert("Failed to accept call: " + err.message);
      cleanupCall();
    }
  };
  const rejectCall = () => {
    socketRef.current.emit("reject-call");
    setIncomingCall(null);
    setCallStatus('idle');
  };
  const cleanupCall = () => {
    if (otherUserId) {
      socketRef.current.emit("end-call", { otherUserId });
    }
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    setInCall(false);
    setCallStatus('idle');
    setRoomId(null);
    setOtherUserId(null);
    setIncomingCall(null);
  };
  // If no user is available, show a message
  if (!user?.id) {
    return (
      <div className="w-[800px] h-[900px] bg-black relative">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-black/60 p-6 rounded-lg">
          <h2 className="text-white text-xl mb-4">Please log in to use video calling</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[800px] h-[900px] bg-black relative">
      {!inCall && callStatus === 'idle' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-black/60 p-6 rounded-lg">
          <h2 className="text-white text-xl mb-4">
            You are: {user.fullName || user.id}
          </h2>
          <h3 className="text-white text-lg mb-4">Select a contact to call</h3>
          {loading ? (
            <p className="text-white">Loading contacts...</p>
          ) : (
            <ul className="text-white">
              {contacts.map(contact => (
                <li key={contact.id} className="mb-2">
                  <button 
                    onClick={() => initiateCall(contact.id)}
                    className="px-4 py-2 bg-white text-black rounded"
                  >
                    {contact.fullName || contact.id}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}      {callStatus === 'calling' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-black/80 p-6 rounded-lg">
          <p className="text-white mb-4">
            Calling {allUsers.find(u => u.id === otherUserId)?.fullName || otherUserId}...
          </p>
          <button 
            onClick={cleanupCall}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {incomingCall && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 bg-black/80 p-6 rounded-lg">
          <p className="text-white mb-4">
            Incoming call from {allUsers.find(u => u.id === incomingCall)?.fullName || incomingCall}
          </p>
          <div className="flex gap-4">
            <button 
              onClick={acceptCall}
              className="px-4 py-2 bg-green-500 text-white rounded"
            >
              Accept
            </button>
            <button 
              onClick={rejectCall}
              className="px-4 py-2 bg-red-500 text-white rounded"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {inCall && (
        <div className="absolute inset-0">
          <video
            ref={remoteVideoRef}
            playsInline
            autoPlay
            className="w-[80%] h-[80%] object-cover absolute top-0 left-0"
          />
          <video
            ref={localVideoRef}
            playsInline
            autoPlay
            muted
            className="w-[150px] object-cover border-4 border-white rounded-lg absolute bottom-5 right-5 z-10"
          />
          <button
            onClick={cleanupCall}
            className="absolute bottom-5 left-5 px-4 py-2 bg-red-500 text-white rounded"
          >
            End Call
          </button>
        </div>
      )}
    </div>
  );
}

export default MeetWithFriends;