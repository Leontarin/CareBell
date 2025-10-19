// frontend/src/features/admin/AddUserModal.jsx
import React, { useState } from "react";
import { API } from "../../shared/config";
import { COUNTRIES, AVAILABLE_LANGUAGES, LANG_LABELS } from "../../shared/constants";

export default function AddUserModal({ open, onClose, onAdded }) {
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneNumber: "",
    address: "",
    dateOfBirth: "",
    gender: "other",
    R: false, S: false, G: false, M: false, A: false, W: false, K: false, Y: false,
    AllergensCSV: "",
    Diabetic: false,
    country: "",
    language: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password && form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!form.fullName.trim()) {
      setError("Full name is required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        id: (typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
        fullName: form.fullName.trim(),
        username: form.username.trim() || undefined,
        email: form.email.trim() || undefined,
        password: form.password.trim() || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
        address: form.address.trim() || undefined,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : undefined,
        gender: form.gender,
        R: !!form.R, S: !!form.S, G: !!form.G, M: !!form.M,
        A: !!form.A, W: !!form.W, K: !!form.K, Y: !!form.Y,
        Allergens: form.AllergensCSV
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        Diabetic: !!form.Diabetic,
      };

      const res = await fetch(`${API}/admin/users/add`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);

      onAdded?.(data);
      onClose?.();
      setForm({
        fullName: "",
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        phoneNumber: "",
        address: "",
        dateOfBirth: "",
        gender: "other",
        R: false, S: false, G: false, M: false, A: false, W: false, K: false, Y: false,
        AllergensCSV: "",
        Diabetic: false,
        country: "",
        language: "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[92%] max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6">
        <h3 className="text-2xl font-bold mb-4 text-blue-900 dark:text-blue-200">
          Add New User
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Login credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
            <input
              name="email"
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
            <input
              name="confirmPassword"
              type="password"
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="fullName"
              placeholder="Full name *"
              value={form.fullName}
              onChange={handleChange}
              required
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
            <input
              name="phoneNumber"
              placeholder="Phone number"
              value={form.phoneNumber}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
            <input
              name="address"
              placeholder="Address"
              value={form.address}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 md:col-span-2"
            />
            <input
              name="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Health flags */}
          <div>
            <div className="text-sm font-semibold mb-1 text-gray-800 dark:text-gray-200">Health Flags</div>
            <div className="grid grid-cols-4 gap-2">
              {["R","S","G","M","A","W","K","Y"].map((key) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={key}
                    checked={!!form[key]}
                    onChange={handleChange}
                  />
                  <span className="text-sm">{key}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Allergens & Diabetic */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="AllergensCSV"
              placeholder="Allergens (comma separated)"
              value={form.AllergensCSV}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="Diabetic"
                checked={form.Diabetic}
                onChange={handleChange}
              />
              <span className="text-sm">Diabetic</span>
            </label>
          </div>

          {/* Country & language (UI only) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              name="country"
              value={form.country}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Country (UI only)</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>

            <select
              name="language"
              value={form.language}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Language (UI only)</option>
              {(COUNTRIES.find(c => c.code === form.country)?.languages || AVAILABLE_LANGUAGES).map((lang) => (
                <option key={lang} value={lang}>{LANG_LABELS[lang]}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded text-white ${
                loading ? "bg-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {loading ? "Saving…" : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
