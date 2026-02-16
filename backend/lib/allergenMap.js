// backend/lib/allergenMap.js
// Map allergen strings → boolean flags (used by Admin UI)
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

function deriveFlagsFromAllergens(allergens = []) {
  const flags = { R:false,S:false,G:false,M:false,A:false,W:false,K:false,Y:false };
  for (const entry of allergens) {
    const key = ENTRY_TO_FLAG[entry?.toLowerCase?.()];
    if (key) flags[key] = true;
  }
  return flags;
}

module.exports = { deriveFlagsFromAllergens };