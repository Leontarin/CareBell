// ./models/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  fullName: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String
  },
  address: {
    type: String
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'], // optional: restrict to these values
    default: 'other'
  },
  // the numeric fields R, S, G, M, A, W, K, Y
  R: {
    type: Number,
    default: 0
  },
  S: {
    type: Number,
    default: 0
  },
  G: {
    type: Number,
    default: 0
  },
  M: {
    type: Number,
    default: 0
  },
  A: {
    type: Number,
    default: 0
  },
  W: {
    type: Number,
    default: 0
  },
  K: {
    type: Number,
    default: 0
  },
  Y: {
    type: Number,
    default: 0
  },
  Allergens: {
    type: [String],
    default: []
  },
  Diabetic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);