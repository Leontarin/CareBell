// src/components/Login.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../resources/Logo_Gold_Blau_Rubik.png";
import { API } from "../shared/config";
import NotificationModal from "./NotificationModal";
import TopRightControls from "./TopRightControls";
import GoogleSignIn from "./GoogleSignIn";

export default function Login({ onLoggedIn }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Notification modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [modalTitle, setModalTitle] = useState(t("Header.settings", { defaultValue: "Notice" }));
  const showError = (msg, title = t("Auth.Login.failed", { defaultValue: "Login error" })) => {
    setModalTitle(title);
    setModalMsg(msg);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!emailOrUsername.trim()) {
      showError(t("Auth.Login.missingIdentifier", { defaultValue: "Please enter your email or username." }));
      return;
    }

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emailOrUsername, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || t("Auth.Login.failed", { defaultValue: "Login failed" }));
      }
      onLoggedIn?.();
    } catch (e) {
      showError(e.message || t("Auth.Login.invalid", { defaultValue: "Invalid credentials" }));
    }
  };

  // RTL/LTR helpers for icon placement
  const iconSideClass = isRTL ? "right-0 pr-4" : "left-0 pl-4";
  const inputPadWithIcon = isRTL ? "pr-12 pl-4" : "pl-12 pr-4";
  const passwordPad = isRTL ? "pr-12 pl-14" : "pl-12 pr-14";

  return (
    <div
      dir={i18n.dir()}
      className="relative min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4 md:p-6"
    >
      {/* Top-right controls (language + dark mode) */}
      <TopRightControls />

      {/* Modal */}
      <NotificationModal
        open={modalOpen}
        title={modalTitle}
        message={modalMsg}
        onClose={() => setModalOpen(false)}
      />

      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-center gap-3 mb-4 md:mb-5">
          <img src={logo} alt="CareBells Logo" className="h-14 w-auto md:h-16 lg:h-20" draggable={false} />
          <h1 className="text-3xl font-semibold text-blue-900 dark:text-gray-100 text-center md:text-[28px] lg:text-4xl">
            {t("Auth.Login.welcome", { defaultValue: "Welcome to CareBells" })}
          </h1>
        </div>

        <div className="rounded-3xl bg-white dark:bg-gray-800 shadow-2xl px-4 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10 text-[17px]">
          <h2 className="text-center text-3xl md:text-[28px] lg:text-4xl font-bold">
            {t("Auth.Login.title", { defaultValue: "Login" })}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-8 mt-6 items-start"
          >
            <div className="space-y-6">
              {/* Email or Username */}
              <div>
                <label htmlFor="emailOrUsername" className="block text-lg font-bold mb-2">
                  {t("Auth.Login.identifier", { defaultValue: "Email or username" })}{" "}
                  <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <span
                    className={`absolute inset-y-0 flex items-center pointer-events-none text-gray-400 dark:text-gray-500 ${iconSideClass}`}
                  >
                    <ion-icon name="mail" className="text-2xl lg:text-3xl"></ion-icon>
                  </span>
                  <input
                    id="emailOrUsername"
                    type="text"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    className={`w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 ${inputPadWithIcon} py-3.5 focus:ring-4 focus:ring-yellow-500/30`}
                    placeholder={t("Auth.Login.identifierPh", {
                      defaultValue: "you@example.com or youruser",
                    })}
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-lg font-bold mb-2">
                  {t("Auth.Login.password", { defaultValue: "Password" })} <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <span
                    className={`absolute inset-y-0 flex items-center pointer-events-none text-gray-400 dark:text-gray-500 ${iconSideClass}`}
                  >
                    <ion-icon name="lock-closed" className="text-2xl lg:text-3xl"></ion-icon>
                  </span>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 ${passwordPad} py-3.5 focus:ring-4 focus:ring-yellow-500/30`}
                    placeholder={t("Auth.Login.passwordPh", { defaultValue: "password" })}
                    autoComplete="current-password"
                  />

                  {/* Eye button on visual end */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className={`absolute inset-y-0 px-4 flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white ${
                      isRTL ? "left-0" : "right-0"
                    }`}
                    aria-label={
                      showPassword
                        ? t("Auth.Login.hide", { defaultValue: "Hide password" })
                        : t("Auth.Login.show", { defaultValue: "Show password" })
                    }
                  >
                    <ion-icon name={showPassword ? "eye-off" : "eye"} className="text-xl lg:text-2xl"></ion-icon>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-5 md:max-w-[360px] md:mx-auto md:pt-4 lg:pt-8">
              <button
                type="submit"
                className="w-full rounded-2xl bg-yellow-600 hover:bg-yellow-500 text-white py-3.5 text-xl font-extrabold"
              >
                {t("Auth.Login.cta", { defaultValue: "Login" })}
              </button>

              {/* Google sign-in (localized & re-rendered on language change inside the component) */}
              <div className="flex justify-center">
                <GoogleSignIn
                  key={i18n.language}        // ensures full re-init on language switch
                  locale={i18n.language}     // passes current locale to GIS
                  onError={(msg) => showError(msg, t("Login.googleTitle"))}
                />
              </div>

              {/* Register link */}
              <p className="text-base md:text-lg lg:text-xl text-gray-700 dark:text-gray-300 text-center">
                {t("Auth.Login.noAccount", { defaultValue: "Don’t have an account?" })}{" "}
                <Link to="/Register" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                  {t("Auth.Login.register", { defaultValue: "Register" })}
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
