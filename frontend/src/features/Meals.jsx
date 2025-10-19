// frontend/src/features/Meals.jsx
import React, { useState, useEffect, useContext } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { API } from "../shared/config";
import { useTranslation } from "react-i18next";
import { playTts } from "../shared/tts";
import { AppContext } from "../shared/AppContext";

export default function Meals() {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AppContext);
  const userAllergens = user?.Allergens || [];

  const [activeTab, setActiveTab] = useState("scanner");
  const [allMeals, setAllMeals] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [barcode, setBarcode] = useState(null);
  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [audioObj, setAudioObj] = useState(null);

  /* ---------- effects ---------- */
  useEffect(() => {
    fetchAllMeals();
  }, []);
  useEffect(() => () => { if (audioObj) audioObj.pause(); }, [audioObj]);

  /* ---------- fetch helpers ---------- */
  const fetchAllMeals = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/foods`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid data format");
      setAllMeals(data);
    } catch (err) {
      setError(`Could not load meals: ${err.message}`);
      setAllMeals([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchByCode = async (code) => {
    setBarcode(code);
    setLoading(true);
    try {
      const res = await fetch(`${API}/${code}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("404");
        throw new Error(`Server ${res.status}`);
      }
      const data = await res.json();
      setMeal(data);
      setTimeout(() => speakText(createFoodDescription(data)), 1000);
    } catch {
      const fallback = allMeals.find((m) => m.barcode === code);
      if (fallback) {
        setMeal(fallback);
        setTimeout(() => speakText(createFoodDescription(fallback)), 1000);
      } else {
        setError(t("Meals.notFoundWithCode", { code }));
        setMeal(null);
        speakText(t("Meals.notFoundSpoken"));
      }
    } finally {
      setLoading(false);
    }
  };

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

  const speakText = async (text) => {
    stopSpeaking();
    if (!text) return;
    try {
      const lang = i18n.language.split("-")[0];
      const audio = await playTts(text, lang);
      setAudioObj(audio);
      setSpeaking(true);
      audio.onended = () => {
        setSpeaking(false);
        setAudioObj(null);
      };
    } catch (err) {
      console.error("TTS error:", err);
    }
  };

  const stopSpeaking = () => {
    if (audioObj) {
      audioObj.pause();
      audioObj.currentTime = 0;
      setAudioObj(null);
    }
    setSpeaking(false);
  };

  /* ---------- helpers ---------- */
  const getLocalizedField = (meal, field) => {
    const lang = i18n.language.split("-")[0];
    return (
      meal.translations?.[lang]?.[field] ||
      meal.translations?.en?.[field] ||
      meal[field] ||
      ""
    );
  };

  const trAllergens = (list) =>
    (list || []).map((a) => {
      const key = a.toLowerCase();
      return t(`Meals.Legend.Allergens.${key}`, key);
    });

  const createFoodDescription = (item) => {
    const dish = getLocalizedField(item, "dish");
    const description = getLocalizedField(item, "description");
    const diabeticText = item.diabeticFriendly
      ? t("Meals.diabeticFriendlyYes")
      : t("Meals.diabeticFriendlyNo");

    // build text for TTS — now uses localized allergen names
    let desc = `${dish}. <break time='300ms'/> ${description || t("Meals.noDescription")}. <break time='300ms'/> `;
    desc += `${diabeticText}. `;

    const allergens = trAllergens(item.allergens || []).join(", ");
    if (allergens) {
      desc += `<break time='300ms'/> ${t("Meals.allergensList")} ${allergens}. `;
    }
    return desc;
  };

  const backToList = () => {
    setMeal(null);
    setManualCode("");
    setError("");
    setActiveTab("scanner");
  };

  /* ---------- render ---------- */
  return (
    <div className="p-4 max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-800">
        {t("Meals.FoodInfo")}
      </h1>

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
          {meal.id && (
            <img
              src={`${API}/foods/${meal.id}/image`}
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
