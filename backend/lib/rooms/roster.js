//backend/lib/rooms/roster.js
const Room = require('../../models/room');
const { asObjectId } = require('./roomLifecycle');

async function getRoomRoster(roomId) {
  const room = await Room.findById(asObjectId(roomId)).lean();
  if (!room) return null;

  return {
    roomId: String(room._id),
    _id: room._id,
    name: room.name,
    type: room.type,
    maxParticipants: room.maxParticipants,
    participants: room.participants,
    participantsCount: room.participants.length,
    isActive: room.participants.length > 0,
  };
}

module.exports = { getRoomRoster };
