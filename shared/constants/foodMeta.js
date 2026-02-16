//./shared/constants/foodMeta.js
// ─────────────────────────────────────────────
//  CareBell Food Metadata (EU / DE Standards)
//  Unified for backend + frontend
//  Labels: English fallback
//  i18n key pattern: Meals.Meta.<Category>.<Key>
// ─────────────────────────────────────────────

// ─────────────────────────────
//  PICTOGRAMS (Voluntary icons)
//  Keys aligned with DEHOGA/DGE conventions
// ─────────────────────────────
export const PICTOGRAMS = [
  { key: "R", icon: "🐄", tKey: "Meals.Meta.Pictograms.R", label: "Beef" },
  { key: "S", icon: "🐖", tKey: "Meals.Meta.Pictograms.S", label: "Pork" },
  { key: "G", icon: "🐔", tKey: "Meals.Meta.Pictograms.G", label: "Poultry" },
  { key: "F", icon: "🐟", tKey: "Meals.Meta.Pictograms.F", label: "Fish" },
  { key: "A", icon: "🌾", tKey: "Meals.Meta.Pictograms.A", label: "Contains gluten" },
  { key: "L", icon: "🥛", tKey: "Meals.Meta.Pictograms.L", label: "Contains milk/lactose" },
  { key: "H", icon: "🌰", tKey: "Meals.Meta.Pictograms.H", label: "Contains tree nuts" },
  { key: "B", icon: "🦐", tKey: "Meals.Meta.Pictograms.B", label: "Contains shellfish" },
  { key: "V", icon: "🌿", tKey: "Meals.Meta.Pictograms.V", label: "Vegetarian" },
  { key: "Y", icon: "🌱", tKey: "Meals.Meta.Pictograms.Y", label: "Vegan" },
  { key: "K", icon: "🧄", tKey: "Meals.Meta.Pictograms.K", label: "Spicy / garlic / onion" },
];

// ─────────────────────────────
//  ALLERGENS (LMIV Annex II / DEHOGA codes)
//  Includes parent codes + sub-codes
// ─────────────────────────────
export const ALLERGENS = [
  // Parent groups
  { code: "A", tKey: "Meals.Meta.Allergens.A", label: "Gluten-containing cereals" },
  { code: "H", tKey: "Meals.Meta.Allergens.H", label: "Tree nuts (almonds, hazelnuts, walnuts, etc.)" },
  { code: "N", tKey: "Meals.Meta.Allergens.N", label: "Molluscs (snails, clams, squid, etc.)" },

  // A* – gluten cereals
  { code: "A1", tKey: "Meals.Meta.Allergens.A1", label: "Wheat (gluten)" },
  { code: "A2", tKey: "Meals.Meta.Allergens.A2", label: "Rye (gluten)" },
  { code: "A3", tKey: "Meals.Meta.Allergens.A3", label: "Barley (gluten)" },
  { code: "A4", tKey: "Meals.Meta.Allergens.A4", label: "Oats (gluten)" },
  { code: "A5", tKey: "Meals.Meta.Allergens.A5", label: "Spelt (gluten)" },
  { code: "A6", tKey: "Meals.Meta.Allergens.A6", label: "Khorasan / Kamut (gluten)" },
  { code: "A7", tKey: "Meals.Meta.Allergens.A7", label: "Triticale (gluten)" },

  // H* – tree nuts
  { code: "H1", tKey: "Meals.Meta.Allergens.H1", label: "Almonds" },
  { code: "H2", tKey: "Meals.Meta.Allergens.H2", label: "Hazelnuts" },
  { code: "H3", tKey: "Meals.Meta.Allergens.H3", label: "Walnuts" },
  { code: "H4", tKey: "Meals.Meta.Allergens.H4", label: "Cashews" },
  { code: "H5", tKey: "Meals.Meta.Allergens.H5", label: "Pecans" },
  { code: "H6", tKey: "Meals.Meta.Allergens.H6", label: "Brazil nuts" },
  { code: "H7", tKey: "Meals.Meta.Allergens.H7", label: "Pistachios" },
  { code: "H8", tKey: "Meals.Meta.Allergens.H8", label: "Macadamia / Queensland nuts" },

  // N* – molluscs
  { code: "N1", tKey: "Meals.Meta.Allergens.N1", label: "Mussels / clams" },
  { code: "N2", tKey: "Meals.Meta.Allergens.N2", label: "Oysters" },
  { code: "N3", tKey: "Meals.Meta.Allergens.N3", label: "Squid / calamari" },
  { code: "N4", tKey: "Meals.Meta.Allergens.N4", label: "Snails" },

  // Remaining LMIV allergens
  { code: "B", tKey: "Meals.Meta.Allergens.B", label: "Crustaceans" },
  { code: "C", tKey: "Meals.Meta.Allergens.C", label: "Eggs" },
  { code: "D", tKey: "Meals.Meta.Allergens.D", label: "Fish" },
  { code: "E", tKey: "Meals.Meta.Allergens.E", label: "Peanuts" },
  { code: "F", tKey: "Meals.Meta.Allergens.F", label: "Soybeans" },
  { code: "G", tKey: "Meals.Meta.Allergens.G", label: "Milk" },
  { code: "I", tKey: "Meals.Meta.Allergens.I", label: "Celery" },
  { code: "J", tKey: "Meals.Meta.Allergens.J", label: "Mustard" },
  { code: "K", tKey: "Meals.Meta.Allergens.K", label: "Sesame seeds" },
  { code: "L", tKey: "Meals.Meta.Allergens.L", label: "Sulphur dioxide and sulphites" },
  { code: "M", tKey: "Meals.Meta.Allergens.M", label: "Lupin" },
];

export const ALLERGEN_GROUPS = {
  A: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
  H: ["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"],
  N: ["N1", "N2", "N3", "N4"],
};

// ─────────────────────────────
//  ADDITIVES (ZZulV legend 1–14)
// ─────────────────────────────
export const ADDITIVES = [
  { number: 1,  tKey: "Meals.Meta.Additives.1",  label: "Colorant" },
  { number: 3,  tKey: "Meals.Meta.Additives.3",  label: "Antioxidant" },
  { number: 5,  tKey: "Meals.Meta.Additives.5",  label: "Sulphured" },
  { number: 7,  tKey: "Meals.Meta.Additives.7",  label: "Nitrite salt" },     // Nitritpökelsalz
  { number: 8,  tKey: "Meals.Meta.Additives.8",  label: "Phosphate" },
  { number: 9,  tKey: "Meals.Meta.Additives.9",  label: "Sweetener" },
  { number: 16, tKey: "Meals.Meta.Additives.16", label: "Sugar+sweetener" }  // Zucker(n) und Süßungsmittel(n)
];

// ─────────────────────────────
//  Export bundle
// ─────────────────────────────
export default { PICTOGRAMS, ALLERGENS, ADDITIVES };

// Optional CommonJS shim (for require support in Express)
try {
  if (typeof module !== "undefined") {
    module.exports = { PICTOGRAMS, ALLERGENS, ADDITIVES, ALLERGEN_GROUPS };
  }
} catch (_) {}
