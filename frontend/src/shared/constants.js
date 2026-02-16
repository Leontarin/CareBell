import i18n from "./i18n";

export const COUNTRIES = [
  { code: "DE", name: "Germany", languages: ["de", "en"], flag: "🇩🇪" },
  { code: "FI", name: "Finland", languages: ["fi", "en"], flag: "🇫🇮" },
  { code: "IL", name: "Israel", languages: ["he", "en"], flag: "🇮🇱" },
  { code: "US", name: "United States", languages: ["en"], flag: "🇺🇸" },
];

// 🔍 Dynamically build the language labels
export const LANG_LABELS = Object.keys(i18n.options.resources).reduce((acc, key) => {
  const names = { en: "English", he: "Hebrew", de: "German", fi: "Finnish" };
  acc[key] = names[key] || key.toUpperCase();
  return acc;
}, {});

export const AVAILABLE_LANGUAGES = Object.keys(i18n.options.resources);