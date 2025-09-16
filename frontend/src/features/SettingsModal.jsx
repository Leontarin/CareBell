// CareBell/src/features/SettingsModal.jsx
import React, { useEffect, useState, useContext } from "react";
import {
  FaVolumeMute,
  FaVolumeUp,
  FaRunning,
  FaTachometerAlt
} from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { AppContext } from "../shared/AppContext";
import { API } from "../shared/config";

export default function SettingsModal({ onClose }) {
  const { t, i18n } = useTranslation();
  const { user, setUser, darkMode, setDarkMode } = useContext(AppContext);

  const [scale, setScale] = useState(parseFloat(localStorage.getItem("fontScale")) || 1);
  const [activeTab, setActiveTab] = useState("general");
  const [selectedAllergens, setSelectedAllergens] = useState(user?.Allergens || []);
  const [diabetic, setDiabetic] = useState(user?.Diabetic || false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error'

  useEffect(() => {
    setSelectedAllergens(user?.Allergens || []);
    setDiabetic(user?.Diabetic || false);
  }, [user]);

  // 1) Load & persist font scale
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * scale}px`;
    localStorage.setItem("fontScale", scale);
  }, [scale]);

  // 2) Change language
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("i18nextLng", lng);
  };

  const allergens = t("Meals.Legend.Allergens", { returnObjects: true });
  const allergenKeys = Object.keys(allergens);

  const toggleAllergen = key => {
    setSelectedAllergens(prev =>
      prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]
    );
  };

  const saveHealth = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // <-- important (session cookie)
        body: JSON.stringify({ Allergens: selectedAllergens, Diabetic: diabetic })
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setSaveStatus("success");
      } else {
        setSaveStatus("error");
      }
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Error saving health info", err);
      setSaveStatus("error");
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
    setUser(null);  // App gate will show Login screen
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="w-[90%] max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 relative flex flex-col md:flex-row">
        <div className="w-full md:w-32 md:pr-4 border-b md:border-b-0 md:border-r border-gray-300 dark:border-gray-600 shrink-0">
          <h2 className="text-3xl font-bold text-blue-800 dark:text-blue-200 mb-6">
            {t("SettingsModal.title")}
          </h2>
          <nav className="flex md:flex-col flex-row gap-2 justify-center">
            <button
              onClick={() => setActiveTab("general")}
              className={`px-3 py-2 rounded ${activeTab === "general" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}
            >
              {t("SettingsModal.general")}
            </button>
            <button
              onClick={() => setActiveTab("health")}
              className={`px-3 py-2 rounded ${activeTab === "health" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}
            >
              {t("SettingsModal.health")}
            </button>
          </nav>
        </div>

        <div className="flex-1 md:pl-6 overflow-y-auto">
          {activeTab === "general" && (
            <>
              {/* TEXT SIZE */}
              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-3">
                  {t("SettingsModal.textSize")}
                </h3>
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-bold">A</span>
                  <input
                    type="range"
                    min={0.8}
                    max={1.6}
                    step={0.05}
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-600 h-2 rounded-lg bg-gray-300"
                  />
                  <span className="text-5xl font-bold">A</span>
                </div>
              </section>

              {/* VOLUME (placeholder / disabled) */}
              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-3">
                  {t("SettingsModal.volume")}
                </h3>
                <div className="flex items-center gap-4">
                  <FaVolumeMute className="text-2xl" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    defaultValue={70}
                    className="flex-1 accent-blue-600 h-2 rounded-lg bg-gray-300"
                    disabled
                  />
                  <FaVolumeUp className="text-2xl" />
                </div>
              </section>

              {/* SPEAKING SPEED (placeholder / disabled) */}
              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-3">
                  {t("SettingsModal.speakingSpeed")}
                </h3>
                <div className="flex items-center gap-4">
                  <FaTachometerAlt className="text-2xl" />
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    defaultValue={1}
                    className="flex-1 accent-blue-600 h-2 rounded-lg bg-gray-300"
                    disabled
                  />
                  <FaRunning className="text-2xl" />
                </div>
              </section>

              {/* LANGUAGE */}
              <section className="mb-8">
                <div className="flex items-start gap-12">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      {t("SettingsModal.language")}
                    </h3>
                    <select
                      value={i18n.language}
                      onChange={(e) => changeLanguage(e.target.value)}
                      className="border rounded px-2 py-1 border-teal-400 dark:bg-blue-900 dark:hover:bg-blue-800"
                    >
                      <option value="en">English</option>
                      <option value="he">עברית</option>
                      <option value="de">Deutsch</option>
                      <option value="fi">Suomi</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* DARK MODE */}
              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-3">
                  {t("SettingsModal.darkMode")}
                </h3>
                <label className="relative inline-block w-14 h-8 cursor-pointer">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={darkMode}
                    onChange={e => setDarkMode(e.target.checked)}
                  />
                  <div className="absolute inset-0 bg-gray-200 peer-checked:bg-blue-600 rounded-full transition-colors duration-300"></div>
                  <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-300 peer-checked:translate-x-[26px]"></div>
                  <div className="absolute top-1 left-1 text-xl transition-opacity duration-300 peer-checked:opacity-0">🌞</div>
                  <div className="absolute top-1 left-[26px] text-xl transition-opacity duration-300 opacity-0 peer-checked:opacity-100">🌙</div>
                </label>
              </section>

              <div className="flex flex-col md:flex-row justify-between mt-4 gap-2">
                <button
                  onClick={onClose}
                  className="bg-gray-400 hover:bg-gray-300 dark:bg-teal-700 dark:hover:bg-teal-600 px-4 py-2 rounded text-white"
                >
                  {t("SettingsModal.close")}
                </button>

                {/* 🔴 Logout button (bottom-right) */}
                <button
                  onClick={logout}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
                >
                  Logout
                </button>
              </div>
            </>
          )}

          {activeTab === "health" && (
            <>
              <section className="mb-6">
                <h3 className="text-xl font-semibold mb-3">
                  {t("SettingsModal.health")}
                </h3>
                <div className="relative mb-4">
                  <button
                    onClick={() => setDropdownOpen(o => !o)}
                    className="border rounded px-2 py-1 w-full text-left"
                  >
                    {t("SettingsModal.allergens")}
                  </button>
                  {dropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 border rounded p-2 bg-white dark:bg-gray-700 max-h-40 overflow-y-auto z-10">
                      {allergenKeys.map(key => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedAllergens.includes(key)}
                            onChange={() => toggleAllergen(key)}
                          />
                          {t(`Meals.Legend.Allergens.${key}`)}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 block">
                  <input
                    type="checkbox"
                    checked={diabetic}
                    onChange={e => setDiabetic(e.target.checked)}
                  />
                  {t("SettingsModal.diabetic")}
                </label>

                {saveStatus === "success" && (
                  <p className="mt-2 text-black">{t("SettingsModal.saveSuccess")}</p>
                )}
                {saveStatus === "error" && (
                  <p className="mt-2 text-black">{t("SettingsModal.saveError")}</p>
                )}

                <div className="flex flex-col md:flex-row justify-between mt-4 gap-2">
                  <button
                    onClick={onClose}
                    className="bg-gray-400 hover:bg-gray-300 dark:bg-teal-700 dark:hover:bg-teal-600 px-4 py-2 rounded text-white"
                  >
                    {t("SettingsModal.close")}
                  </button>
                  <button
                    onClick={saveHealth}
                    className="bg-blue-600 hover:bg-blue-500 dark:bg-blue-800 dark:hover:bg-blue-700 text-white px-4 py-2 rounded"
                  >
                    {t("SettingsModal.save")}
                  </button>
                </div>

                {/* Logout also accessible here if you want */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={logout}
                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
                  >
                    Logout
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}