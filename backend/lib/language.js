//backend/lib/language.js
const LANGUAGE_CODES = ["en", "de", "fi", "he", "ru"];
const DEFAULT_LANGUAGE = "en";

const COUNTRY_LANGUAGE_MAP = {
  DE: { default: "de", languages: ["de", "en"] },
  FI: { default: "fi", languages: ["fi", "en"] },
  IL: { default: "he", languages: ["he", "en"] },
};

function getCountryConfig(countryCode) {
  if (!countryCode) return undefined;
  const code = String(countryCode).trim().toUpperCase();
  return COUNTRY_LANGUAGE_MAP[code];
}

function computeLanguageSettings({ country, preferredLanguage } = {}) {
  const result = {
    country: undefined,
    language: DEFAULT_LANGUAGE,
  };

  let normalizedPreferred;
  if (preferredLanguage) {
    normalizedPreferred = String(preferredLanguage).trim().toLowerCase();
    if (!LANGUAGE_CODES.includes(normalizedPreferred)) {
      throw new Error(`Unsupported language code: ${preferredLanguage}`);
    }
  }

  if (country) {
    const normalizedCountry = String(country).trim().toUpperCase();
    const config = COUNTRY_LANGUAGE_MAP[normalizedCountry];

    if (!config) {
      throw new Error(`Unsupported country code: ${country}`);
    }

    result.country = normalizedCountry;
    if (normalizedPreferred) {
      result.language = normalizedPreferred;
    } else {
      const fallback = config.default || DEFAULT_LANGUAGE;
      result.language = String(fallback).trim().toLowerCase();
    }
  } else if (normalizedPreferred) {
    result.language = normalizedPreferred;
  }

  result.languages = [
    result.language,
    ...LANGUAGE_CODES.filter((code) => code !== result.language),
  ];

  return result;
}

function derivePreferredLanguage(source) {
  if (!source) return undefined;

  const preferCandidates = [];
  if (source.language) preferCandidates.push(source.language);
  if (Array.isArray(source.languages)) {
    for (const code of source.languages) {
      if (code) preferCandidates.push(code);
    }
  }

  for (const value of preferCandidates) {
    const normalized = String(value).trim().toLowerCase();
    if (normalized) return normalized;
  }

  return undefined;
}

function languagesMatch(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((code, index) => b[index] === code);
}

function normalizeUserLanguage(doc = {}) {
  const rawCountry = doc.country ? String(doc.country).trim().toUpperCase() : undefined;
  const config = getCountryConfig(rawCountry);

  let preferred = derivePreferredLanguage(doc);
  if (preferred && !LANGUAGE_CODES.includes(preferred)) {
    preferred = undefined;
  }

  if (config) {
    if (!preferred) {
      const fallback = config.default || config.languages[0] || DEFAULT_LANGUAGE;
      preferred = String(fallback).trim().toLowerCase();
    }
  } else {
    // If we do not support this country, drop it and compute based on preferred language only
    if (rawCountry) {
      doc.country = undefined;
    }
  }

  let settings;
  try {
    settings = computeLanguageSettings({
      country: config ? rawCountry : undefined,
      preferredLanguage: preferred,
    });
  } catch (err) {
    // As a final fallback, ignore country constraints and default to preferred / English
    settings = computeLanguageSettings({ preferredLanguage: preferred });
  }

  const changed =
    doc.country !== settings.country ||
    doc.language !== settings.language ||
    !languagesMatch(doc.languages, settings.languages);

  doc.country = settings.country;
  doc.language = settings.language;
  doc.languages = settings.languages;

  return { changed, settings };
}

module.exports = {
  LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  COUNTRY_LANGUAGE_MAP,
  getCountryConfig,
  computeLanguageSettings,
  derivePreferredLanguage,
  normalizeUserLanguage,
};
