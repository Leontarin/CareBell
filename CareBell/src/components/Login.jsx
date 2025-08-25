import { useState } from "react";
import logo from "../resources/Logo_Gold_Blau_Rubik.png";

export default function Login({ onSubmit }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({ email, password, remember });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4 md:p-6">
      {/* Fit tablets: ~896px wide card */}
      <div className="w-full max-w-4xl">
        {/* Top: brand (slightly smaller on md) */}
        <div className="flex flex-col items-center gap-3 mb-4 md:mb-5">
          <img
            src={logo}
            alt="CareBells Logo"
            className="h-14 w-auto select-none md:h-16 lg:h-20"
            draggable={false}
          />
          <h1 className="text-3xl font-semibold text-blue-900 dark:text-gray-100 text-center md:text-[28px] lg:text-4xl">
            Welcome to CareBells
          </h1>
        </div>

        {/* Card: responsive typography; overflow-safe on very small screens */}
        <div className="rounded-3xl bg-white dark:bg-gray-800 shadow-2xl px-4 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10 text-[17px] md:text-[17px] lg:text-[18px]">
          <h2 className="text-center text-3xl md:text-[28px] lg:text-4xl font-bold text-gray-900 dark:text-gray-100">
            Login
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-8 mt-6 items-start"
          >
            {/* LEFT: inputs */}
            <div className="space-y-6">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-lg font-bold text-gray-800 dark:text-gray-200 mb-2"
                >
                  Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 dark:text-gray-500">
                    <ion-icon name="mail" className="text-2xl lg:text-3xl"></ion-icon>
                  </span>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-lg rounded-2xl border-2 border-yellow-400 dark:border-yellow-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 pl-12 pr-4 py-3.5 md:py-3.5 lg:py-4 focus:outline-none focus:ring-4 focus:ring-yellow-500/30 focus:border-yellow-500"
                    placeholder="you@example.com"
                  />
                </div>
                
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-lg font-bold text-gray-800 dark:text-gray-200 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 dark:text-gray-500">
                    <ion-icon name="lock-closed" className="text-2xl lg:text-3xl"></ion-icon>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-lg rounded-2xl border-2 border-yellow-400 dark:border-yellow-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 pl-12 pr-14 py-3.5 md:py-3.5 lg:py-4 focus:outline-none focus:ring-4 focus:ring-yellow-500/30 focus:border-yellow-500"
                    placeholder="Password"
                  />
                  {/* Show/Hide password */}
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

              {/* Remember / Forgot */}
              <div className="flex items-center justify-between text-lg pt-1">
                <label className="flex items-center gap-3 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 accent-yellow-600 focus:ring-yellow-600"
                  />
                  <span className="text-gray-800 dark:text-gray-200">Remember me</span>
                </label>

                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Forgot Password?
                </a>
              </div>
            </div>

            {/* RIGHT: actions (centered, with moderate spacing) */}
            <div className="flex flex-col gap-5 md:max-w-[360px] md:mx-auto md:pt-4 lg:pt-8">
              <button
                type="submit"
                className="w-full rounded-2xl bg-yellow-600 hover:bg-yellow-500 text-white py-3.5 md:py-3.5 lg:py-5 text-xl lg:text-2xl font-extrabold tracking-wide transition active:scale-[0.99]"
              >
                Login
              </button>

              {/* Google placeholder */}
              <div
                id="google-login-slot"
                className="h-[56px] md:h-[60px] lg:h-[72px] rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-base md:text-lg lg:text-xl"
                aria-label="Login with Google (coming soon)"
              >
                Login with Google (placeholder)
              </div>

              <p className="text-base md:text-lg lg:text-xl text-gray-700 dark:text-gray-300">
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
