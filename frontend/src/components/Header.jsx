// src/components/Header.jsx
import React, { useEffect, useState, useContext } from "react";
import logo from "../resources/Logo_Gold_Blau_Rubik.png";
import { Link } from "react-router-dom";
import SettingsModal from "../features/SettingsModal";
import Calendar from "../features/Calendar";
import { AppContext } from "../shared/AppContext";
import { useTranslation } from "react-i18next";

const OPENWEATHER_KEY = "6d3ad80f32ae07a071aeb542a0049d46";
const WEATHER_API = "https://api.openweathermap.org/data/2.5/weather";

export default function Header() {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AppContext);

  /* ---- Date & Time ---- */
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");

  /* ---- Geolocation ---- */
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

  // Date + time updater
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setDateStr(
        now.toLocaleDateString(i18n.language, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      );
      setTimeStr(
        now.toLocaleTimeString(i18n.language, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [i18n.language]);

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoErr("Geo unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords(pos.coords),
      (err) => setGeoErr(err.message),
      { timeout: 10000 }
    );
  }, []);

  // Weather
  useEffect(() => {
    if (!coords) return;
    const { latitude, longitude } = coords;
    const url =
      `${WEATHER_API}?lat=${latitude}&lon=${longitude}` +
      `&units=metric&lang=${i18n.language}&appid=${OPENWEATHER_KEY}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.cod !== 200) throw new Error(data.message);
        setTemp(Math.round(data.main.temp));
        setIcon(data.weather[0].icon);
        setDesc(data.weather[0].description);
        setWErr(null);
      })
      .catch((err) => setWErr(err.message));
  }, [coords, i18n.language]);

  return (
    <>
      {/* ------------------------------------------------------ */}
      {/* 📱 PHONE HEADER — Responsive version (NO date/time)    */}
      {/* ------------------------------------------------------ */}
      <header className="w-full md:hidden
          px-4 py-3
          mb-6              /* <-- added spacing below header */
          bg-slate-200 dark:bg-gray-800
          border-b border-blue-900 dark:border-yellow-300
          rounded-md">

        {/* Logo */}
        <Link to="/" className="flex justify-center w-full mb-2">
          <img src={logo} alt="CareBell Logo" className="h-16 rounded-md" />
        </Link>

        {/* Row of buttons */}
        <div className="flex items-center justify-between w-full">
          {/* Temperature */}
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 text-2xl font-bold">
            {temp !== null ? `${temp}°C` : "…"}
          </div>

          <button
            onClick={() => setCalendarOpen((o) => !o)}
            className="bg-blue-900 text-yellow-200 p-3 rounded-2xl text-2xl shadow-md"
          >
            📅
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="bg-blue-900 text-yellow-200 p-3 rounded-2xl text-2xl shadow-md"
          >
            ⚙️
          </button>

          <button className="bg-red-600 text-white px-4 py-2 rounded-2xl text-lg font-bold shadow-md">
            {t("Header.Emergency")}
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------ */}
      {/* 💻 DESKTOP + TABLET HEADER — Original version (#2)     */}
      {/* ------------------------------------------------------ */}
      <header className="hidden md:flex justify-between items-center py-4 px-4 border-b border-blue-900 mb-4 bg-slate-300 rounded-md dark:bg-gray-800 dark:border-yellow-300">

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
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {t("Header.LoadingWeather")}
            </span>
          )}
        </div>

        {/* Logo */}
        <Link to="/">
          <img src={logo} alt="CareBell Logo" className="h-16 cursor-pointer" />
        </Link>

        {/* Controls */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCalendarOpen((o) => !o)}
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
          
        </div>
      </header>

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {calendarOpen && <Calendar onClose={() => setCalendarOpen(false)} userId={user?.id} />}
    </>
  );
}
