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

  const [scale, setScale] = useState(
    parseFloat(localStorage.getItem("fontScale")) || 1
  );
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // 1. Load and persist font scale
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * scale}px`;
    localStorage.setItem("fontScale", scale);
  }, [scale]);

  // 2. Load all users for the combobox
  useEffect(() => {
    fetch(`${API}/users/`)
      .then(res => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then(data => setUsers(data))
      .catch(err => console.error("Error loading users:", err))
      .finally(() => setLoadingUsers(false));
  }, []);

  // 3. Change language
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("i18nextLng", lng);
  };

  // 4. Change current user
  const changeUser = (e) => {
    const selectedId = e.target.value;
    const selected = users.find(u => String(u.id) === selectedId);
    if (selected) setUser(selected);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="w-[95%] max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-2xl text-gray-600 hover:text-gray-800 dark:text-gray-300"
        >
          ×
        </button>

        <h2 className="text-3xl font-bold text-blue-800 dark:text-blue-200 mb-8">
          {t("SettingsModal.title")}
        </h2>

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
              max={100}
              defaultValue={70}
              className="flex-1 accent-blue-600 h-2 rounded-lg bg-gray-300"
              disabled
            />
            <FaVolumeUp className="text-2xl" />
          </div>
        </section>

        {/* SPEAKING SPEED */}
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

        {/* LANGUAGE & USER SELECTORS */}
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
                className="border rounded px-2 py-1 border-teal-400 dark:bg-blue-900 dark:hover:bg-blue-800"
              >
                <option value="en">English</option>
                <option value="he">עברית</option>
                <option value="de">Deutsch</option>
                <option value="fi">Suomi</option>
              </select>
            </div>

            {/* User Combobox */}
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {t("SettingsModal.User")}
              </h3>

              {loadingUsers ? (
                <p className="text-gray-600 dark:text-gray-300 ">{t("SettingsModal.loading")}</p>
              ) : (
                <select
                  value={user?.id || ""}
                  onChange={changeUser}
                  className="border rounded px-2 py-1 border-teal-400 dark:bg-blue-900 dark:hover:bg-blue-800"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.fullName || u.id}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </section>

        {/* DARK MODE */}
        <section className="mb-8">
          <h3 className="text-xl font-semibold mb-3">
            {t("SettingsModal.darkMode")}
          </h3>
          <label className="inline-flex items-center cursor-pointer">
            <span className="mr-3 text-lg">{darkMode ? "On" : "Off"}</span>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className="sr-only peer"
            />
            <div
              className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:bg-blue-600"
            ></div>
          </label>
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
