// src/components/Meals.jsx
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

  /* ---------- state ---------- */
  const [activeTab,     setActiveTab]     = useState("scanner");
  const [allMeals,      setAllMeals]      = useState([]);
  const [scanning,      setScanning]      = useState(false);
  const [barcode,       setBarcode]       = useState(null);
  const [meal,          setMeal]          = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [speaking,      setSpeaking]      = useState(false);
  const [audioObj,      setAudioObj]      = useState(null);

  /* ---------- effects ---------- */
  useEffect(() => {
    fetchAllMeals();
  }, []);

  useEffect(() => () => {
    if (audioObj) audioObj.pause();
  }, [audioObj]);

  /* ---------- locale helpers ---------- */
  const trAdditives  = codes => (codes || []).map(c => t(`Meals.Legend.Additives.${c}`));
  const trAllergens  = list  => (list  || []).map(a => t(`Meals.Legend.Allergens.${a}`));
  const trPictograms = codes => (codes || []).map(p => t(`Meals.Legend.Pictograms.${p}`));

  /* ---------- data ---------- */
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

  /* ---------- speech ---------- */
  const toggleScanner = () => {
    setScanning(s => !s);
    if (!scanning) speakText(t("Meals.positionLabel"));
  };

  const speakText = async text => {
    stopSpeaking();
    if (!text) return;
    try {
      const lang = i18n.language.split('-')[0];
      const audio = await playTts(text, lang);
      setAudioObj(audio);
      setSpeaking(true);
      audio.onended = () => {
        setSpeaking(false);
        setAudioObj(null);
      };
    } catch (err) {
      console.error('TTS error:', err);
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

  const createFoodDescription = item => {
    // 1. Meal Name + Description
    let desc = `${item.Dish}. ${item.Description || t("Meals.noDescription")}. `;
  
    // 2. It's [NOT] Diabetic Friendly
    desc += `It's ${item.diabetic_friendly ? "" : "NOT "}Diabetic Friendly. `;
  
    // 3. Allergens
    if (item.Allergens && item.Allergens.length) {
      const allergenList = trAllergens(item.Allergens).join(", ");
      desc += `Allergens: ${allergenList}. `;
    }
  
    // 4. Additives
    if (item.Additives && item.Additives.length) {
      const additiveList = trAdditives(item.Additives).join(", ");
      desc += `Additives: ${additiveList}. `;
    }
  
    // 5. Pictograms
    if (item.Pictograms && item.Pictograms.length) {
      const pictogramList = trPictograms(item.Pictograms).join(", ");
      desc += `${pictogramList}.`;
    }
  
    return desc;
  };

  /* ---------- QR ---------- */
  const handleDetected = async (err, result) => {
    if (err) return console.error(err);
    if (!result) return;
    const code = result.text;
    setScanning(false);
    setBarcode(code);
    setLoading(true);
    speakText(t("Meals.qrScanned"));
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
      const fallback = allMeals.find(m => m.barcode === code);
      if (fallback) {
        setMeal(fallback);
        setTimeout(() => speakText(createFoodDescription(fallback)), 1000);
      } else {
        setError(t("Meals.notFoundWithCode", { code }));
        setMeal(null);
        speakText(t("Meals.notFoundSpoken"));
      }
    } finally { setLoading(false); }
  };

  /* ---------- UI helpers ---------- */
  const selectMeal = m => {
    setMeal(m);
    setTimeout(() => speakText(createFoodDescription(m)), 500);
  };
  const backToList = () => { setMeal(null); setActiveTab("scanner"); };

  /* ===================================================== */
  /* ====================  RENDER  ======================== */
  /* ===================================================== */
  return (
    <div className="p-4 max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg dark:border-yellow-400">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-800 dark:border-yellow-400">
        {t("Meals.FoodInfo")}
      </h1>

      {/* ---------------------------------------------------- */
      /* SCANNER TAB */
      /* ---------------------------------------------------- */}
      {activeTab==="scanner" && !meal && (
        <div className="mb-6">
          <button
            onClick={toggleScanner}
            className={`w-full flex items-center justify-center px-6 py-5 rounded-lg text-2xl font-bold mb-6 dark:border-yellow-400 ${
              scanning ? "bg-red-500" : "bg-green-500"
            } text-white`}
          >
            <span className="mr-3 text-3xl">📷</span>
            {t(scanning ? "Meals.stopCamera" : "Meals.startCamera")}
          </button>

          {scanning && (
            <div className="relative mb-8">
              <div className="border-4 border-blue-400 dark:border-yellow-400 rounded-lg overflow-hidden">
                <BarcodeScannerComponent
                  width="100%" height={350}
                  onUpdate={handleDetected}
                  delay={300}
                  facingMode="environment"
                  videoConstraints={{ width:{ideal:1280}, height:{ideal:720} }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/5 h-3/5 border-4 border-red-500 border-dashed rounded opacity-70" />
                </div>
              </div>
              <p className="text-center text-xl mt-4 text-gray-600 font-medium">
                {t("Meals.positionLabel")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */
      /* SINGLE MEAL VIEW */
      /* ---------------------------------------------------- */}
      {meal && (
        <div className="bg-green-50 p-8 mt-8 rounded-lg border-l-8 border-green-500 shadow-lg dark:border-yellow-400 dark:bg-slate-700">
          {meal.imageURL && (
            <img
              src={meal.imageURL}
              alt={meal.Dish}
              onError={e=>e.target.style.display="none"}
              className="w-full max-w-md mx-auto rounded-lg shadow-md mb-6"
            />
          )}

          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">{meal.Dish}</h2>
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
                onClick={()=>speakText(createFoodDescription(meal))}
                className="flex items-center px-5 py-3 rounded-lg bg-green-600 text-white"
              >
                <span className="mr-2 text-2xl">🔊</span>
                {t("Exercise.read")}
              </button>
            )}
          </div>

          {/* description */}
          <div className="my-6">
            <h3 className="text-2xl font-semibold mb-3">
              {t("Exercise.descriptionLabel")}
            </h3>
            <p className="text-xl leading-relaxed">
              {meal.Description || t("Meals.noDescription")}
            </p>
          </div>

          {/* ====== ALLERGY WARNING ====== */}
          {(() => {
            if (!user) return null;
            const overlap = (meal.Allergens || []).filter(a =>
              userAllergens.includes(a)
            );
            return overlap.length > 0 ? (
              <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded mb-6">
                <p className="font-semibold mb-2">
                  {t("Meals.allergyWarning")}
                </p>
                <ul className="list-disc list-inside text-lg">
                  {overlap.map(key => (
                    <li key={key}>{t(`Meals.Legend.Allergens.${key}`)}</li>
                  ))}
                </ul>
              </div>
            ) : null;
          })()}

          {/* ====== DIABETIC FRIENDLY (always first) ====== */}
          <div className="mt-6">
            <h3 className="text-2xl font-semibold mb-1">
              {t("Meals.diabeticFriendlyLabel")}
            </h3>
            <p className="text-xl font-medium flex items-center">
              <span
                className={`mr-2 text-2xl ${
                  meal.diabetic_friendly ? "text-green-600" : "text-red-600"
                }`}
              >
                {meal.diabetic_friendly ? "✓" : "✕"}
              </span>
              {t(
                meal.diabetic_friendly
                  ? "Meals.diabeticFriendlyYes"
                  : "Meals.diabeticFriendlyNo"
              )}
            </p>
          </div>

          {/* ====== LEGEND SECTIONS ====== */}
          {(() => {
            const renderSection = (key, list, tr) =>
              list.length > 0 && (
                <div key={key} className="mt-6">
                  <h3 className="text-2xl font-semibold mb-3">
                    {t(`Meals.LegendHeadings.${key}`)}
                  </h3>
                  <ul className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm dark:bg-slate-900">
                    {list.map((val, i) => {
                      const allergic =
                        key === "Allergens" && userAllergens.includes(val);
                      return (
                        <li
                          key={i}
                          className="py-3 text-xl border-b border-gray-100 last:border-0 flex items-center"
                        >
                          <span
                            className={`mr-3 text-2xl ${
                              allergic ? "text-red-600" : "text-green-500"
                            }`}
                          >
                            {allergic ? "✕" : "✓"}
                          </span>
                          {tr(val)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            return (
              <>
                {renderSection(
                  "Allergens",
                  meal.Allergens || [],
                  a => t(`Meals.Legend.Allergens.${a}`)
                )}
                {renderSection(
                  "Additives",
                  meal.Additives || [],
                  a => t(`Meals.Legend.Additives.${a}`)
                )}
                {renderSection(
                  "Pictograms",
                  meal.Pictograms || [],
                  a => t(`Meals.Legend.Pictograms.${a}`)
                )}
              </>
            );
          })()}

          {/* back btn */}
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
