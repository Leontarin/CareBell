// src/MeetWithFriends.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { API } from "./config";
import { AppContext } from "../AppContext";

export default function MeetWithFriends() {
  const { user } = useContext(AppContext);

  const [rooms, setRooms] = useState([]);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");

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

  // 3) Join an existing room by name
  function joinRoom(roomName) {
    if (!user?.id) return;
    setJoinedRoom(roomName);
  }

  // 4) Leave the current room
  function leaveRoom() {
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
          <div className="flex justify-between w-full p-4 bg-gray-900">
            <span className="text-white text-lg">Room: {joinedRoom}</span>
            <button
              onClick={leaveRoom}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Leave Room
            </button>
          </div>

          <iframe
            src={`https://meet.jit.si/${encodeURIComponent(joinedRoom)}#config.disableDeepLinking=true&interfaceConfig.DEFAULT_REMOTE_DISPLAY_NAME="Participant"&interfaceConfig.DEFAULT_LOCAL_DISPLAY_NAME="You"&config.resolution=360`}
            allow="camera; microphone; fullscreen; display-capture"
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              flexGrow: 1,
            }}
          />
        </div>
      )}
    </div>
  );
}
