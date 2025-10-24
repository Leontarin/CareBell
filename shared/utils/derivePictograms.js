function derivePictogramsFromAllergens(allergens = [], pictograms = []) {
  if (!Array.isArray(allergens) || !allergens.length) return [];

  const allergenSet = new Set(allergens.map(String));
  const derived = new Set();

  pictograms.forEach((pictogram) => {
    const family = Array.isArray(pictogram?.allergenFamily)
      ? pictogram.allergenFamily
      : [];

    if (family.some((code) => allergenSet.has(String(code)))) {
      derived.add(pictogram.key);
    }
  });

  return Array.from(derived);
}

module.exports = { derivePictogramsFromAllergens };
module.exports.default = module.exports;
