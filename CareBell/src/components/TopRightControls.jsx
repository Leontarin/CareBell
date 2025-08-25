// src/components/TopRightControls.jsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function TopRightControls() {
  const { t, i18n } = useTranslation();
  const [dark, setDark] = useState(localStorage.getItem("darkMode") === "true");
  const [lang, setLang] = useState(i18n.language || localStorage.getItem("i18nextLng") || "en");

  // apply dark mode to <html>
  useEffect(() => {
    const root = document.documentElement;
    dark ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("darkMode", String(dark));
  }, [dark]);

  // keep local state in sync if i18n changes elsewhere
  useEffect(() => {
    setLang(i18n.language);
  }, [i18n.language]);

  const changeLanguage = (lng) => {
    setLang(lng);
    i18n.changeLanguage(lng);
    localStorage.setItem("i18nextLng", lng);
  };

  return (
    <div className="absolute top-3 right-3 md:top-4 md:right-4 flex items-center gap-3 z-10">
      {/* Language */}
      <label className="flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-700 dark:text-gray-200">
          {t("SettingsModal.language", { defaultValue: "Language" })}
        </span>
        <select
          value={lang}
          onChange={(e) => changeLanguage(e.target.value)}
          className="text-sm bg-transparent outline-none dark:text-gray-100"
        >
          <option value="en">English</option>
          <option value="he">עברית</option>
          <option value="de">Deutsch</option>
          <option value="fi">Suomi</option>
        </select>
      </label>

      {/* Dark mode toggle */}
      <label className="relative inline-flex items-center cursor-pointer select-none">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={dark}
          onChange={(e) => setDark(e.target.checked)}
          aria-label={t("SettingsModal.darkMode", { defaultValue: "Dark Mode" })}
        />
        <div className="w-14 h-8 rounded-full bg-gray-300 peer-checked:bg-blue-600 transition-colors duration-300 relative">
          <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 peer-checked:translate-x-[26px]" />
        </div>
        <span className="ml-2 text-sm text-gray-700 dark:text-gray-200">
          {t("SettingsModal.darkMode", { defaultValue: "Dark Mode" })}
        </span>
      </label>
    </div>
  );
}
