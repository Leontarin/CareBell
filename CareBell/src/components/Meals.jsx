// src/components/Meals.jsx
import React, { useState, useEffect } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { API } from "../config";
import { useTranslation } from "react-i18next";

export default function Meals() {
  const { t } = useTranslation();

  /* ---------- state ---------- */
  const [activeTab,     setActiveTab]     = useState("list");
  const [allMeals,      setAllMeals]      = useState([]);
  const [filteredMeals, setFilteredMeals] = useState([]);
  const [searchTerm,    setSearchTerm]    = useState("");
  const [scanning,      setScanning]      = useState(false);
  const [barcode,       setBarcode]       = useState(null);
  const [meal,          setMeal]          = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [speaking,      setSpeaking]      = useState(false);

  /* ---------- effects ---------- */
  useEffect(() => {
    fetchAllMeals();
    // … speech-voice setup (unchanged) …
  }, []);

  useEffect(() => () => window.speechSynthesis.cancel(), []);

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
      setFilteredMeals(data);
    } catch (err) {
      setError(`Could not load meals: ${err.message}`);
      setAllMeals([]); setFilteredMeals([]);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- search ---------- */
  const handleSearch = e => {
    const term = e.target.value;
    setSearchTerm(term);
    if (!term.trim()) return setFilteredMeals(allMeals);
    const lower = term.toLowerCase();
    setFilteredMeals(
      allMeals.filter(m =>
        m.Dish.toLowerCase().includes(lower) ||
        (m.Description || "").toLowerCase().includes(lower)
      )
    );
  };

  /* ---------- speech ---------- */
  const toggleScanner = () => {
    setScanning(s => !s);
    if (!scanning) speakText(t("Meals.positionLabel"));
  };

  const speakText = text => {
    stopSpeaking();
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.8; u.pitch = 1; u.volume = 1;
    // … choose voice …
    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const createFoodDescription = item => {
    let desc = `${t("Meals.FoodInfo")}: ${item.Dish}. `;
    desc += `${item.Description || t("Meals.noDescription")}. `;
    desc += item.diabetic_friendly
      ? `${t("Meals.diabeticFriendlyYes")}. `
      : `${t("Meals.diabeticFriendlyNo")}. `;

    const extras = [
      ...trAllergens(item.Allergens),
      ...trAdditives(item.Additives),
      ...trPictograms(item.Pictograms)
    ];
    if (extras.length) desc += `${t("Meals.includesLabel")} ${extras.join(", ")}.`;
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
  const backToList = () => { setMeal(null); setActiveTab("list"); };

  /* ===================================================== */
  /* ====================  RENDER  ======================== */
  /* ===================================================== */
  return (
    <div className="p-4 max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-800">
        {t("Meals.FoodInfo")}
      </h1>

      {/* -------- tabs -------- */}
      <div className="flex mb-8">
        {["list","scanner"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-4 text-2xl font-bold ${
              tab==="list"?"rounded-tl-lg rounded-bl-lg":
              "rounded-tr-lg rounded-br-lg"
            } ${
              activeTab===tab
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {t(tab==="list" ? "Meals.FoodList" : "Meals.scanBarcode")}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------- */
      /* SCANNER TAB */
      /* ---------------------------------------------------- */}
      {activeTab==="scanner" && !meal && (
        <div className="mb-6">
          <button
            onClick={toggleScanner}
            className={`w-full flex items-center justify-center px-6 py-5 rounded-lg text-2xl font-bold mb-6 ${
              scanning ? "bg-red-500" : "bg-green-500"
            } text-white`}
          >
            <span className="mr-3 text-3xl">📷</span>
            {t(scanning ? "Meals.stopCamera" : "Meals.startCamera")}
          </button>

          {scanning && (
            <div className="relative mb-8">
              <div className="border-4 border-blue-400 rounded-lg overflow-hidden">
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
      /* LIST TAB */
      /* ---------------------------------------------------- */}
      {activeTab==="list" && !meal && (
        <div>
          {/* search */}
          <div className="mb-6">
            <div className="relative">
              <input
                className="w-full px-5 py-4 text-xl border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                value={searchTerm}
                onChange={handleSearch}
                placeholder={t("Meals.searchPlaceholder")}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-500">
                🔍
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-6 text-gray-800">
            {t("Meals.availableFoodsLabel")}
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500" />
            </div>
          ) : filteredMeals.length===0 ? (
            <p className="text-xl text-center py-8 text-gray-500">
              {t(searchTerm ? "Meals.noMatch" : "Meals.noFoods")}
            </p>
          ) : (
            <ul className="space-y-6">
              {filteredMeals.map(food => (
                <li
                  key={food._id}
                  className="border border-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <img
                        src={food.imageURL}
                        alt={food.Dish}
                        onError={e=>e.target.src="https://via.placeholder.com/300x200?text=Food+Image"}
                        className="w-full h-48 md:h-full object-cover"
                      />
                    </div>

                    <div className="md:col-span-2 p-5">
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-t-md -mx-5 -mt-5">
                        <h3 className="text-2xl font-bold">{food.Dish}</h3>
                        <p className="text-gray-500 mt-1">
                          {t("Meals.barcodeLabel")} {food.barcode}
                        </p>
                      </div>

                      <div className="mt-4">
                        <p className="text-lg text-gray-700 mb-4 line-clamp-2">
                          {food.Description || t("Meals.noDescription")}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={()=>selectMeal(food)}
                            className="w-full sm:w-15 px-3 py-1 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700"
                          >
                            {t("Exercise.viewDetails")}
                          </button>

                          {speaking ? (
                            <button
                              onClick={stopSpeaking}
                              className="w-full sm:w-auto flex items-center justify-center px-5 py-3 rounded-lg bg-yellow-500 text-white"
                            >
                              <span className="mr-2 text-xl">🔇</span>
                              {t("Meals.SpeakingLabel")}
                            </button>
                          ) : (
                            <button
                              onClick={()=>speakText(createFoodDescription(food))}
                              className="w-full sm:w-15 flex items-center justify-center px-3 py-1 rounded-lg bg-green-600 text-white"
                            >
                              <span className="mr-2 text-xl">🔊</span>
                              {t("Exercise.read")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---------- error ---------- */}
      {error && (
        <div className="bg-red-100 border-l-8 border-red-600 text-red-700 p-6 rounded-lg mb-6 text-xl">
          <h3 className="font-bold text-2xl mb-2">{t("Error")}</h3>
          <p>{error}</p>
        </div>
      )}

      {/* ---------------------------------------------------- */
      /* SINGLE MEAL VIEW */
      /* ---------------------------------------------------- */}
      {meal && (
        <div className="bg-green-50 p-8 mt-8 rounded-lg border-l-8 border-green-500 shadow-lg">
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
              <p className="text-gray-600 text-xl mb-4">
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
            const sections = [
              { key:"Allergens",  items:trAllergens(meal.Allergens)  },
              { key:"Additives",  items:trAdditives(meal.Additives)  },
              { key:"Pictograms", items:trPictograms(meal.Pictograms) }
            ];
            return sections.map(sec =>
              sec.items.length>0 && (
                <div key={sec.key} className="mt-6">
                  <h3 className="text-2xl font-semibold mb-3">
                    {t(`Meals.LegendHeadings.${sec.key}`)}
                  </h3>
                  <ul className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm">
                    {sec.items.map((txt,i)=>(
                      <li
                        key={i}
                        className="py-3 text-xl border-b border-gray-100 last:border-0 flex items-center"
                      >
                        <span className="mr-3 text-green-500 text-2xl">✓</span>
                        {txt}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            );
          })()}

          {/* back btn */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={backToList}
              className="px-6 py-3 bg-blue-600 text-white text-xl font-semibold rounded-lg hover:bg-blue-700"
            >
              {t("Meals.backToList")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
