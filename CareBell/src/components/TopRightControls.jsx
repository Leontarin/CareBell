// src/components/TopRightControls.jsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function TopRightControls() {
  const { t, i18n } = useTranslation();

  const [dark, setDark] = useState(localStorage.getItem("darkMode") === "true");
  const [lang, setLang] = useState(
    i18n.language || localStorage.getItem("i18nextLng") || "en"
  );

  // Apply dark mode class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("darkMode", String(dark));
  }, [dark]);

  // Keep local state in sync if i18n changes elsewhere
  useEffect(() => {
    setLang(i18n.language);
  }, [i18n.language]);

  const changeLanguage = (lng) => {
    setLang(lng);
    i18n.changeLanguage(lng);
    localStorage.setItem("i18nextLng", lng);
  };

  // Visible text = current state (clear for everyone)
  const currentModeText = dark
    ? t("SettingsModal.darkOn", { defaultValue: "Dark mode: On" })
    : t("SettingsModal.darkOff", { defaultValue: "Dark mode: Off" });

  // Tooltip/aria = next action
  const nextModeText = dark
    ? t("SettingsModal.switchToLight", { defaultValue: "Switch to light mode" })
    : t("SettingsModal.switchToDark", { defaultValue: "Switch to dark mode" });

  return (
    <div className="absolute top-3 right-3 md:top-4 md:right-4 flex items-center gap-3 z-10">
      {/* Language */}
      <label className="flex items-center gap-2 bg-white dark:bg-gray-800 backdrop-blur px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-700 dark:text-gray-200">
          {t("SettingsModal.language", { defaultValue: "Language" })}
        </span>
        <select
          value={lang}
          onChange={(e) => changeLanguage(e.target.value)}
          className="
            text-sm rounded-md px-2 py-1
            bg-white text-gray-800
            dark:bg-gray-800 dark:text-gray-100
            outline-none
            [color-scheme:light] dark:[color-scheme:dark]
          "
        >
          <option value="en">English</option>
          <option value="he">עברית</option>
          <option value="de">Deutsch</option>
          <option value="fi">Suomi</option>
        </select>
      </label>

      {/* Dark mode toggle (emoji switch + state label) */}
      <div className="flex items-center">
        <label
          className="relative inline-block w-14 h-8 cursor-pointer select-none"
          title={nextModeText}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={dark}
            onChange={(e) => setDark(e.target.checked)}
            aria-label={nextModeText}
          />
          {/* Track */}
          <div className="absolute inset-0 rounded-full bg-gray-200 dark:bg-gray-600 peer-checked:bg-blue-600 transition-colors duration-300"></div>
          {/* Knob */}
          <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-300 peer-checked:translate-x-[26px]"></div>
          {/* Emojis */}
          <div className="absolute top-1 left-1 text-xl transition-opacity duration-300 peer-checked:opacity-0">
            🌞
          </div>
          <div className="absolute top-1 left-[26px] text-xl opacity-0 transition-opacity duration-300 peer-checked:opacity-100">
            🌙
          </div>
        </label>

        {/* Current state text */}
        <span className="ml-2 text-sm text-gray-700 dark:text-gray-200">
          {currentModeText}
        </span>
      </div>
    </div>
  );
}
