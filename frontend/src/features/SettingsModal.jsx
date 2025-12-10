//backend/src/features/SettingsModal.jsx
import React, { useEffect, useState, useContext, useMemo } from "react";
import {
  FaVolumeMute,
  FaVolumeUp,
  FaRunning,
  FaTachometerAlt,
  FaUserShield,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppContext } from "../shared/AppContext";
import { API } from "../shared/config";
import MetaEditorModal from "../components/MetaEditorModal";
import {PICTOGRAMS,ALLERGENS,ADDITIVES} from "../../../shared/constants/foodMeta.js";

export default function SettingsModal({ onClose }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser, darkMode, setDarkMode, bellaVolume, setBellaVolume } = useContext(AppContext);

  const [scale, setScale] = useState(parseFloat(localStorage.getItem("fontScale")) || 1);
  const [activeTab, setActiveTab] = useState("general");
  const [saveStatus, setSaveStatus] = useState(null);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [languageError, setLanguageError] = useState(null);

  /** ─────────────────────────── Health flags ─────────────────────────── **/
  // Dynamically get available pictogram keys from i18n
  const pictograms = t("Meals.Legend.Pictograms", { returnObjects: true });
  const allergenKeys = Object.keys(pictograms || {});
  const [healthFlags, setHealthFlags] = useState(
    allergenKeys.reduce((acc, k) => ({ ...acc, [k]: !!user?.[k] }), {})
  );
  const [diabetic, setDiabetic] = useState(!!user?.Diabetic);
  const [isMetaModalOpen, setMetaModalOpen] = useState(false);
  // Keep sync when user or language changes (so new translations reload)
  useEffect(() => {
    setHealthFlags(allergenKeys.reduce((acc, k) => ({ ...acc, [k]: !!user?.[k] }), {}));
    setDiabetic(!!user?.Diabetic);
  }, [user, i18n.language]);
  //Keep volume in sync
  useEffect(() => {
    const audioEls = document.querySelectorAll("audio");
    audioEls.forEach(a => { a.volume = bellaVolume; });
  }, [bellaVolume]);

  /** ─────────────────────────── Language logic ─────────────────────────── **/
  const LANGUAGE_LABELS = useMemo(
    () => ({
      en: "English",
      he: "עברית",
      de: "Deutsch",
      fi: "Suomi",
    }),
    []
  );

  const availableLanguages = useMemo(() => {
    if (user?.languages?.length) {
      const seen = new Set();
      return user.languages.filter((code) => {
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
      });
    }
    return Object.keys(LANGUAGE_LABELS);
  }, [LANGUAGE_LABELS, user]);

  const languageLabel = (code) => LANGUAGE_LABELS[code] || code;

  /** ─────────────────────────── Font scale ─────────────────────────── **/
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * scale}px`;
    localStorage.setItem("fontScale", scale);
  }, [scale]);

  /** ─────────────────────────── Language change ─────────────────────────── **/
  const changeLanguage = async (lng) => {
    if (!lng || lng === i18n.language) return;
    setLanguageError(null);
    const prev = i18n.language;
    let resetSpinner = false;

    try {
      await i18n.changeLanguage(lng);
      localStorage.setItem("i18nextLng", lng);
      if (!user?.id) return;

      setLanguageSaving(true);
      resetSpinner = true;
      const res = await fetch(`${API}/users/${user.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lng }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to update language");
      }
      const updated = await res.json();
      setUser(updated);
    } catch (err) {
      console.error("Failed to change language", err);
      setLanguageError(err?.message || "Failed to update language");
      await i18n.changeLanguage(prev).catch(() => {});
      localStorage.setItem("i18nextLng", prev);
    } finally {
      if (resetSpinner) setLanguageSaving(false);
    }
  };

  // ─────────────────────────── Health Fetch ───────────────────────────
const fetchHealth = async (payload) => {
  if (!user) return;
  try {
    const res = await fetch(`${API}/users/${user.id}/health`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Health update failed (${res.status})`);

    const updated = await res.json();
    setUser(updated);
    console.log("✅ Health updated:", updated);
    return updated;
  } catch (err) {
    console.error("❌ fetchHealth error:", err);
    throw err;
  }
};

  /** ─────────────────────────── Health toggle/save ─────────────────────────── **/
  const toggleFlag = (key) =>
    setHealthFlags((prev) => ({ ...prev, [key]: !prev[key] }));

  const saveHealth = async () => {
    try {
      await fetchHealth({ ...healthFlags, Diabetic: diabetic });
      setSaveStatus("success");
    } catch {
      setSaveStatus("error");
    } finally {
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  /** ─────────────────────────── Logout ─────────────────────────── **/
  const logout = async () => {
    try {
      await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
    setUser(null);
    onClose?.();
  };

  /** ─────────────────────────── UI ─────────────────────────── **/
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="w-[90%] max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 relative flex flex-col md:flex-row">
        {/* Sidebar */}
        <div
          className="w-full md:w-auto md:min-w-[10rem] md:max-w-[16rem] md:pr-4 border-b md:border-b-0 md:border-r border-gray-300 dark:border-gray-600 flex-shrink-0"
        >
          <h2 className="text-3xl font-bold text-blue-800 dark:text-blue-200 mb-6 break-words text-center md:text-left leading-tight">
            {t("SettingsModal.title")}
          </h2>

          <nav className="flex flex-wrap md:flex-col gap-2 justify-center md:justify-start items-stretch">
            {["general", "health"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 rounded text-center transition-colors duration-200 whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                {t(`SettingsModal.${tab}`)}
              </button>
            ))}

            {user?.isAdmin && (
              <button
                onClick={() => {
                  onClose?.();
                  navigate("/admin");
                }}
                className="px-3 py-2 rounded bg-yellow-500 hover:bg-yellow-400 text-white flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <FaUserShield className="flex-shrink-0" />
                <span>{t("SettingsModal.admin", "Admin")}</span>
              </button>
            )}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 md:pl-6 overflow-y-auto">
          {/* ─────────── GENERAL TAB ─────────── */}
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

              {/* VOLUME */}
              <section className="mb-8">
                <h3 className="text-xl font-semibold mb-3">
                  {t("SettingsModal.volume")}
                </h3>

                <div className="flex items-center gap-4">
                  <FaVolumeMute className="text-2xl" />

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={bellaVolume}
                    onChange={(e) => setBellaVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-600 h-2 rounded-lg bg-gray-300"
                  />

                  <FaVolumeUp className="text-2xl" />

                  {/* show volume percent */}
                  <span className="text-sm font-medium w-12 text-right">
                    {Math.round(bellaVolume * 100)}%
                  </span>
                </div>
              </section>

              {/* SPEAKING SPEED (placeholder) */}
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
                <h3 className="text-xl font-semibold mb-2">
                  {t("SettingsModal.language")}
                </h3>
                <select
                  value={i18n.language}
                  onChange={(e) => changeLanguage(e.target.value)}
                  className="border rounded px-2 py-1 border-teal-400 dark:bg-blue-900 dark:hover:bg-blue-800"
                  disabled={languageSaving}
                >
                  {availableLanguages.map((code) => (
                    <option key={code} value={code}>
                      {languageLabel(code)}
                    </option>
                  ))}
                </select>
                {languageError && (
                  <p className="mt-2 text-sm text-red-600">{languageError}</p>
                )}
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
                    onChange={(e) => setDarkMode(e.target.checked)}
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
                <button
                  onClick={logout}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
                >
                  <span>{t("SettingsModal.logout", "Logout")}</span>
                </button>
              </div>
            </>
          )}

          {/* ─────────── HEALTH TAB ─────────── */}
          {activeTab === "health" && (
            <section className="mb-6">
              <h3 className="text-xl font-semibold mb-3">
                {t("SettingsModal.health")}
              </h3>

              {/* ─────────── HEALTH SUMMARY ─────────── */}
              <section className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-semibold">{t("SettingsModal.health")}</h3>
                  <button
                    onClick={() => setMetaModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
                  >
                    {t("Meals.MetaEditor.title")}
                  </button>
                </div>

                {/* ───── Pictograms Display ───── */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {PICTOGRAMS.filter(p => user?.pictograms?.includes(p.key)).map((p) => (
                    <div
                      key={p.key}
                      className="w-10 h-10 flex flex-col items-center justify-center text-xs font-semibold border border-gray-400 dark:border-gray-600 rounded-md"
                      title={t(p.tKey, p.label)}
                    >
                      <span className="text-lg leading-none">{p.icon}</span>
                      <span className="leading-none">{p.key}</span>
                    </div>
                  ))}
                </div>

                {/* ───── Allergens Chips ───── */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {(user?.allergens || []).map((code) => {
                    const allergen = ALLERGENS.find(a => a.code === code);
                    return (
                      <span
                        key={code}
                        className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 border border-blue-300 dark:border-blue-700"
                      >
                        {t(allergen?.tKey || `Meals.Meta.Allergens.${code}`, allergen?.label || code)}
                      </span>
                    );
                  })}
                  {(!user?.allergens || user.allergens.length === 0) && (
                    <span className="text-gray-500 text-sm">
                      {t("Meals.MetaEditor.noAllergens", "No allergens selected")}
                    </span>
                  )}
                </div>

                {/* ───── Diabetic Info ───── */}
                <div className="text-sm font-medium">
                  {t("Meals.MetaEditor.diabetic")}:{" "}
                  <span
                    className={
                      user?.Diabetic
                        ? "text-red-600 dark:text-red-400 font-semibold"
                        : "text-green-600 dark:text-green-400 font-semibold"
                    }
                  >
                    {user?.Diabetic
                      ? t("Meals.MetaEditor.isDiabetic")
                      : t("Meals.MetaEditor.notDiabetic")}
                  </span>
                </div>

                {/* MetaEditorModal */}
                <MetaEditorModal
                  isOpen={isMetaModalOpen}
                  onClose={() => setMetaModalOpen(false)}
                  onSave={async (data) => {
                    try {
                      await fetchHealth({
                        allergens: data.allergens,
                        pictograms: data.pictograms,
                        Diabetic: data.diabetic,
                      });
                      setMetaModalOpen(false);
                    } catch (err) {
                      console.error("❌ Failed to save health info:", err);
                    }
                  }}
                  allergens={user?.allergens || []}
                  additives={user?.additives || []}
                  pictograms={user?.pictograms || []}
                  diabetic={user?.Diabetic ?? false}
                  showDiabetic={true}
                  editableDiabetic={true}
                />
              </section>
              <div className="flex flex-col md:flex-row justify-between mt-6 gap-2">
                <button
                  onClick={onClose}
                  className="bg-gray-400 hover:bg-gray-300 dark:bg-teal-700 dark:hover:bg-teal-600 px-4 py-2 rounded text-white"
                >
                  {t("SettingsModal.close")}
                </button>
                <button
                  onClick={logout}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
                >
                  <span>{t("SettingsModal.logout", "Logout")}</span>
                </button>
              </div>
            </section>
            
          )}
        </div>
      </div>
    </div>
  );
}
