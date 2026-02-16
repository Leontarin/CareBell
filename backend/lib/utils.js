// backend/lib/utils.js
const mongoose = require("mongoose");

/**
 * Build a safe query that checks both `_id` and `id`
 * without throwing ObjectId cast errors for string IDs.
 */
function safeUserQuery(idOrString) {
  if (!idOrString) return {};

  // ✅ Only include _id if the string is a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(idOrString)) {
    return { $or: [{ _id: idOrString }, { id: idOrString }] };
  }

  // ✅ Otherwise only use custom string ID
  return { id: idOrString };
}

/**
 * Safe query for both numeric ids and ObjectIds.
 * Works across all models (users, foods, etc.)
 */
function safeQuery(idOrString) {
  if (!idOrString) return {};
  if (mongoose.Types.ObjectId.isValid(idOrString)) {
    return { $or: [{ _id: idOrString }, { id: Number(idOrString) || idOrString }] };
  }
  const asNum = Number(idOrString);
  if (!Number.isNaN(asNum)) return { id: asNum };
  return { id: idOrString };
}

/**
 * Parse comma-separated strings or JSON arrays into arrays.
 * Used for form-data fields like "additives", "allergens", "pictograms".
 */
function parseArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      return s.split(",").map((v) => v.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Parse boolean-like values from strings or actual booleans.
 * Handles HTML form values like "true", "on", "1".
 */
function parseBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(1|true|yes|on)$/i.test(v);
  return false;
}

/**
 * Return a plain object version of a Mongoose document,
 * with heavy binary fields (like image) removed.
 */
function cleanFood(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.image;
  return obj;
}

/**
 * Get numeric auto-increment for model (e.g. Food).
 * Use only for models with an "id" field.
 */
async function nextNumericId(Model) {
  const last = await Model.findOne().sort({ id: -1 }).select("id");
  return last ? last.id + 1 : 1;
}

/**
 * Generic Express error wrapper (for cleaner try/catch routes).
 * Example: router.get('/', wrap(async (req,res)=>{...}))
 */
function wrap(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = {
  safeQuery,
  safeUserQuery,
  parseArray,
  parseBool,
  cleanFood,
  nextNumericId,
  wrap,
};

