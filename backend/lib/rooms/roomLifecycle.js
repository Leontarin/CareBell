//backend/lib/rooms/roomLifecycle.js
const mongoose = require('mongoose');
const Room = require('../../models/room');

function asObjectId(id) {
  if (!id) return null;
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

async function removeUserFromAllRooms(userId, excludeRoomId = null) {
  await Room.updateMany({}, { $pull: { participants: { userId } } });

  const query = {
    type: 'temporary',
    everHadParticipants: true,
    participants: { $size: 0 }
  };

  if (excludeRoomId) {
    query._id = { $ne: asObjectId(excludeRoomId) };
  }

  await Room.deleteMany(query);
}

module.exports = {
  removeUserFromAllRooms,
  asObjectId
};
