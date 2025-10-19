const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");

const router = express.Router();
const Food = require("../../models/food");
const isAdmin = require("../../middleware/isAdmin");

// ──────────────────────────────────────────────────────────────────────────────
// Admin guard on everything in this router
// ──────────────────────────────────────────────────────────────────────────────
router.use(isAdmin);

// ──────────────────────────────────────────────────────────────────────────────
/** Utilities */
function safeFoodQuery(idOrString) {
  if (!idOrString) return {};
  if (mongoose.Types.ObjectId.isValid(idOrString)) {
    return { $or: [{ _id: idOrString }, { id: Number(idOrString) || idOrString }] };
  }
  const asNum = Number(idOrString);
  if (!Number.isNaN(asNum)) return { id: asNum };
  return { id: idOrString };
}

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
      return s.split(",").map(v => v.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(1|true|yes|on)$/i.test(v);
  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// Multer temp storage (we'll delete after reading file buffer)
// ──────────────────────────────────────────────────────────────────────────────
const tmpDir = path.join(__dirname, "..", "..", "tmp_uploads");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpDir),
  filename: (_req, file, cb) =>
    cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname || "")}`),
});
const upload = multer({ storage });

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/foods  → list (with optional ?q= search on dish, barcode, category)
// ──────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { dish: rx },
        { barcode: rx },
        { category: rx },
        { description: rx },
      ];
    }
    const foods = await Food.find(filter).sort({ createdAt: -1 }).lean();
    // hide binary blobs to reduce payload size
    foods.forEach(f => delete f.image);
    res.json(foods);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/foods/:id/image → serve the stored image blob
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id/image", async (req, res) => {
  try {
    const food = await Food.findOne(safeFoodQuery(req.params.id)).lean();
    if (!food || !food.image || !food.image.data) {
      return res.status(404).send("Image not found");
    }
    res.contentType(food.image.contentType || "image/png");
    res.send(food.image.data);
  } catch (e) {
    res.status(500).send("Error retrieving image");
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /admin/foods → create new food (store image blob if provided)
// ──────────────────────────────────────────────────────────────────────────────
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const {
      barcode,
      id,
      date,
      category,
      dish,
      description,
      additives,
      allergens,
      pictograms,
      diabeticFriendly,
      contains_R,
      contains_S,
      contains_G,
      contains_M,
      contains_A,
      contains_W,
      contains_K,
      contains_Y,
    } = req.body;

    if (!barcode || !id || !date || !category || !dish || typeof diabeticFriendly === "undefined") {
      return res.status(400).json({ message: "Missing required fields (barcode, id, date, category, dish, diabeticFriendly)" });
    }

    const doc = new Food({
      barcode: String(barcode),
      id: Number(id),
      date: String(date),
      category: String(category),
      dish: String(dish),
      description: description ?? null,
      additives: parseArray(additives),
      allergens: parseArray(allergens),
      pictograms: parseArray(pictograms),
      diabeticFriendly: parseBool(diabeticFriendly),

      contains_R: parseBool(contains_R),
      contains_S: parseBool(contains_S),
      contains_G: parseBool(contains_G),
      contains_M: parseBool(contains_M),
      contains_A: parseBool(contains_A),
      contains_W: parseBool(contains_W),
      contains_K: parseBool(contains_K),
      contains_Y: parseBool(contains_Y),
    });

    // ── handle image blob
    if (req.file) {
      const fileBuffer = fs.readFileSync(req.file.path);
      doc.image = {
        data: fileBuffer,
        contentType: req.file.mimetype || "image/png",
      };
      fs.unlinkSync(req.file.path); // cleanup
    }

    await doc.save();
    res.status(201).json(doc);
  } catch (e) {
    console.error("Food upload error:", e);
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /admin/foods/:id → update (supports multipart or JSON)
// ──────────────────────────────────────────────────────────────────────────────
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const q = safeFoodQuery(req.params.id);
    const body = { ...req.body };

    // Normalize fields
    if (body.id != null) body.id = Number(body.id);
    if (body.diabeticFriendly != null) body.diabeticFriendly = parseBool(body.diabeticFriendly);
    if (body.additives != null) body.additives = parseArray(body.additives);
    if (body.allergens != null) body.allergens = parseArray(body.allergens);
    if (body.pictograms != null) body.pictograms = parseArray(body.pictograms);
    const bools = ["contains_R","contains_S","contains_G","contains_M","contains_A","contains_W","contains_K","contains_Y"];
    for (const k of bools) {
      if (k in body) body[k] = parseBool(body[k]);
    }

    // handle new image blob
    if (req.file) {
      const fileBuffer = fs.readFileSync(req.file.path);
      body.image = {
        data: fileBuffer,
        contentType: req.file.mimetype || "image/png",
      };
      fs.unlinkSync(req.file.path);
    }

    const updated = await Food.findOneAndUpdate(q, body, { new: true });
    if (!updated) return res.status(404).json({ message: "Food not found" });
    res.json(updated);
  } catch (e) {
    console.error("Food update error:", e);
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /admin/foods/:id → delete single
// ──────────────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Food.findOneAndDelete(safeFoodQuery(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Food not found" });
    res.json({ success: true, message: "Food deleted", deleted });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /admin/foods/bulk-delete → delete many
// ──────────────────────────────────────────────────────────────────────────────
router.post("/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "Provide ids: []" });
    }

    const or = ids.map(v => {
      if (mongoose.Types.ObjectId.isValid(v)) return { _id: v };
      const asNum = Number(v);
      if (!Number.isNaN(asNum)) return { id: asNum };
      return { id: v };
    });

    const result = await Food.deleteMany({ $or: or });
    res.json({ success: true, deletedCount: result.deletedCount || 0 });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
