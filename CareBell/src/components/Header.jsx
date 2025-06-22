// src/components/Header.jsx

import React, { useEffect, useState, useContext } from "react";
import logo from "../resources/Logo_Gold_Blau_Rubik.png";
import { Link } from "react-router-dom";
import SettingsModal from "./SettingsModal";
import Calendar from "../features/Calendar";
import { AppContext } from "../shared/AppContext";
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
      <header className="flex justify-between items-center py-4 px-4 border-b border-blue-900 mb-4 bg-slate-200 dark:bg-gray-800 dark:border-yellow-300">
        {/* Date / Time / Weather */}
        <div className="flex items-center space-x-6 text-blue-900 dark:text-blue-200">
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold">{dateStr}</span>
            <span className="text-xl font-bold">{timeStr}</span>
          </div>

          {geoErr ? (
            <span className="text-sm text-red-600">{geoErr}</span>
          ) : icon && temp != null ? (
            <div className="flex items-center space-x-2">
              <img
                src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
                alt={desc}
                className="h-10 w-10"
              />
              <div className="flex flex-col">
                <span className="text-base capitalize">{desc}</span>
                <span className="text-2xl font-bold">{temp}°C</span>
              </div>
            </div>
          ) : wErr ? (
            <span className="text-sm text-red-600">{wErr}</span>
          ) : (
            <span className="text-sm text-gray-600 dark:text-gray-300">{t("Header.LoadingWeather")}</span>
          )}
        </div>

        {/* Logo */}
        <Link to="/">
          <img
            src={logo}
            alt="CareBells Logo"
            className="h-16 cursor-pointer dark:bg-gradien"
          />
        </Link>

        {/* Controls */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCalendarOpen(o => !o)}
            className="bg-blue-900 text-yellow-200 p-3 rounded-full hover:bg-blue-800"
          >
            📅
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="bg-blue-900 text-yellow-200 p-3 rounded-full hover:bg-blue-800"
          >
            ⚙️
          </button>
          <button className="bg-red-500 text-white py-2 px-4 rounded-xl dark:bg-red-600">
            {t("Header.Emergency")}
          </button>
        </div>
      </header>

      {showSettings  && <SettingsModal  onClose={() => setShowSettings(false)} />}
      {calendarOpen && <Calendar     onClose={() => setCalendarOpen(false)} userId={user?.id} />}
    </>
  );
}
