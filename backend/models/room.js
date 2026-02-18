// backend/models/room.js
const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  fullName: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },

  type: {
    type: String,
    enum: ['temporary', 'permanent'],
    default: 'temporary'
  },

  maxParticipants: {
    type: Number,
    default: 8
  },

  participants: {
    type: [participantSchema],
    default: []
  },

  everHadParticipants: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Derived helper
roomSchema.virtual('isActive').get(function () {
  return this.participants.length > 0;
});

module.exports = mongoose.model('Room', roomSchema);
