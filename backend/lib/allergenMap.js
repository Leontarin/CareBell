// backend/lib/allergenMap.js
// Central mapping between allergen names and flags

const ENTRY_TO_FLAG = {
  "contains gluten": "G",
  "contains wheat": "W",
  "contains spelt": "S",
  "contains rye": "R",
  "contains milk": "M",
  "contains almonds": "A",
  "contains sesame": "K",
  "contains soy": "Y",
};

// Reverse mapping for quick lookup (flag → allergen)
const FLAG_TO_ENTRY = Object.fromEntries(
  Object.entries(ENTRY_TO_FLAG).map(([entry, flag]) => [flag, entry])
);

// Derive boolean flags from allergen names (used by Meals/UI)
function deriveFlagsFromAllergens(allergens = []) {
  const flags = { R:false,S:false,G:false,M:false,A:false,W:false,K:false,Y:false };
  for (const entry of allergens) {
    const key = ENTRY_TO_FLAG[entry?.toLowerCase?.()];
    if (key) flags[key] = true;
  }
  return flags;
}

// Derive allergen list from boolean flags (used by Admin creation/update)
function deriveAllergensFromFlags(flags = {}) {
  return Object.entries(FLAG_TO_ENTRY)
    .filter(([flag]) => flags[`contains_${flag}`])
    .map(([_, label]) => label);
}

module.exports = {
  ENTRY_TO_FLAG,
  FLAG_TO_ENTRY,
  deriveFlagsFromAllergens,
  deriveAllergensFromFlags,
};
