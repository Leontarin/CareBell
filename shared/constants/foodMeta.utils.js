//shared/constants/foodMeta.utils.js
// ─────────────────────────────────────────────
//  CareBell Food Metadata Utilities
//  Layer built on top of foodMeta.js
//  Works in both ESM (React/Vite) and CJS (Express)
// ─────────────────────────────────────────────

import {
  PICTOGRAMS,
  ALLERGENS,
  ADDITIVES,
  ALLERGEN_GROUPS,
} from "./foodMeta.js";

// ─────────────────────────────
//  Lookup Maps
// ─────────────────────────────
export const PICTO_BY_KEY = Object.fromEntries(PICTOGRAMS.map(p => [p.key, p]));
export const ALLERGEN_BY_CODE = Object.fromEntries(ALLERGENS.map(a => [a.code, a]));
export const ADDITIVE_BY_NUM = Object.fromEntries(ADDITIVES.map(a => [a.number, a]));

// ─────────────────────────────
//  Core Logic Helpers
// ─────────────────────────────

/**
 * Dynamically determine diabetic friendliness.
 * A food is considered NOT diabetic-friendly if any additive label
 * mentions "sweetener" or "sugar".
 */
export function isDiabeticFriendly(additives = []) {
  if (!Array.isArray(additives)) return true;

  // Build the list of "risky" additives dynamically from meta
  const risky = ADDITIVES
    .filter(a => /sweetener|sugar/i.test(a.label))
    .map(a => a.number);

  // If any additive number is in that risky list → not friendly
  return !additives.some(num => risky.includes(num));
}

/** Expand parent allergens (e.g. "A" → ["A","A1"…"A7"]) */
export function expandAllergenGroups(codes = []) {
  const expanded = new Set();
  for (const c of codes) {
    if (ALLERGEN_GROUPS[c]) {
      ALLERGEN_GROUPS[c].forEach(sub => expanded.add(sub));
      expanded.add(c);
    } else expanded.add(c);
  }
  return [...expanded];
}

/** Normalize allergen selection before storing / comparing */
export function normalizeAllergenSelection(codes = []) {
  return expandAllergenGroups([...new Set(codes)]);
}

/** Map allergens → pictogram keys (unique, DEHOGA/DGE aligned) */
export function derivePictogramsFromAllergens(codes = []) {
  const pictos = new Set();
  const all = expandAllergenGroups(codes);

  for (const code of all) {
    // Gluten group (A + subs)
    if (code.startsWith("A")) pictos.add("A");

    // Milk/lactose
    if (code === "G") pictos.add("L");

    // Tree nuts or peanuts
    if (code.startsWith("H") || code === "E") pictos.add("H");

    // Fish
    if (code === "D") pictos.add("F");

    // Crustaceans or molluscs (includes N and its children)
    if (code === "B" || code === "N" || code.startsWith("N")) pictos.add("B");

    // Eggs → poultry
    if (code === "C") pictos.add("G");

    // Soybeans → vegan/soy
    if (code === "F") pictos.add("Y");

    // Celery, mustard, sesame, sulphites, lupin → spice/plant mix
    if (["I", "J", "K", "L", "M"].includes(code)) pictos.add("K");
  }

  return [...pictos];
}

// ─────────────────────────────
//  UI + Logic Enhancements
// ─────────────────────────────

/** Consistent order for pictogram display */
export const PICTOGRAM_ORDER = ["R", "S", "G", "F", "A", "L", "H", "B", "V", "Y", "K"];

/** Ordered pictogram derivation for display */
export function derivePictogramsOrdered(codes = []) {
  const derived = derivePictogramsFromAllergens(codes);
  return [...derived].sort(
    (a, b) => PICTOGRAM_ORDER.indexOf(a) - PICTOGRAM_ORDER.indexOf(b)
  );
}

/** Compare user's allergens with a food's allergens */
export function isUserAllergic(userAllergens = [], foodAllergens = []) {
  const userSet = new Set(normalizeAllergenSelection(userAllergens));
  const foodSet = new Set(normalizeAllergenSelection(foodAllergens));
  const matched = [...foodSet].filter(c => userSet.has(c));
  return { any: matched.length > 0, matched };
}

/**
 * Format additive "bubble" using i18n
 * @param {number} n - additive number
 * @param {function} t - translation function
 * @returns {string} localized circled number (fallback "(n)")
 */
export function formatAdditiveBubble(n, t) {
  const key = `Meals.Meta.AdditiveBubble.${n}`;
  const val = typeof t === "function" ? t(key) : String(n);
  if (!val || val === key) return `(${n})`;
  return val;
}
/**
 * Format additive tag (rectangle style)
 * @param {number} n - additive number
 * @param {function} t - i18n translation function
 * @returns {object} { number, label, display }
 */
export function formatAdditiveTag(n, t) {
  const base = ADDITIVE_BY_NUM[n];
  const label = t?.(base?.tKey || `Meals.Meta.Additives.${n}`, base?.label || String(n));
  const display = `${formatAdditiveBubble(n, t)} ${label}`;
  return { number: n, label, display };
}

/** Fixed subset of DEHOGA/DGE additives used in CareBell */
export const ADDITIVE_SUBSET = [1, 3, 5, 7, 8, 9, 16];

// ─────────────────────────────
//  Optional small helper
// ─────────────────────────────

/** Get parent group code for a given allergen (e.g., "A1" → "A") */
export function getAllergenGroup(code) {
  for (const parent in ALLERGEN_GROUPS)
    if (ALLERGEN_GROUPS[parent].includes(code)) return parent;
  return null;
}

// ─────────────────────────────
//  Re-exports (for convenience)
// ─────────────────────────────
export {
  PICTOGRAMS,
  ALLERGENS,
  ADDITIVES,
};

// ─────────────────────────────
//  CommonJS compatibility shim
// ─────────────────────────────
try {
  if (typeof module !== "undefined") {
    module.exports = {
      PICTOGRAMS,
      ALLERGENS,
      ADDITIVES,
      PICTO_BY_KEY,
      ALLERGEN_BY_CODE,
      ADDITIVE_BY_NUM,
      expandAllergenGroups,
      normalizeAllergenSelection,
      derivePictogramsFromAllergens,
      derivePictogramsOrdered,
      isUserAllergic,
      formatAdditiveBubble,
      getAllergenGroup,
      ADDITIVE_SUBSET,
      PICTOGRAM_ORDER,
    };
  }
} catch (_) {}
