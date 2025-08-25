import { useEffect, useRef, useState } from "react";
import logo from "../resources/Logo_Gold_Blau_Rubik.png";
import { API } from "../shared/config";

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const googleSlotRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emailOrUsername: email, password, remember }),
      });
      if (!res.ok) throw new Error("Login failed");
      onLoggedIn?.();
    } catch {
      setError("Invalid email or password");
    }
  };

  // Render Google button in the placeholder div
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
        } catch {
          setError("Google sign-in failed");
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
      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-center gap-3 mb-4 md:mb-5">
          <img src={logo} alt="CareBells Logo" className="h-14 w-auto md:h-16 lg:h-20" draggable={false} />
          <h1 className="text-3xl font-semibold text-blue-900 dark:text-gray-100 text-center md:text-[28px] lg:text-4xl">
            Welcome to CareBells
          </h1>
        </div>

        <div className="rounded-3xl bg-white dark:bg-gray-800 shadow-2xl px-4 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10 text-[17px]">
          <h2 className="text-center text-3xl md:text-[28px] lg:text-4xl font-bold">Login</h2>

          {error && <p className="mt-4 text-center text-red-600 dark:text-red-400">{error}</p>}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-8 mt-6 items-start">
            <div className="space-y-6">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-lg font-bold mb-2">Email</label>
                <input
                  id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-4 pr-4 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-lg font-bold mb-2">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-4 pr-14 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                    placeholder="Password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 px-4 text-gray-600 dark:text-gray-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center justify-between text-lg pt-1">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-5 w-5 rounded accent-yellow-600"
                  />
                  <span>Remember me</span>
                </label>
                <span className="text-gray-500">Forgot Password?</span>
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
                <a href="#" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                  Register
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
