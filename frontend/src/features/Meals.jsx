import React, { useState, useEffect, useContext } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { API } from "../shared/config";
import { useTranslation } from "react-i18next";
import { AppContext } from "../shared/AppContext";
import { playTts } from "../shared/tts";
import { isUserAllergic } from "../../../shared/constants/foodMeta.utils.js";

export default function Meals() {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AppContext);
  const userAllergens = user?.allergens || [];

  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [barcode, setBarcode] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [audioObj, setAudioObj] = useState(null);

  // ────────────────────────────────
  //  Fetch today's meals once on mount
  // ────────────────────────────────
  useEffect(() => {
    fetchTodayMeals();
  }, []);

  const fetchTodayMeals = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/foods/today`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setTodayMeals(data);
    } catch (err) {
      setError(t("Meals.errorLoading", { message: err.message }));
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────
  //  Barcode lookup
  // ────────────────────────────────
  const fetchByBarcode = async (code) => {
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
  };

  // ────────────────────────────────
  //  Scanner + manual input handlers
  // ────────────────────────────────
  const handleDetected = (_, result) => {
    if (!result) return;
    setScanning(false);
    fetchByBarcode(result.text);
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    fetchByBarcode(manualCode.trim());
  };

  const backToList = () => {
    setSelectedMeal(null);
    setManualCode("");
    setBarcode(null);
    stopSpeaking();
  };

  // ────────────────────────────────
  //  TTS helpers
  // ────────────────────────────────
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

  const buildDescription = (meal) => {
    let text = `${meal.dish}. ${meal.description || t("Meals.noDescription")}. `;
    text += `${meal.diabeticFriendly ? t("Meals.diabeticFriendlyYes") : t("Meals.diabeticFriendlyNo")}. `;
    if (meal.allergens?.length) {
      text += t("Meals.LegendHeadings.Allergens") + ": " +
        meal.allergens.map((a) => t(`Meals.Meta.Allergens.${a}`)).join(", ") + ". ";
    }
    if (meal.pictograms?.length) {
      text += t("Meals.LegendHeadings.Pictograms") + ": " +
        meal.pictograms.map((p) => t(`Meals.Meta.Pictograms.${p}`)).join(", ") + ".";
    }
    return text;
  };

  // ────────────────────────────────
  //  Meal tab component
  // ────────────────────────────────
  const renderMealTab = (meal) => {
    const allergic = isUserAllergic(userAllergens, meal.allergens).any;
    const tabColor = allergic
      ? "bg-red-100 dark:bg-red-300 text-black"
      : "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100";

    return (
      <div
        key={meal.id}
        className={`flex items-center border rounded-lg p-4 mb-3 cursor-pointer shadow-sm hover:shadow-md transition ${tabColor}`}
        onClick={() => setSelectedMeal(meal)}
      >
        <div className="w-24 h-24 mr-4 flex-shrink-0">
          <img
            src={`${API}/foods/${meal.id}/image`}
            alt={meal.dish}
            className="w-full h-full object-cover rounded-lg"
            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
          />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-1">{meal.dish}</h3>
          <p className="text-sm mb-2">{meal.description}</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {(meal.pictograms || []).map((p) => (
              <span
                key={p}
                className="text-2xl"
                title={t(`Meals.Meta.Pictograms.${p}`)}
              >
                {p}
              </span>
            ))}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              speakText(buildDescription(meal));
            }}
            className="flex items-center gap-2 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            🔊 {t("Exercise.read", "Read")}
          </button>
        </div>
        {allergic && (
          <div
            className="ml-4 text-red-700 text-2xl"
            title={t("Meals.allergyWarningShort", "Allergy Warning!")}
          >
            ⚠️
          </div>
        )}
      </div>
    );
  };

  // ────────────────────────────────
  //  Main render
  // ────────────────────────────────
  return (
    <div className="p-4 max-w-4xl mx-auto text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-center">
        {t("Meals.title", "Today's Meals")}
      </h1>

      {/* Scanner & Manual Entry */}
      {!selectedMeal && (
        <div className="mb-8">
          <div className="flex mb-4">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={t(
                "Meals.enterBarcodePlaceholder",
                "Enter barcode..."
              )}
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
      )}

      {/* Meals List */}
      {!selectedMeal && (
        <div>
          {loading ? (
            <p>{t("Meals.loadingLabel", "Loading...")}</p>
          ) : todayMeals.length === 0 ? (
            <p>{t("Meals.noMealsToday", "No meals available today.")}</p>
          ) : (
            todayMeals.map((meal) => renderMealTab(meal))
          )}
        </div>
      )}

      {/* Single Meal View */}
      {selectedMeal && (
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <img
            src={`${API}/foods/${selectedMeal.id}/image`}
            alt={selectedMeal.dish}
            className="w-full max-w-md mx-auto rounded-lg mb-4"
          />
          <h2 className="text-2xl font-bold mb-2">{selectedMeal.dish}</h2>
          <p className="text-lg mb-3">{selectedMeal.description}</p>

          <button
            onClick={() => speakText(buildDescription(selectedMeal))}
            className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔊 {t("Exercise.read", "Read")}
          </button>

          <h3 className="font-semibold text-xl mb-2">
            {t("Meals.allergens", "Allergens")}
          </h3>
          <ul className="list-disc ml-6 mb-4">
            {(selectedMeal.allergens || []).map((a) => (
              <li key={a}>{t(`Meals.Meta.Allergens.${a}`)}</li>
            ))}
          </ul>

          <h3 className="font-semibold text-xl mb-2">
            {t("Meals.pictograms", "Pictograms")}
          </h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {(selectedMeal.pictograms || []).map((p) => (
              <span
                key={p}
                className="text-3xl"
                title={t(`Meals.Meta.Pictograms.${p}`)}
              >
                {p}
              </span>
            ))}
          </div>

          <button
            onClick={backToList}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t("Meals.back", "Back")}
          </button>
        </div>
      )}
    </div>
  );
}

/* 
──────────────────────────────
Translation keys used/added:
──────────────────────────────
Meals.title                → "Today's Meals"
Meals.noMealsToday         → "No meals available today."
Meals.allergyWarningShort  → "Allergy Warning!"
Meals.errorLoading         → "Error loading meals: {{message}}"
*/
