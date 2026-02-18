const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, 
  participants: [{ type: String, required: true }],
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: false },
  isTemporary: { type: Boolean, default: true }, // true = temporary, false = default/permanent
});

module.exports = mongoose.model('Room', roomSchema);