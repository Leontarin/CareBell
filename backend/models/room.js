const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, 
  participants: [{ type: String, required: true }],
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: false },
  isTemporary: { type: Boolean, default: true }, // true = temporary, false = default/permanent
});

// Auto-delete room when no participants remain - BUT ONLY IF IT'S TEMPORARY
roomSchema.pre('save', function(next) {
  if (this.participants.length === 0 && this.isTemporary) {
    this.deleteOne();
    return;
  }
  next();
});

module.exports = mongoose.model('Room', roomSchema);