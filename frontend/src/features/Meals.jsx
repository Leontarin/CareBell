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
  formatAdditiveBubble,
  isDiabeticFriendly,
} from "../../../shared/constants/foodMeta.utils.js";

function getLocalized(food, lang) {
  const tmap = food?.translations || {};
  return (
    tmap[lang] ||
    tmap.en ||
    tmap[Object.keys(tmap)[0]] || {
      dish: food?.dish || "",
      description: food?.description || "",
      category: food?.category || "",
    }
  );
}

export default function Meals() {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AppContext);

  const userAllergens = user?.allergens || [];
  const userIsDiabetic =
    user?.Diabetic === true ||
    user?.Diabetic === "true" ||
    user?.isDiabetic === true ||
    user?.isDiabetic === "true" ||
    user?.healthProfile?.isDiabetic === true;

  const [view, setView] = useState("list");
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
      setError("");
      const res = await fetch(`${API}/foods/today`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setTodayMeals(Array.isArray(data) ? data : []);
      setView("list");
    } catch (err) {
      setError(t("Meals.errorLoading", { message: err.message }));
    } finally {
      setLoading(false);
    }
  }

  async function fetchByBarcode(code) {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API}/foods/barcode/${code}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setSelectedMeal(data);
      setView("details");
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

  const speakVisible = async (text) => {
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

  const buildVisibleText = (loc, pictos, allergens, additives, diabeticLabel) => {
    let text = `${loc.dish}. ${loc.description || ""}. `;
    if (pictos?.length)
      text +=
        t("Meals.LegendHeadings.Pictograms") +
        ": " +
        pictos
          .map((k) => PICTO_BY_KEY[k]?.label || k)
          .join(", ") +
        ". ";
    if (allergens?.length)
      text +=
        t("Meals.LegendHeadings.Allergens") + ": " + allergens.join(", ") + ". ";
    if (additives?.length)
      text +=
        t("Meals.LegendHeadings.Additives") +
        ": " +
        additives.join(", ") +
        ". ";
    text += diabeticLabel ? ` ${diabeticLabel}. ` : "";
    return text;
  };

  const imageSrc = (meal) => {
    if (meal?.imageURL) return meal.imageURL;
    if (meal?.id != null) return `${API}/foods/${meal.id}/image`;
    return "https://via.placeholder.com/120x120.png?text=No+Image";
  };

  // ────────────────────────────────
  //  MealCard
  // ────────────────────────────────
  const MealCard = ({ meal }) => {
    const loc = getLocalized(meal, i18n.language);
    const pictos =
      meal.pictograms?.length > 0
        ? meal.pictograms
        : derivePictogramsFromAllergens(meal.allergens || []);
    const allergicInfo = isUserAllergic(userAllergens, meal.allergens || []);
    const allergic = allergicInfo.any;
    const additives = meal.additives || [];

    const diabeticFriendly = meal.diabeticFriendly ?? isDiabeticFriendly(meal);
    const diabeticLabel = diabeticFriendly
      ? "✅ Diabetic Friendly"
      : "❌ Not Diabetic Friendly";

    // ✅ background logic: red if allergic OR user diabetic and not diabetic-friendly
    const bgClass =
      allergic || (userIsDiabetic && !diabeticFriendly)
        ? "bg-red-300 text-black"
        : "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100";

    const textToRead = buildVisibleText(
      loc,
      pictos,
      meal.allergens || [],
      additives,
      diabeticLabel
    );

    return (
      <button
        type="button"
        onClick={() => {
          stopSpeaking();
          setSelectedMeal(meal);
          setView("details");
        }}
        className={`w-full text-left border border-yellow-500 rounded-xl p-4 shadow-sm hover:shadow-lg transition ${bgClass}`}
      >
        <div className="flex items-center gap-4">
          <img
            src={imageSrc(meal)}
            alt={loc.dish}
            className="w-24 h-24 object-cover rounded-lg border"
          />

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-xl mb-1 truncate">{loc.dish}</div>

            {/* Diabetic label */}
            <div
              className={`text-sm font-semibold mb-2 ${
                allergic || (userIsDiabetic && !diabeticFriendly)
                  ? "text-black"
                  : diabeticFriendly
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {diabeticLabel}
            </div>
            {/* Pictograms */}
            <div className="flex flex-wrap gap-2 mb-1">
              {pictos
                .slice()
                .sort(
                  (a, b) =>
                    PICTOGRAM_ORDER.indexOf(a) - PICTOGRAM_ORDER.indexOf(b)
                )
                .map((key) => {
                  const p = PICTO_BY_KEY[key];
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-2 px-2 py-1 border rounded-md bg-gray-50"
                      title={t(p?.tKey, p?.label || key)}
                    >
                      <span className="text-base">{p?.icon || "❔"}</span>
                    </span>
                  );
                })}
            </div>

            {/* Additives */}
            <div className="flex flex-wrap gap-2">
              {additives.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-white dark:text-black text-lg"
                >
                  <span>{formatAdditiveBubble(n, t)}</span>
                </span>
              ))}
            </div>
          </div>

          {(allergic || (userIsDiabetic && !diabeticFriendly)) && (
            <div
              className="text-red-700 text-3xl ml-2"
              title={
                allergic
                  ? t("Meals.allergyWarningShort")
                  : t("Meals.diabeticWarningShort", "Not diabetic-friendly")
              }
            >
              ⚠️
            </div>
          )}
        </div>
      </button>
    );
  };

  // ────────────────────────────────
  //  DetailsView
  // ────────────────────────────────
  const DetailsView = () => {
    if (!selectedMeal) return null;

    const loc = getLocalized(selectedMeal, i18n.language);
    const pictos =
      selectedMeal.pictograms?.length > 0
        ? selectedMeal.pictograms
        : derivePictogramsFromAllergens(selectedMeal.allergens || []);
    const allergens = selectedMeal.allergens || [];
    const additives = selectedMeal.additives || [];
    const allergy = isUserAllergic(userAllergens, allergens);
    const matched = allergy.matched || [];
    const diabeticFriendly =
      selectedMeal.diabeticFriendly ?? isDiabeticFriendly(selectedMeal);
    const diabeticLabel = diabeticFriendly
      ? "✅ Diabetic Friendly"
      : "❌ Not Diabetic Friendly";

    const textToRead = buildVisibleText(
      loc,
      pictos,
      allergens,
      additives,
      diabeticLabel
    );

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => {
              stopSpeaking();
              setSelectedMeal(null);
              setView("list");
            }}
            className="px-6 py-2 rounded-lg border border-yellow-500 bg-blue-800 text-white text-lg shadow hover:bg-blue-600"
          >
            {t("Meals.backToList")}
          </button>
        </div>

        <img
          src={imageSrc(selectedMeal)}
          alt={loc.dish}
          className="w-full max-h-72 object-cover rounded-xl bg-gray-100"
        />

        <div className="text-center">
          <div className="text-2xl font-semibold">{loc.dish}</div>
          <p className="opacity-80 mt-1">{loc.description}</p>
        </div>

        {/* Diabetic friendly info */}
        <div
          className={`text-lg font-semibold text-center ${
            diabeticFriendly
              ? "text-green-700 dark:text-green-400"
              : "text-red-700 dark:text-red-400"
          }`}
        >
          {diabeticLabel}
        </div>

        {/* Allergy warning box */}
        {allergy.any && (
          <div className="p-3 rounded-xl bg-red-300  text-black">
            <div className="font-semibold mb-2 flex items-center gap-2">
              <span>⚠️</span>
              <span>
                {t(
                  "Meals.allergyWarning",
                  "You are allergic to the following in this meal:"
                )}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {matched.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white/90 border"
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full bg-red-600 text-white">
                    {code}
                  </span>
                  <span className="text-sm">
                    {t(`Meals.Meta.Allergens.${code}`, code)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* TTS button */}
        <div className="flex justify-center">
          <button
            onClick={() =>
              speaking ? stopSpeaking() : speakVisible(textToRead)
            }
            className={`flex items-center gap-2 px-5 py-2 rounded text-white text-lg ${
              speaking
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-800 hover:bg-blue-600"
            }`}
          >
            {speaking ? "⏹ Stop" : "🔊 " + t("Exercise.read", "Read")}
          </button>
        </div>

        {/* Pictograms */}
        {pictos.length > 0 && (
          <div>
            <div className="text-lg font-semibold mb-1">
              {t("Meals.LegendHeadings.Pictograms")}
            </div>
            <div className="flex flex-wrap gap-3">
              {pictos.map((k) => {
                const p = PICTO_BY_KEY[k];
                return (
                  <div
                    key={k}
                    className="flex flex-col items-center justify-center text-black border rounded-lg bg-gray-50 w-12 h-12 text-base shadow-sm"
                    title={t(p?.tKey, p?.label || k)}
                  >
                    <span className="text-base">{p?.icon || "❔"}</span>
                    <span className="text-xs font-semibold mt-0.5">{k}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Allergens */}
        {(allergens.length > 0 || allergy.any) && (
          <div>
            <div className="text-lg font-semibold mb-2">
              {allergy.any
                ? t("Meals.otherAllergens")
                : t("Meals.LegendHeadings.Allergens", "Allergens")}
            </div>
            <ul className="space-y-2">
              {(allergy.any
                ? allergens.filter((a) => !matched.includes(a))
                : allergens
              ).map((a) => (
                <li
                  key={a}
                  className="flex items-center gap-2 px-3 py-1 text-black bg-gray-200 rounded-md border border-gray-400 dark:border-gray-600 text-base"
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 text-base font-bold rounded-full bg-gray-900 text-white">
                    {a}
                  </span>
                  <span>{t(`Meals.Meta.Allergens.${a}`, a)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Additives */}
        {additives.length > 0 && (
          <div>
            <div className="text-lg font-semibold mb-1">
              {t("Meals.LegendHeadings.Additives")}
            </div>
            <div className="flex flex-wrap gap-2">
              {additives.map((n) => (
                <span
                  key={n}
                  className="inline-flex text-base items-center gap-2 px-2 py-1 bg-gray-200  rounded-md text-black"
                >
                  <span>{formatAdditiveBubble(n, t)}</span>
                  <span>{t(`Meals.Meta.Additives.${n}`, String(n))}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ────────────────────────────────
  //  ScanTab
  // ────────────────────────────────
  const ScanTab = () => (
    <div className="space-y-4">
      {!scanning && (
        <div className="flex justify-center">
          <button
            onClick={() => setView("list")}
            className="px-6 py-2 rounded-lg border border-yellow-500 bg-blue-800 text-white text-lg shadow hover:bg-blue-600"
          >
            {t("Meals.backToList")}
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          placeholder={t("Meals.enterBarcodePlaceholder")}
        />
        <button
          onClick={handleManualSubmit}
          className="px-5 py-2 rounded-lg border border-yellow-500 bg-blue-800 text-white text-lg shadow hover:bg-blue-600"
        >
          {t("Meals.enterButton", "Enter")}
        </button>
      </div>
      {!scanning ? (
        <button
          onClick={() => setScanning(true)}
          className="w-full py-3 text-lg bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          📷 {t("Meals.startCamera")}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700">
            <BarcodeScannerComponent
              width={"100%"}
              height={280}
              onUpdate={handleDetected}
            />
          </div>
          <button
            onClick={() => setScanning(false)}
            className="w-full py-3 text-lg bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            {t("Meals.stopCamera")}
          </button>
        </div>
      )}
    </div>
  );

  // ────────────────────────────────
  //  Main Render
  // ────────────────────────────────
  return (
    <div className="p-4 max-w-5xl mx-auto text-gray-900 dark:text-gray-100 space-y-6">
      {view === "list" && (
        <>
          <div className="flex justify-center mb-2">
            <h1 className="text-2xl font-bold text-center">
              {t("Meals.todaysMeals", "Today's Meals")}
            </h1>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => {
                setView("scan");
                setManualCode("");
                setScanning(false);
                stopSpeaking();
              }}
              className="px-6 py-3 w-3/4 text-xl border border-yellow-500 rounded-lg bg-blue-800 text-white shadow hover:bg-blue-600"
            >
              {t("Meals.scanMealManually")}
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-lg p-3 bg-yellow-100 text-yellow-900">{error}</div>
      )}

      {view === "scan" ? (
        <ScanTab />
      ) : view === "details" ? (
        <DetailsView />
      ) : loading ? (
        <div className="text-center opacity-70 text-lg">
          {t("Meals.loadingLabel")}
        </div>
      ) : todayMeals.length ? (
        todayMeals.map(
          (meal) =>
            meal && (
              <MealCard
                key={meal.id ?? meal.barcode ?? Math.random()}
                meal={meal}
              />
            )
        )
      ) : (
        <div className="text-center opacity-70 text-lg">
          {t("Meals.noFoods")}
        </div>
      )}
    </div>
  );
}
