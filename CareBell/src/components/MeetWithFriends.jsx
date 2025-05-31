// src/MeetWithFriends.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { API } from "./config";
import { AppContext } from "./AppContext";

function MeetWithFriends() {
  const { user } = useContext(AppContext);

  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [jitsiAPI, setJitsiAPI] = useState(null);

  // Reference to the DOM node where Jitsi will embed
  const jitsiContainerRef = useRef(null);

  // 1) Fetch room list on mount
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

  // 2) Whenever joinedRoom changes, either create or destroy Jitsi
  useEffect(() => {
    // If no room is joined, do nothing
    if (!joinedRoom) return;

    // Before initializing, clear any existing embed in the container
    if (jitsiContainerRef.current) {
      jitsiContainerRef.current.innerHTML = "";
    }

    // Build options for the Jitsi External API
    const domain = "meet.jit.si";
    const options = {
      roomName: joinedRoom,
      parentNode: jitsiContainerRef.current,
      // Lower resolution helps when 3+ participants join
      configOverwrite: {
        disableDeepLinking: true,
        enableWelcomePage: false,
        // Set resolution to 360p (low bandwidth)
        resolution: 360,
        // Turn off unnecessary features
        startWithAudioMuted: false,
        startWithVideoMuted: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_LOCAL_DISPLAY_NAME: "You",
        DEFAULT_REMOTE_DISPLAY_NAME: "Participant",
        TOOLBAR_BUTTONS: [
          "microphone",
          "camera",
          "hangup",
          "chat",
          "tileview",
          "mute-everyone",
        ],
      },
      userInfo: {
        displayName: user.id,
      },
    };

    // Create the Jitsi instance
    const api = new window.JitsiMeetExternalAPI(domain, options);
    setJitsiAPI(api);

    // When remote participants join or leave, you can
    // listen to events here if needed (e.g., api.addEventListener)
    // But Jitsi itself handles SFU logic for >3 participants

    // Clean up on unmount or when joinedRoom changes
    return () => {
      if (api) {
        api.executeCommand("hangup");
        api.dispose();
      }
      setJitsiAPI(null);
    };
  }, [joinedRoom, user.id]);

  // Create a new room on the backend and immediately join it
  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const { data } = await axios.post(`${API}/rooms/create`, {
        name: newRoomName,
        userId: user.id,
      });
      setNewRoomName("");
      setRooms((prev) => [...prev, data]);
      // Join by using the room’s unique name (string)
      setJoinedRoom(data.name);
    } catch (e) {
      alert("Failed to create room: " + e.message);
    }
  };

  // Join an existing room by name
  const joinRoom = (roomName) => {
    if (!user?.id) return;
    // If already in a Jitsi session, hang up first
    if (jitsiAPI) {
      jitsiAPI.executeCommand("hangup");
      jitsiAPI.dispose();
      setJitsiAPI(null);
    }
    // Set joinedRoom → triggers useEffect to load Jitsi
    setJoinedRoom(roomName);
  };

  // Leave the current room
  const leaveRoom = () => {
    if (jitsiAPI) {
      jitsiAPI.executeCommand("hangup");
      jitsiAPI.dispose();
      setJitsiAPI(null);
    }
    setJoinedRoom(null);
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
      {/* If no room is joined, show room list + create input */}
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
        // Once joined, show the Jitsi container + leave button
        <div className="w-full h-full flex flex-col">
          <div className="flex justify-between w-full p-4 bg-gray-900">
            <span className="text-white text-lg">Room: {joinedRoom}</span>
            <button
              onClick={leaveRoom}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Leave Room
            </button>
          </div>

          <div
            ref={jitsiContainerRef}
            className="w-full h-full"
            style={{ flexGrow: 1 }}
          />
        </div>
      )}
    </div>
  );
}

export default MeetWithFriends;
