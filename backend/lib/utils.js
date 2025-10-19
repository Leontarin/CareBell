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

module.exports = { safeUserQuery };
