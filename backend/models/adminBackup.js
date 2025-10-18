// backend/models/adminBackup.js
const mongoose = require("mongoose");

const adminBackupSchema = new mongoose.Schema({
  entity: { type: String, enum: ["user", "meal", "allergy"], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  backupData: { type: Object, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AdminBackup", adminBackupSchema);
