const { PICTOGRAMS } = require("../constants/meta");

function derivePictogramsFromAllergens(allergens = [], pictograms = PICTOGRAMS) {
  if (!Array.isArray(allergens) || !Array.isArray(pictograms)) {
    return [];
  }
  const allergenSet = new Set(allergens.filter(Boolean));
  if (!allergenSet.size) return [];

  const result = new Set();
  pictograms.forEach((p) => {
    if (!Array.isArray(p.allergenFamily) || !p.allergenFamily.length) return;
    for (const code of p.allergenFamily) {
      if (allergenSet.has(code)) {
        result.add(p.key);
        break;
      }
    }
  });
  return Array.from(result);
}

module.exports = { derivePictogramsFromAllergens };
module.exports.default = module.exports;
