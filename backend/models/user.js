// ────────────────────────────────
//  Imports
// ────────────────────────────────
import { derivePictogramsFromAllergens } from "../../shared/constants/foodMeta.utils.js";

const mongoose = require('mongoose');
const {
  LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  computeLanguageSettings,
} = require('../lib/language');

// ────────────────────────────────
//  Schema
// ────────────────────────────────
const userSchema = new mongoose.Schema({
  //user fields
  id: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  phoneNumber: String,
  address: String,
  dateOfBirth: Date,
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },

  //  Unified CareBell food meta fields
  allergens: { type: [String], default: [] },
  pictograms: { type: [String], default: [] },
  Diabetic: { type: Boolean, default: false },

  //user auth fields
  username: {
    type: String,
    trim: true,
    lowercase: true,
    index: true,
    // uniqueness handled by partial index below
  },  
  email: {
    type: String,
    trim: true,
    lowercase: true,
    set: v => (v == null || String(v).trim() === "" ? undefined : String(v).trim().toLowerCase()),
    validate: {
      validator: v => !v || /^\S+@\S+\.\S+$/.test(v),
      message: "Invalid email format",
    },
  },
  passwordHash: { type: String, select: false },
  googleId: { type: String, index: true },
  picture: { type: String },

  country: { type: String, uppercase: true, trim: true },
  language: { type: String, enum: LANGUAGE_CODES, default: DEFAULT_LANGUAGE },
  languages: {
    type: [String],
    default: [DEFAULT_LANGUAGE],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.every((code) => LANGUAGE_CODES.includes(code)),
      message: 'One or more provided languages are not supported.',
    },
  },

  roles: { type: [String], default: ['user'] },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
}, { timestamps: true });

// ────────────────────────────────
//  Hooks
// ────────────────────────────────

// Prevent accidental ID changes
userSchema.pre("save", function (next) {
  if (this.isModified("id") && !this.isNew) {
    this.id = this._previousId || this.id;
  }

  // Derive pictograms from allergens
  if (this.isModified("allergens")) {
    this.pictograms = derivePictogramsFromAllergens(this.allergens || []);
  }

  next();
});

userSchema.pre('validate', function ensureLanguageDefaults(next) {
  try {
    const settings = computeLanguageSettings({
      country: this.country,
      preferredLanguage: this.language,
    });

    this.country = settings.country;
    this.language = settings.language;
    this.languages = settings.languages;

    next();
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────
//  Unique indexes (ignore null / empty)
// ────────────────────────────────
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string", $ne: "" } } }
);
userSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: "string", $ne: "" } } }
);

// Require at least one of the two for registration
userSchema.pre("validate", function (next) {
  if (!this.email && !this.username) {
    return next(new Error("Either email or username is required"));
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
