// backend/lib/rooms/roomLifecycle.js
const mongoose = require('mongoose');
const Room = require('../../models/room');

function asObjectId(id) {
  if (!id) return null;
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

async function removeUserFromAllRooms(userId, excludeRoomId = null) {
  // Only touch rooms that actually contain this user
  const pullRes = await Room.updateMany(
    { 'participants.userId': userId },
    { $pull: { participants: { userId } } }
  );

  const query = {
    type: 'temporary',
    everHadParticipants: true,
    participants: { $size: 0 }
  };
  if (excludeRoomId) query._id = { $ne: asObjectId(excludeRoomId) };

  const delRes = await Room.deleteMany(query);

  const modified = (pullRes?.modifiedCount || pullRes?.nModified || 0) > 0;
  const deleted = (delRes?.deletedCount || 0) > 0;

  return modified || deleted;
}

module.exports = {
  removeUserFromAllRooms,
  asObjectId
};
