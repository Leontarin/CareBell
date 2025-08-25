// ./models/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  //user fields
  id: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  phoneNumber: String,
  address: String,
  dateOfBirth: Date,
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
  R: { type: Boolean, default: false },
  S: { type: Boolean, default: false },
  G: { type: Boolean, default: false },
  M: { type: Boolean, default: false },
  A: { type: Boolean, default: false },
  W: { type: Boolean, default: false },
  K: { type: Boolean, default: false },
  Y: { type: Boolean, default: false },
  Allergens: { type: [String], default: [] },
  Diabetic: { type: Boolean, default: false },

  //user auth fields
  username: { type: String, trim: true, lowercase: true, index: true, unique: false }, // optional
  email: { type: String, trim: true, lowercase: true, index: true, unique: true, sparse: true },
  passwordHash: { type: String, select: false },                  // only for local login
  googleId: { type: String, index: true },         // only for Google
  picture: { type: String },

  roles: { type: [String], default: ['user'] },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);