// src/components/Register.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../resources/Logo_Gold_Blau_Rubik.png";
import { API } from "../shared/config";
import NotificationModal from "./NotificationModal";

export default function Register() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("other");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Notification modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [modalTitle, setModalTitle] = useState("Notice");

  const showError = (msg, title = "Please fix the following") => {
    setModalTitle(title);
    setModalMsg(msg);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Aggregate validation
    const missing = [];
    if (!fullName.trim()) missing.push("Full name");
    if (!email.trim() && !username.trim()) missing.push("Email or Username");
    if (!password.trim()) missing.push("Password");
    if (!confirmPassword.trim()) missing.push("Verify password");

    if (missing.length) {
      showError(`Required field(s) missing:\n• ${missing.join("\n• ")}`);
      return;
    }
    if (password !== confirmPassword) {
      showError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        username: username.trim() || undefined,
        password,
        dateOfBirth: dateOfBirth || undefined,
        gender,
        phoneNumber: phoneNumber.trim() || undefined,
      };

      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Registration failed");
      }

      navigate("/");
    } catch (e) {
      showError(String(e?.message || e) || "Registration failed", "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

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
            Create your account
          </h1>
        </div>

        <div className="rounded-3xl bg-white dark:bg-gray-800 shadow-2xl px-4 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10 text-[17px]">
          <h2 className="text-center text-3xl md:text-[28px] lg:text-4xl font-bold">Register</h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-8 mt-6 items-start">
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              {/* Username (one of email/username required) */}
              <div>
                <label htmlFor="username" className="block text-lg font-bold mb-2">
                  Username <span className="text-red-600">*</span>
                  <span className="ml-2 text-sm text-gray-500">(one of Email or Username is required)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 dark:text-gray-500">
                    <ion-icon name="person" className="text-2xl lg:text-3xl"></ion-icon>
                  </span>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-12 pr-4 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                    placeholder="yourusername"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Email (one of email/username required) */}
              <div>
                <label htmlFor="email" className="block text-lg font-bold mb-2">
                  Email <span className="text-red-600">*</span>
                  <span className="ml-2 text-sm text-gray-500">(one of Email or Username is required)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 dark:text-gray-500">
                    <ion-icon name="mail" className="text-2xl lg:text-3xl"></ion-icon>
                  </span>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-12 pr-4 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password (required) */}
              <div>
                <label htmlFor="password" className="block text-lg font-bold mb-2">
                  Password <span className="text-red-600">*</span>
                </label>
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
                    placeholder="Enter a secure password"
                    autoComplete="new-password"
                    required
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

              {/* Verify Password (required) */}
              <div>
                <label htmlFor="confirmPassword" className="block text-lg font-bold mb-2">
                  Verify password <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 dark:text-gray-500">
                    <ion-icon name="shield-checkmark" className="text-2xl lg:text-3xl"></ion-icon>
                  </span>
                  <input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-12 pr-14 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute inset-y-0 right-0 px-4 flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
                    aria-label={showConfirm ? "Hide verify" : "Show verify"}
                  >
                    <ion-icon name={showConfirm ? "eye-off" : "eye"} className="text-xl lg:text-2xl"></ion-icon>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              {/* Full Name (required) — top-right */}
              <div>
                <label htmlFor="fullName" className="block text-lg font-bold mb-2">
                  Full name <span className="text-red-600">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-4 pr-4 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                  placeholder="Jane Doe"
                  required
                />
              </div>

              {/* Date of birth */}
              <div>
                <label htmlFor="dob" className="block text-lg font-bold mb-2">Date of birth</label>
                <input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-4 pr-4 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                />
              </div>

              {/* Gender */}
              <div>
                <label htmlFor="gender" className="block text-lg font-bold mb-2">Gender</label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-4 pr-4 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                >
                  <option value="other">Other</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              {/* Phone number */}
              <div>
                <label htmlFor="phone" className="block text-lg font-bold mb-2">Phone number</label>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full text-lg rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-900 pl-4 pr-4 py-3.5 focus:ring-4 focus:ring-yellow-500/30"
                  placeholder="555-123-4567"
                  autoComplete="tel"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-2xl bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 text-white py-3.5 text-xl font-extrabold"
                >
                  {submitting ? "Creating..." : "Create account"}
                </button>
                <p className="text-center text-gray-700 dark:text-gray-300">
                  Already have an account?{" "}
                  <Link to="/" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                    Login
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
