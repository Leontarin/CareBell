const LANGUAGE_CODES = ["en", "de", "fi", "he"];
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
  const available = [];
  const addLanguage = (code) => {
    if (!code && code !== 0) return;
    const normalized = String(code).trim().toLowerCase();
    if (!normalized) return;
    if (!LANGUAGE_CODES.includes(normalized)) {
      throw new Error(`Unsupported language code: ${code}`);
    }
    if (!available.includes(normalized)) {
      available.push(normalized);
    }
    return normalized;
  };

  const result = {
    country: undefined,
    language: DEFAULT_LANGUAGE,
    languages: [DEFAULT_LANGUAGE],
  };

  if (country) {
    const normalizedCountry = String(country).trim().toUpperCase();
    const config = COUNTRY_LANGUAGE_MAP[normalizedCountry];

    if (!config) {
      throw new Error(`Unsupported country code: ${country}`);
    }

    result.country = normalizedCountry;

    for (const lang of config.languages) {
      addLanguage(lang);
    }

    if (preferredLanguage) {
      const normalizedLang = String(preferredLanguage).trim().toLowerCase();
      if (!available.includes(normalizedLang)) {
        throw new Error(
          `Language ${preferredLanguage} is not available for country ${normalizedCountry}`
        );
      }
      result.language = normalizedLang;
    } else {
      const fallback = config.default || config.languages[0] || DEFAULT_LANGUAGE;
      const normalizedFallback = String(fallback).trim().toLowerCase();
      if (!available.includes(normalizedFallback)) {
        addLanguage(normalizedFallback);
      }
      result.language = normalizedFallback;
    }
  } else if (preferredLanguage) {
    const normalizedLang = addLanguage(preferredLanguage);
    result.language = normalizedLang || DEFAULT_LANGUAGE;
  }

  addLanguage(DEFAULT_LANGUAGE);

  result.languages = available.length ? available : [DEFAULT_LANGUAGE];
  if (!result.languages.includes(result.language)) {
    result.languages.push(result.language);
  }
  if (result.languages[0] !== result.language) {
    result.languages = [
      result.language,
      ...result.languages.filter((code) => code !== result.language),
    ];
  }

  return result;
}

module.exports = {
  LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  COUNTRY_LANGUAGE_MAP,
  getCountryConfig,
  computeLanguageSettings,
};
