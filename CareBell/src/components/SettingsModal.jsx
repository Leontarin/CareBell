import React, { useEffect, useState } from "react";
import { FaVolumeMute, FaVolumeUp, FaRunning, FaTachometerAlt } from "react-icons/fa";
import { useTranslation } from "react-i18next";

export default function SettingsModal({ onClose }) {
  const { t, i18n } = useTranslation();

  const [scale, setScale] = useState(
    parseFloat(localStorage.getItem("fontScale")) || 1
  );
  const [showLanguage, setShowLanguage] = useState(true);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * scale}px`;
    localStorage.setItem("fontScale", scale);
  }, [scale]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("i18nextLng", lng);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      {/* panel */}
      <div className="w-[95%] max-w-md bg-white rounded-3xl shadow-xl p-8 relative">
        {/* close X */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-2xl text-gray-600 hover:text-gray-800"
        >
          ×
        </button>

        {/* Title */}
        <h2 className="text-3xl font-bold text-blue-800 mb-8">
          {t("SettingsModal.title")}
        </h2>

        {/* -------- TEXT SIZE -------- */}
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

        {/* -------- VOLUME -------- */}
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
              disabled /* only for UI */
            />
            <FaVolumeUp className="text-2xl" />
          </div>
        </section>

        {/* -------- SPEAKING SPEED -------- */}
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
              disabled /* for the future */
            />
            <FaRunning className="text-2xl" />
          </div>
        </section>

       {/* -------- SETTINGS SELECTORS -------- */}
        <section className="mb-8">
          <div className="flex items-start gap-12">
            {/* Language Switcher */}
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {t("SettingsModal.language")}
              </h3>
              <select
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="en">English</option>
                <option value="he">עברית</option>
                <option value="de">Deutsch</option>
                <option value="fi">Suomi</option>
              </select>
            </div>

            {/* User Combobox (Debug) */}
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {t("SettingsModal.User")}
              </h3>
              <select className="border rounded px-2 py-1">
                <option value="user0">Alison</option>
                <option value="user1">Bob</option>
              </select>
            </div>
          </div>
        </section>



        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          {t("SettingsModal.close")}
        </button>
      </div>
    </div>
  );
}
