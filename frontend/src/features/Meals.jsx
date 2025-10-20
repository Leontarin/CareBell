// frontend/src/features/Meals.jsx
import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { API } from "../shared/config";
import { useTranslation } from "react-i18next";
import { playTts } from "../shared/tts";
import { AppContext } from "../shared/AppContext";

export default function Meals() {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AppContext);
  const userAllergens = user?.Allergens || [];

  const [allMeals, setAllMeals] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [meal, setMeal] = useState(null);
  const [activeBarcode, setActiveBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);
  const activeBarcodeRef = useRef("");

  /* ---------- fetch helpers ---------- */
  const fetchAllMeals = useCallback(async () => {
    try {
      setLoading(true);
      const lang = i18n.language.split("-")[0];
      const res = await fetch(`${API}/foods?lang=${lang}`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid data format");
      setAllMeals(data);
      const currentBarcode = activeBarcodeRef.current;
      if (currentBarcode) {
        const updated = data.find((m) => m.barcode === currentBarcode);
        if (updated) setMeal(updated);
      }
    } catch (err) {
      setError(`Could not load meals: ${err.message}`);
      setAllMeals([]);
    } finally {
      setLoading(false);
    }
  }, [i18n.language]);

  /* ---------- effects ---------- */
  useEffect(() => {
    fetchAllMeals();
  }, [fetchAllMeals]);
  useEffect(() => {
    activeBarcodeRef.current = activeBarcode;
  }, [activeBarcode]);
  useEffect(
    () => () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    },
    []
  );
  const fetchByCode = useCallback(
    async (code, { speak = true, showNotFoundError = true } = {}) => {
      const trimmed = (code || "").trim();
      if (!trimmed) return;
      setActiveBarcode(trimmed);
      setLoading(true);
      setError("");
      try {
        const lang = i18n.language.split("-")[0];
        const res = await fetch(`${API}/foods/${trimmed}?lang=${lang}`);
        if (!res.ok) {
          const err = new Error(res.status === 404 ? "NOT_FOUND" : "HTTP_ERROR");
          err.status = res.status;
          throw err;
        }
        const data = await res.json();
        setMeal(data);
        if (speak) {
          setTimeout(() => speakText(createFoodDescription(data)), 600);
        }
      } catch (err) {
        console.warn("Meal lookup failed", err);
        const fallback = allMeals.find((m) => m.barcode === trimmed);
        if (fallback) {
          setMeal(fallback);
          if (speak) {
            setTimeout(() => speakText(createFoodDescription(fallback)), 600);
          }
        } else if (showNotFoundError) {
          setMeal(null);
          const message = t("Meals.notFoundWithCode", { code: trimmed });
          setError(message);
          if (speak) {
            setTimeout(() => speakText(t("Meals.notFoundSpoken")), 300);
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [
      allMeals,
      createFoodDescription,
      i18n.language,
      speakText,
      t,
    ]
  );

  useEffect(() => {
    if (!activeBarcode) return;
    fetchByCode(activeBarcode, { speak: false, showNotFoundError: false });
  }, [activeBarcode, fetchByCode, i18n.language]);

  /* ---------- barcode handlers ---------- */
  const handleDetected = (_, result) => {
    if (!result) return;
    setScanning(false);
    fetchByCode(result.text);
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    fetchByCode(code);
  };

  /* ---------- speech ---------- */
  const toggleScanner = () => {
    setScanning((s) => !s);
  };

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const speakText = useCallback(
    async (text) => {
      stopSpeaking();
      if (!text) return;
      try {
        const lang = i18n.language.split("-")[0];
        const audio = await playTts(text, lang);
        audioRef.current = audio;
        setSpeaking(true);
        audio.onended = () => {
          if (audioRef.current === audio) {
            audioRef.current = null;
            setSpeaking(false);
          }
        };
      } catch (err) {
        console.error("TTS error:", err);
      }
    },
    [i18n.language, stopSpeaking]
  );

  /* ---------- helpers ---------- */
  const getLocalizedField = useCallback(
    (meal, field) => {
      const direct = meal?.[field];
      if (direct && String(direct).trim().length) return direct;

      const lang = i18n.language.split("-")[0];
      return (
        meal?.translations?.[lang]?.[field] ||
        meal?.translations?.en?.[field] ||
        ""
      );
    },
    [i18n.language]
  );

  const trAllergens = useCallback(
    (list) =>
      (list || []).map((a) => {
        const key = a.toLowerCase();
        return t(`Meals.Legend.Allergens.${key}`, key);
      }),
    [t]
  );

  const createFoodDescription = useCallback(
    (item) => {
      const dish = getLocalizedField(item, "dish");
      const description =
        getLocalizedField(item, "description") || t("Meals.noDescription");
      const diabeticText = `${t("Meals.diabeticFriendlyLabel")} ${
        item.diabeticFriendly
          ? t("Meals.diabeticFriendlyYes")
          : t("Meals.diabeticFriendlyNo")
      }`;

      const sentences = [];
      const pushSentence = (value) => {
        const text = (value || "").toString().trim();
        if (!text) return;
        sentences.push(text.replace(/[.?!]+$/u, ""));
      };

      pushSentence(dish);
      pushSentence(description);
      pushSentence(diabeticText);

      const allergens = trAllergens(item.allergens || []).join(", ");
      if (allergens) {
        pushSentence(`${t("Meals.LegendHeadings.Allergens")}: ${allergens}`);
      }

      return sentences.length ? `${sentences.join(". ")}.` : "";
    },
    [getLocalizedField, trAllergens, t]
  );

  const backToList = () => {
    setMeal(null);
    setManualCode("");
    setError("");
    setActiveBarcode("");
    stopSpeaking();
  };

  /* ---------- render ---------- */
  return (
    <div className="p-4 max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-800">
        {t("Meals.FoodInfo")}
      </h1>

      {loading && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {t("Meals.loadingLabel")}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
      )}

      {/* SCANNER / MANUAL */}
      {!meal && (
        <div className="mb-6">
          <div className="mb-4 flex">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={t("Meals.enterBarcodePlaceholder")}
              className="flex-1 px-4 py-3 rounded-l-lg border border-gray-300 bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
            <button
              onClick={handleManualSubmit}
              className="px-4 py-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"
            >
              {t("Meals.enterButton")}
            </button>
          </div>

          {scanning ? (
            <>
              <div className="relative mb-4">
                <div className="border-4 border-blue-400 dark:border-yellow-400 rounded-lg overflow-hidden">
                  <BarcodeScannerComponent
                    width="100%"
                    height={350}
                    onUpdate={handleDetected}
                    delay={300}
                    facingMode="environment"
                    videoConstraints={{
                      width: { ideal: 1280 },
                      height: { ideal: 720 },
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/5 h-3/5 border-4 border-red-500 border-dashed rounded opacity-70" />
                  </div>
                </div>
              </div>
              <button
                onClick={toggleScanner}
                className="w-full flex items-center justify-center px-6 py-5 rounded-lg bg-red-500 text-white text-2xl font-bold"
              >
                <span className="mr-3 text-3xl">📷</span>
                {t("Meals.stopCamera")}
              </button>
            </>
          ) : (
            <button
              onClick={toggleScanner}
              className="w-full flex items-center justify-center px-6 py-5 rounded-lg bg-green-500 text-white text-2xl font-bold"
            >
              <span className="mr-3 text-3xl">📷</span>
              {t("Meals.startCamera")}
            </button>
          )}
        </div>
      )}

      {/* SINGLE MEAL VIEW */}
      {meal && (
        <div className="bg-green-50 p-8 mt-8 rounded-lg border-l-8 border-green-500 shadow-lg dark:border-yellow-400 dark:bg-slate-700">
          {meal.imageURL && (
            <img
              src={`${API}${meal.imageURL}`}
              alt={getLocalizedField(meal, "dish")}
              className="w-full max-w-md mx-auto rounded-lg shadow-md mb-6"
            />
          )}

          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">
                {getLocalizedField(meal, "dish")}
              </h2>
              <p className="text-gray-600 text-xl mb-4 dark:text-white">
                {t("Meals.barcodeLabel")} {meal.barcode}
              </p>
            </div>

            {speaking ? (
              <button
                onClick={stopSpeaking}
                className="flex items-center px-5 py-3 rounded-lg bg-yellow-500 text-white"
              >
                <span className="mr-2 text-2xl">🔇</span>
                {t("Meals.SpeakingLabel")}
              </button>
            ) : (
              <button
                onClick={() => speakText(createFoodDescription(meal))}
                className="flex items-center px-5 py-3 rounded-lg bg-green-600 text-white"
              >
                <span className="mr-2 text-2xl">🔊</span>
                {t("Exercise.read")}
              </button>
            )}
          </div>

          <div className="my-6">
            <h3 className="text-2xl font-semibold mb-3">
              {t("Exercise.descriptionLabel")}
            </h3>
            <p className="text-xl leading-relaxed">
              {getLocalizedField(meal, "description") ||
                t("Meals.noDescription")}
            </p>
          </div>

          {/* 🧠 Allergy alert section (localized) */}
          {(() => {
            if (!user) return null;
            const overlap = (meal.allergens || []).filter((a) =>
              (userAllergens || []).includes(a)
            );
            return overlap.length ? (
              <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded mb-6">
                <p className="font-semibold mb-2">{t("Meals.allergyWarning")}</p>
                <ul className="list-disc list-inside text-lg">
                  {overlap.map((key) => (
                    <li key={key}>
                      {t(`Meals.Legend.Allergens.${key.toLowerCase()}`, key)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })()}

          {/* 🧠 Allergen list section */}
          {meal.allergens?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-2xl font-semibold mb-3">
                {t("Meals.LegendHeadings.Allergens")}
              </h3>
              <ul className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm dark:bg-slate-900">
                {meal.allergens.map((a, i) => (
                  <li
                    key={i}
                    className="py-3 text-xl border-b border-gray-100 last:border-0 flex items-center"
                  >
                    {t(`Meals.Legend.Allergens.${a.toLowerCase()}`, a)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <button
              onClick={backToList}
              className="px-6 py-3 bg-blue-600 text-white text-xl font-semibold rounded-lg hover:bg-blue-700"
            >
              {t("Meals.back")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
