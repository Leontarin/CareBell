// backend/routes/admin/foods.js
const express = require("express");
const multer = require("multer");
const Food = require("../../models/food");
const isAdmin = require("../../middleware/isAdmin");
const { deriveAllergensFromFlags } = require("../../lib/allergenMap");
const { AVAILABLE_LANGUAGES } = require("../../lib/language");

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ──────────────────────────────────────────────
// PUBLIC IMAGE ACCESS (must come before isAdmin)
// ──────────────────────────────────────────────
router.get("/:id/image", async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food || !food.image?.data) {
      return res.status(404).send("Image not found");
    }
    res.contentType(food.image.contentType || "image/png");
    res.send(food.image.data);
  } catch (err) {
    console.error("GET /foods/:id/image failed:", err);
    res.status(500).send("Error retrieving image");
  }
});

// ──────────────────────────────────────────────
// ADMIN-ONLY ROUTES BELOW
// ──────────────────────────────────────────────
router.use(isAdmin);

/* Helper: extract translations from form data */
function extractTranslations(body) {
  const translations = {};
  for (const lang of AVAILABLE_LANGUAGES) {
    const dish = body[`dish_${lang}`];
    const description = body[`description_${lang}`];
    const category = body[`category_${lang}`];          // ✅ new
    if (dish || description || category) {
      translations[lang] = {
        dish: dish || "",
        description: description || "",
        category: category || "",                       // ✅ new
      };
    }
  }
  return translations;
}

/* Helper: sanitize and enrich food object */
function foodToJSON(food) {
  const obj = food.toObject({ virtuals: true });
  if (obj.image?.data) delete obj.image;
  obj.imageURL = `/foods/${obj._id}/image`;
  return obj;
}

// ──────────────────────────────────────────────
// GET /admin/foods?q=search
// ──────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    const filter = q
      ? {
          $or: [
            { dish: { $regex: q, $options: "i" } },
            { category: { $regex: q, $options: "i" } },
            { barcode: { $regex: q, $options: "i" } },
          ],
        }
      : {};
    const foods = await Food.find(filter).sort({ dish: 1 });
    res.json(foods.map(foodToJSON));
  } catch (err) {
    console.error("GET /admin/foods failed:", err);
    res.status(500).json({ message: "Failed to fetch foods" });
  }
});

// ──────────────────────────────────────────────
// POST /admin/foods  (multipart/form-data)
// ──────────────────────────────────────────────
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { barcode, date, category, diabeticFriendly, ...rest } = req.body;

    // Extract contains flags
    const containsFlags = {};
    for (const c of ["R", "S", "G", "M", "A", "W", "K", "Y"]) {
      containsFlags[`contains_${c}`] =
        rest[`contains_${c}`] === "true" || rest[`contains_${c}`] === "on";
    }

    // Auto-increment id
    const lastFood = await Food.findOne().sort({ id: -1 }).lean();
    const nextId = lastFood ? lastFood.id + 1 : 1;

    // Derived fields
    const derivedAllergens = deriveAllergensFromFlags(containsFlags);
    const translations = extractTranslations(req.body);

    const newFood = new Food({
      barcode,
      id: nextId,
      date,
      category,
      diabeticFriendly:
        diabeticFriendly === "true" || diabeticFriendly === "on",
      allergens: derivedAllergens,
      translations,
      ...containsFlags,
    });

    // Attach image
    if (req.file) {
      newFood.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    await newFood.save();
    res.json(foodToJSON(newFood));
  } catch (err) {
    console.error("POST /admin/foods failed:", err);
    res.status(500).json({ message: "Failed to create food" });
  }
});

// ──────────────────────────────────────────────
// PUT /admin/foods/:id
// ──────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;

    const containsFlags = {};
    for (const c of ["R", "S", "G", "M", "A", "W", "K", "Y"]) {
      containsFlags[`contains_${c}`] =
        body[`contains_${c}`] === "true" ||
        body[`contains_${c}`] === "on" ||
        body[`contains_${c}`] === true;
    }

    const derivedAllergens = deriveAllergensFromFlags(containsFlags);
    const translations = extractTranslations(body);

    const updated = await Food.findByIdAndUpdate(
      id,
      { ...body, ...containsFlags, allergens: derivedAllergens, translations },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(foodToJSON(updated));
  } catch (err) {
    console.error("PUT /admin/foods/:id failed:", err);
    res.status(500).json({ message: "Failed to update food" });
  }
});

// ──────────────────────────────────────────────
// DELETE /admin/foods/:id
// ──────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Food.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("DELETE /admin/foods/:id failed:", err);
    res.status(500).json({ message: "Failed to delete food" });
  }
});

// ──────────────────────────────────────────────
// BULK DELETE
// ──────────────────────────────────────────────
router.post("/bulk-delete", async (req, res) => {
  try {
    const ids = req.body.ids || [];
    if (!Array.isArray(ids) || !ids.length)
      return res.status(400).json({ message: "No IDs provided" });

    const result = await Food.deleteMany({ _id: { $in: ids } });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    console.error("Bulk delete failed:", err);
    res.status(500).json({ message: "Failed bulk delete" });
  }
});

module.exports = router;
