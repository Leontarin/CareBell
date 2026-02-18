// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import LeftSide from "./components/LeftSide";
import RightSide from "./components/RightSide";
import Login from "./components/Login";
import Register from "./components/Register";
import { AppContext } from "./shared/AppContext";
import { API, fetchJsonAuth } from "./shared/config";
import i18n from "./shared/i18n";
import AdminPanel from "./features/admin/AdminPanel";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { useTranslation } from "react-i18next";


export default function App() {
  const { t } = useTranslation();   
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [bellaFullscreen, setBellaFullscreen] = useState(false);
  const [meetFullscreen, setMeetFullscreen] = useState(false);
  
  // 🔊 Bella volume
  const [bellaVolume, setBellaVolume] = useState(
    parseFloat(localStorage.getItem("bellaVolume")) || 0.7
  );

  useEffect(() => {
    localStorage.setItem("bellaVolume", bellaVolume);
  }, [bellaVolume]);

  // Dark mode
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("darkMode") === "true"
  );

  // 🧓 Adaptive mode (set in Settings)
  const [adaptiveMode, setAdaptiveMode] = useState(
    localStorage.getItem("adaptiveMode") === "true"
  );

  // 📱 Which page is active on NARROW screens when adaptive is ON?
  // "left"  => Bella page
  // "right" => Menu / features page
  const [mobilePanel, setMobilePanel] = useState("left");

  // Apply dark & adaptive to <html>
  useEffect(() => {
    const root = document.documentElement;

    // Dark mode class
    if (darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("darkMode", String(darkMode));

    // Base font size for the whole app
    root.style.setProperty(
      "--font-size-base",
      adaptiveMode ? "26px" : "22px"
    );
    localStorage.setItem("adaptiveMode", String(adaptiveMode));
  }, [darkMode, adaptiveMode]);

  // Fetch current user
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

  // Apply preferred language from user
  useEffect(() => {
    const preferred = (() => {
      if (user?.language) return user.language;
      if (Array.isArray(user?.languages)) {
        for (const code of user.languages) {
          if (code) return code;
        }
      }
      return null;
    })();

    if (!preferred) return;

    const normalized = String(preferred).trim().toLowerCase();
    if (!normalized || i18n.language === normalized) return;

    i18n.changeLanguage(normalized).catch(() => {});
    localStorage.setItem("i18nextLng", normalized);
  }, [user?.language, user?.languages]);

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
        <div className="text-gray-600 dark:text-gray-300">
          Checking session…
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
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
          adaptiveMode,
          setAdaptiveMode,
          bellaVolume,
          setBellaVolume,
        }}
      >
        {!user ? (
          // 🔐 Not logged in – Login / Register
          <Routes>
            <Route path="*" element={<Login onLoggedIn={handleLoggedIn} />} />
            <Route path="/Register" element={<Register />} />
          </Routes>
        ) : (
          // ✅ Logged in – Home & Admin
          <Routes>
            {/* 🏠 Main CareBell interface */}
            <Route
              path="/*"
              element={
                <div
                  className="
                    w-full max-w-screen-lg mx-auto p-4
                    min-h-screen flex flex-col
                    bg-white dark:bg-gray-900 dark:text-gray-100
                  "
                  style={{
                    fontSize: "var(--font-size-base, 22px)",
                  }}
                >
                  <Header />

                  {/* MAIN CONTENT AREA */}
                  <div
                    id="mainContent"
                    className="
                      flex-1
                      flex
                      flex-col
                      gap-2
                      overflow-hidden
                    "
                  >
                    {/* 💻 DESKTOP/TABLET LAYOUT (always the same) */}
                    <div className="hidden md:flex gap-2 flex-1 overflow-hidden">
                      <LeftSide />
                      <RightSide />
                    </div>

                    {/* 📱 MOBILE LAYOUT – Adaptive OFF:
                        Keep your original behavior (Bella + menu stacked)
                    */}
                    {!adaptiveMode && (
                      <div className="flex md:hidden flex-col gap-2 flex-1 overflow-y-auto">
                        <LeftSide />
                        <RightSide />
                      </div>
                    )}

                    {/* 📱 MOBILE LAYOUT – Adaptive ON:
                        Two “pages”: Bella page & Menu page
                    */}
                    {adaptiveMode && (
                      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
                        {adaptiveMode && (
                          <div className="flex md:hidden flex-col flex-1 overflow-hidden">

                            {/* 🔝 TOP TABS WITH SLIDE ANIMATION */}
                            <nav
                              className="
                                flex gap-1
                                sticky top-0 z-20
                                bg-white dark:bg-gray-900
                                pt-2 pb-1
                              "
                              style={{
                                // Removes bottom border line for a cleaner look
                                borderBottom: "none",
                              }}
                            >
                              {/* BELLA TAB */}
                              <button
                                type="button"
                                onClick={() => setMobilePanel("left")}
                                className={`
                                  flex-1 text-center font-bold text-sm py-2
                                  rounded-t-xl
                                  transition-all duration-300 ease-out
                                  ${
                                    mobilePanel === "left"
                                      ? `
                                        // ACTIVE TAB
                                        bg-white dark:bg-gray-900
                                        text-blue-900 dark:text-yellow-200
                                        shadow-md
                                        translate-y-0
                                        z-10
                                      `
                                      : `
                                        // INACTIVE TAB
                                        bg-gray-200 dark:bg-gray-700
                                        text-gray-600 dark:text-gray-300
                                        opacity-80
                                        translate-y-1        /* looks lower */
                                        scale-[0.98]         /* slightly smaller */
                                        shadow-sm
                                        z-0
                                      `
                                  }
                                `}
                                style={{
                                  border: "none",
                                }}
                              >
                                💬 {t("AdaptiveTabs.bella", "Bella")}
                              </button>

                              {/* MENU TAB */}
                              <button
                                type="button"
                                onClick={() => setMobilePanel("right")}
                                className={`
                                  flex-1 text-center font-bold text-sm py-2
                                  rounded-t-xl
                                  transition-all duration-300 ease-out
                                  ${
                                    mobilePanel === "right"
                                      ? `
                                        // ACTIVE TAB
                                        bg-white dark:bg-gray-900
                                        text-blue-900 dark:text-yellow-200
                                        shadow-md
                                        translate-y-0
                                        z-10
                                      `
                                      : `
                                        // INACTIVE TAB
                                        bg-gray-200 dark:bg-gray-700
                                        text-gray-600 dark:text-gray-300
                                        opacity-80
                                        translate-y-1
                                        scale-[0.98]
                                        shadow-sm
                                        z-0
                                      `
                                  }
                                `}
                                style={{
                                  border: "none",
                                }}
                              >
                                📋 {t("AdaptiveTabs.menu", "Menu")}
                              </button>
                            </nav>

                            {/* Spacer for clean separation */}
                            <div className="h-2"></div>

                            {/* SMALL SPACER UNDER TABS */}
                            <div className="h-2"></div>


                            {/*  PAGE CONTENT */}
                            <div className="flex-1 overflow-y-auto">
                              {mobilePanel === "left" ? <LeftSide /> : <RightSide />}
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                </div>
              }
            />

            {/* 🛡️ Admin Panel */}
            <Route
              path="/admin"
              element={
                <ProtectedAdminRoute>
                  <AdminPanel />
                </ProtectedAdminRoute>
              }
            />
          </Routes>
        )}
      </AppContext.Provider>
    </BrowserRouter>
  );
}
