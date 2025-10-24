const PICTOGRAMS = [
  { key: "R", icon: "🥩", tKey: "Meals.Legend.Pictograms.R", allergenFamily: [] },
  { key: "S", icon: "🐷", tKey: "Meals.Legend.Pictograms.S", allergenFamily: [] },
  { key: "G", icon: "🐔", tKey: "Meals.Legend.Pictograms.G", allergenFamily: [] },
  { key: "M", icon: "🥛", tKey: "Meals.Legend.Pictograms.M", allergenFamily: ["G"] },
  { key: "A", icon: "🍷", tKey: "Meals.Legend.Pictograms.A", allergenFamily: [] },
  {
    key: "W",
    icon: "🌾",
    tKey: "Meals.Legend.Pictograms.W",
    allergenFamily: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
  },
  { key: "K", icon: "🧄", tKey: "Meals.Legend.Pictograms.K", allergenFamily: [] },
  { key: "Y", icon: "🌱", tKey: "Meals.Legend.Pictograms.Y", allergenFamily: [] },
];

const ALLERGENS = [
  { code: "A1", tKey: "Meals.Legend.Allergens.A1", family: "gluten" },
  { code: "A2", tKey: "Meals.Legend.Allergens.A2", family: "gluten" },
  { code: "A3", tKey: "Meals.Legend.Allergens.A3", family: "gluten" },
  { code: "A4", tKey: "Meals.Legend.Allergens.A4", family: "gluten" },
  { code: "A5", tKey: "Meals.Legend.Allergens.A5", family: "gluten" },
  { code: "A6", tKey: "Meals.Legend.Allergens.A6", family: "gluten" },
  { code: "A7", tKey: "Meals.Legend.Allergens.A7", family: "gluten" },
  { code: "C", tKey: "Meals.Legend.Allergens.C", family: "egg" },
  { code: "G", tKey: "Meals.Legend.Allergens.G", family: "milk" },
  { code: "L", tKey: "Meals.Legend.Allergens.L", family: "celery" },
];

const ADDITIVES = [
  { code: "1", tKey: "Meals.Legend.Additives.1" },
  { code: "2", tKey: "Meals.Legend.Additives.2" },
  { code: "3", tKey: "Meals.Legend.Additives.3" },
  { code: "4", tKey: "Meals.Legend.Additives.4" },
  { code: "5", tKey: "Meals.Legend.Additives.5" },
  { code: "6", tKey: "Meals.Legend.Additives.6" },
  { code: "7", tKey: "Meals.Legend.Additives.7" },
];

const VERSION = "2025.10.24";

module.exports = {
  PICTOGRAMS,
  ALLERGENS,
  ADDITIVES,
  VERSION,
};

module.exports.default = module.exports;
