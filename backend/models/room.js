const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: false }, // true if a call is ongoing
});

// Remove room if no participants remain
roomSchema.pre('save', function(next) {
  if (this.participants.length === 0) {
    this.remove();
  }
  next();
});

module.exports = mongoose.model('Room', roomSchema);
