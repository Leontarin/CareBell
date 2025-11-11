// frontend/src/features/Meals.jsx
import React, { useState, useEffect, useContext } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { API } from "../shared/config";
import { useTranslation } from "react-i18next";
import { AppContext } from "../shared/AppContext";
import { playTts } from "../shared/tts";
import {
  PICTO_BY_KEY,
  PICTOGRAM_ORDER,
  derivePictogramsFromAllergens,
  isUserAllergic,
} from "../../../shared/constants/foodMeta.utils.js";

export default function Meals() {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AppContext);
  const userAllergens = user?.allergens || [];

  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [audioObj, setAudioObj] = useState(null);

  useEffect(() => {
    fetchTodayMeals();
  }, []);

  async function fetchTodayMeals() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/foods/today`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setTodayMeals(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(t("Meals.errorLoading", { message: err.message }));
    } finally {
      setLoading(false);
    }
  }

  async function fetchByBarcode(code) {
    try {
      setLoading(true);
      const res = await fetch(`${API}/foods/barcode/${code}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setSelectedMeal(data);
    } catch (err) {
      setError(t("Meals.notFoundWithCode", { code }));
    } finally {
      setLoading(false);
    }
  }

  const handleDetected = (_, result) => {
    if (result?.text) {
      setScanning(false);
      fetchByBarcode(result.text);
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) fetchByBarcode(manualCode.trim());
  };

  const stopSpeaking = () => {
    if (audioObj) {
      audioObj.pause();
      audioObj.currentTime = 0;
      setAudioObj(null);
    }
    setSpeaking(false);
  };

  const speakText = async (text) => {
    stopSpeaking();
    if (!text) return;
    try {
      const lang = i18n.language.split("-")[0];
      const audio = await playTts(text, lang);
      setAudioObj(audio);
      setSpeaking(true);
      audio.onended = () => setSpeaking(false);
    } catch (err) {
      console.error("TTS error:", err);
    }
  };

  const backToList = () => {
    setSelectedMeal(null);
    setManualCode("");
    stopSpeaking();
  };

  // Compose visible text only for the current meal
  const buildVisibleText = (meal) => {
    const pictos = meal.pictograms || [];
    const allergens = meal.allergens || [];
    let text = `${meal.dish}. ${meal.description || t("Meals.noDescription")}. `;
    text += `${meal.diabeticFriendly
      ? t("Meals.diabeticFriendlyYes")
      : t("Meals.diabeticFriendlyNo")
    }. `;
    if (allergens.length)
      text +=
        t("Meals.LegendHeadings.Allergens") +
        ": " +
        allergens.join(", ") +
        ". ";
    if (pictos.length)
      text +=
        t("Meals.LegendHeadings.Pictograms") +
        ": " +
        pictos.join(", ") +
        ".";
    return text;
  };

  // ───────────────────────────────
  //  Render meal cards
  // ───────────────────────────────
  const renderMealCard = (meal) => {
    const allergic = isUserAllergic(userAllergens, meal.allergens).any;
    const tabColor = allergic
      ? "bg-red-100 dark:bg-red-300 text-black"
      : "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100";
    const pictos =
      meal.pictograms?.length > 0
        ? meal.pictograms
        : derivePictogramsFromAllergens(meal.allergens || []);

    return (
      <div
        key={meal.id}
        className={`border rounded-xl p-4 mb-4 shadow-sm hover:shadow-lg cursor-pointer transition ${tabColor}`}
        onClick={() => setSelectedMeal(meal)}
      >
        <div className="flex items-center gap-4">
          <img
            src={`${API}/foods/${meal.id}/image`}
            alt={meal.dish}
            className="w-24 h-24 object-cover rounded-lg border"
            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
          />
          <div className="flex-1">
            <h3 className="text-xl font-semibold">{meal.dish}</h3>
            <p className="text-sm mb-2 line-clamp-2">{meal.description}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {pictos
                .slice()
                .sort(
                  (a, b) =>
                    PICTOGRAM_ORDER.indexOf(a) - PICTOGRAM_ORDER.indexOf(b)
                )
                .map((key) => {
                  const p = PICTO_BY_KEY[key];
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-1 text-sm px-2 py-1 border rounded-md"
                      title={t(p?.tKey, p?.label || key)}
                    >
                      <span className="text-lg">{p?.icon || "❔"}</span>
                      <span>{p?.label || key}</span>
                    </div>
                  );
                })}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                speaking
                  ? stopSpeaking()
                  : speakText(buildVisibleText(meal));
              }}
              className={`flex items-center gap-2 px-3 py-1 rounded text-white text-sm ${
                speaking
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {speaking ? "⏹ Stop" : "🔊 " + t("Exercise.read", "Read")}
            </button>
          </div>
          {allergic && (
            <div
              className="text-red-700 text-3xl ml-3"
              title={t("Meals.allergyWarningShort", "Allergy Warning!")}
            >
              ⚠️
            </div>
          )}
        </div>
      </div>
    );
  };

  // ───────────────────────────────
  //  Render single meal (opened tab)
  // ───────────────────────────────
  const renderMealDetails = (meal) => {
    const pictos =
      meal.pictograms?.length > 0
        ? meal.pictograms
        : derivePictogramsFromAllergens(meal.allergens || []);
    const allergic = isUserAllergic(userAllergens, meal.allergens).any;

    return (
      <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-xl shadow-md">
        <img
          src={`${API}/foods/${meal.id}/image`}
          alt={meal.dish}
          className="w-full max-w-md mx-auto rounded-lg mb-4"
          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
        />
        <h2 className="text-3xl font-bold mb-2 text-center">{meal.dish}</h2>
        <p className="text-lg mb-4 text-center">{meal.description}</p>

        {allergic && (
          <p className="text-red-600 font-semibold text-center mb-4 text-xl">
            ⚠️ {t("Meals.allergyWarningShort", "Allergy Warning!")}
          </p>
        )}

        <div className="flex justify-center mb-4">
          <button
            onClick={() =>
              speaking ? stopSpeaking() : speakText(buildVisibleText(meal))
            }
            className={`flex items-center gap-2 px-4 py-2 rounded text-white ${
              speaking
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {speaking ? "⏹ Stop" : "🔊 " + t("Exercise.read", "Read")}
          </button>
        </div>

        {/* Pictograms */}
        <h3 className="text-xl font-semibold mb-2">
          {t("Meals.pictograms", "Pictograms")}
        </h3>
        <div className="flex flex-wrap gap-3 mb-4">
          {pictos
            .slice()
            .sort(
              (a, b) => PICTOGRAM_ORDER.indexOf(a) - PICTOGRAM_ORDER.indexOf(b)
            )
            .map((key) => {
              const p = PICTO_BY_KEY[key];
              return (
                <div
                  key={key}
                  className="flex flex-col items-center justify-center border rounded-lg px-3 py-2 bg-white dark:bg-gray-900"
                  title={t(p?.tKey, p?.label || key)}
                >
                  <span className="text-3xl mb-1">{p?.icon || "❔"}</span>
                  <span className="text-sm font-medium">
                    {t(p?.tKey, p?.label || key)}
                  </span>
                </div>
              );
            })}
        </div>

        {/* Allergens */}
        <h3 className="text-xl font-semibold mb-2">
          {t("Meals.allergens", "Allergens")}
        </h3>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
          {(meal.allergens || []).map((a) => (
            <li
              key={a}
              className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-gray-900 rounded border"
            >
              <span className="text-lg"></span>
              <span>{t(`Meals.Meta.Allergens.${a}`)}</span>
            </li>
          ))}
        </ul>

        <div className="text-center">
          <button
            onClick={backToList}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            {t("Meals.back", "Back")}
          </button>
        </div>
      </div>
    );
  };

  // ───────────────────────────────
  //  Main render
  // ───────────────────────────────
  return (
    <div className="p-4 max-w-5xl mx-auto text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-center">
        {t("Meals.title", "Today's Meals")}
      </h1>

      {!selectedMeal && (
        <>
          <div className="mb-6">
            <div className="flex mb-4">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={t("Meals.enterBarcodePlaceholder", "Enter barcode...")}
                className="flex-1 px-4 py-2 border rounded-l-lg bg-white dark:bg-gray-800"
              />
              <button
                onClick={handleManualSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"
              >
                {t("Meals.enterButton", "Enter")}
              </button>
            </div>

            {scanning ? (
              <>
                <BarcodeScannerComponent
                  width="100%"
                  height={250}
                  onUpdate={handleDetected}
                />
                <button
                  onClick={() => setScanning(false)}
                  className="mt-3 w-full py-3 bg-red-500 text-white rounded-lg"
                >
                  {t("Meals.stopCamera", "Stop Camera")}
                </button>
              </>
            ) : (
              <button
                onClick={() => setScanning(true)}
                className="w-full py-3 bg-green-600 text-white rounded-lg"
              >
                {t("Meals.startCamera", "Start Camera")}
              </button>
            )}
          </div>

          {loading ? (
            <p>{t("Meals.loadingLabel", "Loading...")}</p>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : todayMeals.length === 0 ? (
            <p>{t("Meals.noMealsToday", "No meals available today.")}</p>
          ) : (
            todayMeals.map((meal) => renderMealCard(meal))
          )}
        </>
      )}

      {selectedMeal && renderMealDetails(selectedMeal)}
    </div>
  );
}
