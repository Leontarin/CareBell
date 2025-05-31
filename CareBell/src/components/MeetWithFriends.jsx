import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { API } from "./config";
import { AppContext } from "./AppContext";

function MeetWithFriends() {
  const { user } = useContext(AppContext);
  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const jitsiContainerRef = useRef(null);
  const domain = "meet.jit.si";
  const [jitsiAPI, setJitsiAPI] = useState(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    try {
      const res = await axios.get(`${API}/rooms`);
      setRooms(res.data);
    } catch (e) {
      console.error("Error fetching rooms:", e);
    }
  }

  async function createRoom() {
    if (!newRoomName.trim()) return;
    try {
      const { data } = await axios.post(`${API}/rooms/create`, {
        name: newRoomName,
        userId: user.id
      });
      setNewRoomName("");
      setRooms(prev => [...prev, data]);
      joinRoom(data.name);
    } catch (e) {
      alert("Failed to create room: " + e.message);
    }
  }

  function joinRoom(roomName) {
    if (!user?.id) return;
    if (jitsiAPI) {
      jitsiAPI.executeCommand("hangup");
      jitsiAPI.dispose();
      setJitsiAPI(null);
    }

    setJoinedRoom(roomName);
    const options = {
      roomName: roomName,
      parentNode: jitsiContainerRef.current,
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
          "tileview"
        ]
      },
      configOverwrite: {
        disableDeepLinking: true,
        enableWelcomePage: false
      },
      userInfo: {
        displayName: user.id
      }
    };

    const api = new window.JitsiMeetExternalAPI(domain, options);
    setJitsiAPI(api);
  }

  function leaveRoom() {
    if (jitsiAPI) {
      jitsiAPI.executeCommand("hangup");
      jitsiAPI.dispose();
      setJitsiAPI(null);
    }
    setJoinedRoom(null);
  }

  if (!user?.id) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <h2 className="text-white text-xl">
          Please log in to use video rooms
        </h2>
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
              className="px-2 py-1 rounded mr-2"
              placeholder="Room name"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
            />
            <button
              className="px-4 py-2 bg-green-600 text-white rounded"
              onClick={createRoom}
            >
              Create Room
            </button>
          </div>
          <ul className="text-white w-96">
            {rooms.map(r => (
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
          <div className="flex justify-between w-full p-4">
            <span className="text-white text-lg">Room: {joinedRoom}</span>
            <button
              onClick={leaveRoom}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Leave Room
            </button>
          </div>
          <div ref={jitsiContainerRef} className="w-full h-full" />
        </div>
      )}
    </div>
  );
}

export default MeetWithFriends;
