import React, { useEffect, useState, useContext } from "react";
import {
  FaVolumeMute,
  FaVolumeUp,
  FaRunning,
  FaTachometerAlt
} from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { AppContext } from "../AppContext";
import { API } from "../config";

export default function SettingsModal({ onClose }) {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useContext(AppContext);

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
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="w-full max-w-5xl h-full max-h-[90vh] bg-white rounded-3xl shadow-2xl border-4 border-blue-200 relative overflow-hidden">
      {/* Enhanced Modal Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-2xl text-white hover:text-gray-200 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20 transition-all duration-200"
        >
          ✕
        </button>

        <h2 className="text-3xl font-bold flex items-center justify-center">
          <span className="mr-3 text-4xl">⚙️</span>
          {t("SettingsModal.title")}
        </h2>
      </div>

      <div className="h-full overflow-y-auto">
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enhanced TEXT SIZE */}
          <section className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200 h-fit">
            <h3 className="text-2xl font-bold mb-4 text-blue-900 flex items-center">
              <span className="mr-3 text-3xl">📝</span>
              {t("SettingsModal.textSize")}
            </h3>
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-xl p-3 shadow-lg border-2 border-blue-200">
                <span className="text-xl font-bold text-blue-900">A</span>
              </div>
              <input
                type="range"
                min={0.8}
                max={1.6}
                step={0.05}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-blue-600 h-3 rounded-lg bg-blue-200 cursor-pointer"
              />
              <div className="bg-white rounded-xl p-3 shadow-lg border-2 border-blue-200">
                <span className="text-3xl font-bold text-blue-900">A</span>
              </div>
            </div>
            <div className="mt-3 text-center">
              <span className="text-lg font-semibold text-blue-700 bg-white rounded-xl px-3 py-2 border-2 border-blue-200">
                Current size: {Math.round(scale * 100)}%
              </span>
            </div>
          </section>

          {/* Enhanced VOLUME */}
          <section className="bg-green-50 rounded-2xl p-6 border-2 border-green-200 h-fit">
            <h3 className="text-2xl font-bold mb-4 text-green-900 flex items-center">
              <span className="mr-3 text-3xl">🔊</span>
              {t("SettingsModal.volume")}
            </h3>
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-xl p-3 shadow-lg border-2 border-green-200">
                <FaVolumeMute className="text-2xl text-green-700" />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={70}
                className="flex-1 accent-green-600 h-3 rounded-lg bg-green-200 cursor-pointer"
                disabled
              />
              <div className="bg-white rounded-xl p-3 shadow-lg border-2 border-green-200">
                <FaVolumeUp className="text-2xl text-green-700" />
              </div>
            </div>
            <div className="mt-3 text-center">
              <span className="text-sm font-semibold text-green-700 bg-yellow-100 rounded-xl px-3 py-2 border-2 border-yellow-300">
                ⚠️ Feature coming soon
              </span>
            </div>
          </section>

          {/* Enhanced SPEAKING SPEED */}
          <section className="bg-purple-50 rounded-2xl p-6 border-2 border-purple-200 h-fit">
            <h3 className="text-2xl font-bold mb-4 text-purple-900 flex items-center">
              <span className="mr-3 text-3xl">🗣️</span>
              {t("SettingsModal.speakingSpeed")}
            </h3>
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-xl p-3 shadow-lg border-2 border-purple-200">
                <FaTachometerAlt className="text-2xl text-purple-700" />
              </div>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.1}
                defaultValue={1}
                className="flex-1 accent-purple-600 h-3 rounded-lg bg-purple-200 cursor-pointer"
                disabled
              />
              <div className="bg-white rounded-xl p-3 shadow-lg border-2 border-purple-200">
                <FaRunning className="text-2xl text-purple-700" />
              </div>
            </div>
            <div className="mt-3 text-center">
              <span className="text-sm font-semibold text-purple-700 bg-yellow-100 rounded-xl px-3 py-2 border-2 border-yellow-300">
                ⚠️ Feature coming soon
              </span>
            </div>
          </section>

          {/* Enhanced LANGUAGE & USER SELECTORS */}
          <section className="bg-orange-50 rounded-2xl p-6 border-2 border-orange-200 h-fit">
            <div className="space-y-4">
              {/* Enhanced Language Switcher */}
              <div className="bg-white rounded-xl p-4 shadow-lg border-2 border-orange-200">
                <h3 className="text-xl font-bold mb-3 text-orange-900 flex items-center">
                  <span className="mr-3 text-2xl">🌍</span>
                  {t("SettingsModal.language")}
                </h3>
                <select
                  value={i18n.language}
                  onChange={(e) => changeLanguage(e.target.value)}
                  className="w-full border-2 border-orange-300 focus:border-orange-600 focus:ring-4 focus:ring-orange-200 rounded-xl px-3 py-2 text-lg font-semibold shadow-lg transition-all duration-200"
                >
                  <option value="en">🇺🇸 English</option>
                  <option value="he">🇮🇱 עברית</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="fi">🇫🇮 Suomi</option>
                </select>
              </div>

              {/* Enhanced User Combobox */}
              <div className="bg-white rounded-xl p-4 shadow-lg border-2 border-orange-200">
                <h3 className="text-xl font-bold mb-3 text-orange-900 flex items-center">
                  <span className="mr-3 text-2xl">👤</span>
                  {t("SettingsModal.User")}
                </h3>

                {loadingUsers ? (
                  <div className="flex items-center justify-center py-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-500 border-t-transparent mr-2"></div>
                    <p className="text-lg text-orange-700 font-semibold">{t("SettingsModal.loading")}</p>
                  </div>
                ) : (
                  <select
                    value={user?.id || ""}
                    onChange={changeUser}
                    className="w-full border-2 border-orange-300 focus:border-orange-600 focus:ring-4 focus:ring-orange-200 rounded-xl px-3 py-2 text-lg font-semibold shadow-lg transition-all duration-200"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        👤 {u.name || u.fullName || u.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Enhanced Footer */}
        <div className="bg-gray-50 border-t-2 border-gray-200 p-6 sticky bottom-0">
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xl font-bold rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
            >
              <span className="mr-3 text-2xl">✅</span>
              {t("SettingsModal.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
