// App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import LeftSide from "./components/LeftSide";
import RightSide from "./components/RightSide";
import Login from "./components/Login";
import Register from "./components/Register";
import { AppContext } from "./shared/AppContext";
import { API, fetchJsonAuth } from "./shared/config";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bellaFullscreen, setBellaFullscreen] = useState(false);
  const [meetFullscreen, setMeetFullscreen] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");

  useEffect(() => {
    const root = document.documentElement;
    darkMode ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetchJsonAuth(`${API}/auth/me`);
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const handleLoggedIn = async () => {
    try {
      const me = await fetchJsonAuth(`${API}/auth/me`);
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-white dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-300">Checking session…</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {!user ? (
        <Routes>
          <Route path="/" element={<Login onLoggedIn={handleLoggedIn} />} />
          <Route path="/Register" element={<Register />} />
        </Routes>
      ) : (
        <AppContext.Provider
          value={{
            user,
            setUser,
            bellaFullscreen,
            setBellaFullscreen,
            meetFullscreen,
            setMeetFullscreen,
            darkMode,
            setDarkMode,
          }}
        >
          <div
            className="w-full max-w-screen-lg mx-auto p-4 min-h-screen flex flex-col bg-white dark:bg-gray-900 dark:text-gray-100"
            style={{ fontSize: "var(--font-size-base,22px)" }}
          >
            <Header />
            <div
              id="mainContent"
              className="flex-1 flex flex-col md:flex-row gap-2 md:overflow-hidden overflow-y-auto"
            >
              <LeftSide />
              <RightSide />
            </div>
          </div>
        </AppContext.Provider>
      )}
    </BrowserRouter>
  );
}
