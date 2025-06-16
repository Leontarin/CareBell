// src/components/Header.jsx

import React, { useEffect, useState, useContext } from "react";
import logo from "../resources/Logo_Gold_Blau_Rubik.png";
import { Link } from "react-router-dom";
import SettingsModal from "./SettingsModal";
import Calendar from "./Calendar";
import { AppContext } from "../AppContext";
import { useTranslation } from "react-i18next";

const OPENWEATHER_KEY = "6d3ad80f32ae07a071aeb542a0049d46";
const WEATHER_API     = "https://api.openweathermap.org/data/2.5/weather";

export default function Header() {
  const { t, i18n } = useTranslation();
  const { user }    = useContext(AppContext);

  /* ---- Date & Time ---- */
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");

  /* ---- Geolocation coords ---- */
  const [coords, setCoords] = useState(null);
  const [geoErr, setGeoErr] = useState(null);

  /* ---- Weather ---- */
  const [temp, setTemp] = useState(null);
  const [icon, setIcon] = useState(null);
  const [desc, setDesc] = useState("");
  const [wErr, setWErr] = useState(null);

  /* ---- UI state ---- */
  const [showSettings, setShowSettings] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // 1) Update date/time whenever locale changes
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setDateStr(
        now.toLocaleDateString(i18n.language, {
          weekday: "long",
          month:   "long",
          day:     "numeric",
        })
      );
      setTimeStr(
        now.toLocaleTimeString(i18n.language, {
          hour:   "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [i18n.language]);

  // 2) Grab geolocation once on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoErr("Geo unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setCoords(pos.coords),
      err => setGeoErr(err.message),
      { timeout: 5000 }
    );
  }, []);

  // 3) Fetch weather whenever coords OR i18n.language change
  useEffect(() => {
    if (!coords) return;
    const { latitude, longitude } = coords;
    const url =
      `${WEATHER_API}` +
      `?lat=${latitude}` +
      `&lon=${longitude}` +
      `&units=metric` +
      `&lang=${i18n.language}` +           // ← re-fetch description in new locale
      `&appid=${OPENWEATHER_KEY}`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.cod !== 200) throw new Error(data.message);
        setTemp(Math.round(data.main.temp));
        setIcon(data.weather[0].icon);
        setDesc(data.weather[0].description);
        setWErr(null);
      })
      .catch(err => setWErr(err.message));
  }, [coords, i18n.language]);

return (
  <>
    <header className="flex justify-between items-center py-3 px-4 border-b-4 border-blue-900 mb-4 bg-gradient-to-r from-blue-50 to-blue-100 shadow-xl">
      {/* Simplified Date / Time / Weather for tablet */}
      <div className="flex items-center space-x-4 text-blue-900">
        <div className="bg-white rounded-xl p-2 shadow-lg border border-blue-200">
          <div className="flex items-center space-x-2">
            <div className="text-sm">📅</div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold">{dateStr.split(',')[0]}</span>
              <span className="text-lg font-bold text-blue-600">{timeStr}</span>
            </div>
          </div>
        </div>

        {/* Simplified Weather */}
        {icon && temp != null ? (
          <div className="bg-white rounded-xl p-2 shadow-lg border border-blue-200">
            <div className="flex items-center space-x-2">
              <img
                src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
                alt={desc}
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-blue-600">{temp}°C</span>
            </div>
          </div>
        ) : geoErr ? (
          <div className="bg-red-100 rounded-xl p-2 shadow-lg border border-red-300">
            <span className="text-sm font-semibold text-red-600">Weather unavailable</span>
          </div>
        ) : (
          <div className="bg-gray-100 rounded-xl p-2 shadow-lg border border-gray-300">
            <span className="text-sm font-semibold text-gray-600">Loading...</span>
          </div>
        )}
      </div>

      {/* Centered Logo - Smaller for tablet */}
      <Link to="/" className="transform hover:scale-105 transition-all duration-200">
        <div className="bg-white rounded-xl p-2 shadow-xl border-2 border-blue-300 hover:border-blue-500">
          <img
            src={logo}
            alt="CareBells Logo"
            className="h-12 cursor-pointer"
          />
        </div>
      </Link>

      {/* Compact Controls */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setCalendarOpen(o => !o)}
          className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-yellow-200 p-2 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200"
        >
          <span className="text-xl">📅</span>
        </button>
        
        <button
          onClick={() => setShowSettings(true)}
          className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-yellow-200 p-2 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200"
        >
          <span className="text-xl">⚙️</span>
        </button>
        
        <button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white py-2 px-4 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200">
          <span className="mr-1 text-sm">🚨</span>
          {t("Header.Emergency")}
        </button>
      </div>
    </header>

    {showSettings  && <SettingsModal  onClose={() => setShowSettings(false)} />}
    {calendarOpen && <Calendar     onClose={() => setCalendarOpen(false)} userId={user?.id} />}
  </>
);
}
