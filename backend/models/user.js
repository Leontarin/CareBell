// ./models/user.js
const mongoose = require('mongoose');
const {
  LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  computeLanguageSettings,
} = require('../lib/language');

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
    sparse: true,
    validate: {
      validator: (v) => !v || /^\S+@\S+\.\S+$/.test(v),
      message: "Invalid email format",
    },
  },
  passwordHash: { type: String, select: false },                  // only for local login
  googleId: { type: String, index: true },         // only for Google
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

userSchema.pre("save", function (next) {
  if (this.isModified("id") && !this.isNew) {
    // prevent accidental id changes
    this.id = this._previousId || this.id;
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
