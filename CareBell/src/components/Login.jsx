// src/components/Login.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../resources/Logo_Gold_Blau_Rubik.png";
import { API } from "../shared/config";
import NotificationModal from "./NotificationModal";

export default function Login({ onLoggedIn }) {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Notification modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [modalTitle, setModalTitle] = useState("Notice");
  const showError = (msg, title = "Login error") => {
    setModalTitle(title);
    setModalMsg(msg);
    setModalOpen(true);
  };

  const googleSlotRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Simple required check for identifier (password may be blank for some accounts)
    if (!emailOrUsername.trim()) {
      showError("Please enter your email or username.");
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
        throw new Error(data?.message || "Login failed");
      }
      onLoggedIn?.();
    } catch (e) {
      showError(e.message || "Invalid credentials");
    }
  };

  // Google button
  useEffect(() => {
    if (!window.google || !googleSlotRef.current) return;
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        try {
          const r = await fetch(`${API}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ id_token: credential }),
          });
          if (!r.ok) throw new Error("Google sign-in failed");
          onLoggedIn?.();
        } catch (err) {
          showError(err?.message || "Google sign-in failed", "Google sign-in");
        }
      },
    });
    window.google.accounts.id.renderButton(googleSlotRef.current, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "continue_with",
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4 md:p-6">
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
            Welcome to CareBells
          </h1>
        </div>

        <div className="rounded-3xl bg-white dark:bg-gray-800 shadow-2xl px-4 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10 text-[17px]">
          <h2 className="text-center text-3xl md:text-[28px] lg:text-4xl font-bold">Login</h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-8 mt-6 items-start">
            <div className="space-y-6">
              {/* Email or Username */}
              <div>
                <label htmlFor="emailOrUsername" className="block text-lg font-bold mb-2">
                  Email or username <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 dark:text-gray-500">
                    <ion-icon name="mail" className="text-2xl lg:text-3xl"></ion-icon>
                  </span>
                  <input
                    id="emailOrUsername"
                    type="text"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-12 pr-4 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                    placeholder="you@example.com or youruser"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password (may be empty for accounts without local password) */}
              <div>
                <label htmlFor="password" className="block text-lg font-bold mb-2">Password <span className="text-red-600">*</span></label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 dark:text-gray-500">
                    <ion-icon name="lock-closed" className="text-2xl lg:text-3xl"></ion-icon>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-12 pr-14 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                    placeholder="password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 px-4 flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <ion-icon name={showPassword ? "eye-off" : "eye"} className="text-xl lg:text-2xl"></ion-icon>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-5 md:max-w-[360px] md:mx-auto md:pt-4 lg:pt-8">
              <button type="submit" className="w-full rounded-2xl bg-yellow-600 hover:bg-yellow-500 text-white py-3.5 text-xl font-extrabold">
                Login
              </button>

              {/* Google button */}
              <div id="google-login-slot" ref={googleSlotRef} className="flex justify-center" />

              {/* Register link */}
              <p className="text-base md:text-lg lg:text-xl text-gray-700 dark:text-gray-300 text-center">
                Don’t have an account?{" "}
                <Link to="/Register" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                  Register
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
