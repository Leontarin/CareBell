import React, { useEffect, useState, useContext } from "react";
import logo from "../resources/Logo_Gold_Blau_Rubik.png";
import { Link } from "react-router-dom";
import SettingsModal from "./SettingsModal";
import Calendar from "./Calendar";        // import your new Calendar component
import axios from "axios";
import { AppContext } from "../AppContext";
import { useTranslation } from "react-i18next";

const OPENWEATHER_KEY = "6d3ad80f32ae07a071aeb542a0049d46";
const WEATHER_API = "https://api.openweathermap.org/data/2.5/weather";


export default function Header() {
  /* ---- Translation ---- */
  const { t } = useTranslation();
  /* ---- Date / Time ---- */
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");

  /* ---- Weather (current) ---- */
  const [temp, setTemp] = useState(null);
  const [icon, setIcon] = useState(null);
  const [wErr, setWErr] = useState(null);

  /* ---- Settings modal ---- */
  const [showSettings, setShowSettings] = useState(false);

  /* ---- Calendar toggle ---- */
  const [calendarOpen, setCalendarOpen] = useState(false);

  /* ---- Current user from context ---- */
  const { user } = useContext(AppContext);
  const userId = user?.id;

  // clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setDateStr(
        now.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      );
      setTimeStr(
        now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // current weather
  useEffect(() => {
    if (!navigator.geolocation) {
      setWErr("Geo unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const url = `${WEATHER_API}?lat=${coords.latitude}&lon=${coords.longitude}&units=metric&appid=${OPENWEATHER_KEY}`;
        fetch(url)
          .then((r) => r.json())
          .then((data) => {
            if (data.cod !== 200) throw new Error(data.message);
            setTemp(Math.round(data.main.temp));
            setIcon(data.weather[0].icon);
          })
          .catch((err) => setWErr(err.message));
      },
      (err) => setWErr(err.message),
      { timeout: 5000 }
    );
  }, []);

  return (
    <>
      <header className="flex justify-between items-center py-4 px-4 border-b border-blue-900 mb-4 bg-slate-200">
        {/* date / time / weather */}
        <div className="flex items-center space-x-6 text-blue-900">
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold">{dateStr}</span>
            <span className="text-xl font-bold">{timeStr}</span>
          </div>
          {icon != null && temp != null ? (
            <div className="flex items-center space-x-2">
              <img
                src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
                alt="Weather"
                className="h-10 w-10"
              />
              <span className="text-2xl font-bold">{temp}°C</span>
            </div>
          ) : (
            wErr && <span className="text-sm text-red-600">{wErr}</span>
          )}
        </div>

        {/* logo */}
        <Link to="/">
          <img
            src={logo}
            alt="CareBells Logo"
            className="h-16 cursor-pointer"
          />
        </Link>

        {/* buttons */}
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
          <button className="bg-red-500 text-white py-2 px-4 rounded-xl">
            {t("Header.Emergency")}
          </button>
        </div>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {calendarOpen && (
        <Calendar onClose={() => setCalendarOpen(false)} userId={userId} />
      )}
    </>
  );
}
