import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { API } from "../../shared/config";
import { COUNTRIES, AVAILABLE_LANGUAGES, LANG_LABELS } from "../../shared/constants";
import AllergenCheckboxes from "../../components/AllergenCheckboxes.jsx";
import { useMeta } from "../../shared/metaContext.jsx";

export default function AddUserModal({ open, onClose, onAdded }) {
  const { t } = useTranslation();

  const { pictograms } = useMeta();

  const baseForm = useMemo(() => {
    const initial = {
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      phoneNumber: "",
      dateOfBirth: "",
      gender: "other",
      Diabetic: false,
      country: "",
      language: "",
    };
    pictograms.forEach(({ key }) => {
      initial[key] = false;
    });
    return initial;
  }, [pictograms]);

  const [form, setForm] = useState(baseForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  useEffect(() => {
    setForm((prev) => {
      const next = { ...prev };
      pictograms.forEach(({ key }) => {
        if (typeof next[key] !== "boolean") next[key] = false;
      });
      return next;
    });
  }, [pictograms]);

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password && form.password !== form.confirmPassword) {
      setError(t("Admin.Users.passwordMismatch", "Passwords do not match"));
      return;
    }
    if (!form.fullName.trim()) {
      setError(t("Admin.Users.fullNameRequired", "Full name is required"));
      return;
    }

    setLoading(true);
    try {
      const allergenFlags = Object.fromEntries(
        pictograms.map(({ key }) => [key, !!form[key]])
      );

      const payload = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        fullName: form.fullName.trim(),
        username: form.username.trim() || undefined,
        email: form.email.trim() || undefined,
        password: form.password.trim() || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : undefined,
        gender: form.gender,
        ...allergenFlags,
        Diabetic: !!form.Diabetic,
        country: form.country,
        language: form.language,
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
      setForm({ ...baseForm });
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
          {t("Admin.Users.addUser", "Add New User")}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Login credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="username"
              placeholder={t("Admin.Users.username", "Username")}
              value={form.username}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            />
            <input
              name="email"
              placeholder={t("Admin.Users.email", "Email")}
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            />
            <input
              name="password"
              type="password"
              placeholder={t("Auth.Register.password", "Password")}
              value={form.password}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            />
            <input
              name="confirmPassword"
              type="password"
              placeholder={t("Auth.Register.verifyPassword", "Confirm Password")}
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            />
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="fullName"
              placeholder={t("Admin.Users.fullName", "Full name *")}
              value={form.fullName}
              onChange={handleChange}
              required
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            />
            <input
              name="phoneNumber"
              placeholder={t("Auth.Register.phone", "Phone number")}
              value={form.phoneNumber}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            />
            <input
              name="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            />
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            >
              <option value="male">{t("Auth.Register.genderMale", "Male")}</option>
              <option value="female">{t("Auth.Register.genderFemale", "Female")}</option>
              <option value="other">{t("Auth.Register.genderOther", "Other")}</option>
            </select>
          </div>

          {/* Health flags / allergens */}
          <div>
            <div className="text-sm font-semibold mb-1 text-gray-800 dark:text-gray-200">
              {t("Admin.Users.health", "Health Flags")}
            </div>
            <AllergenCheckboxes values={form} onChange={setForm} />
          </div>

          {/* Diabetic, Country, Language */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="Diabetic"
                checked={form.Diabetic}
                onChange={handleChange}
              />
              <span className="text-sm">
                {t("SettingsModal.diabetic", "Diabetic")}
              </span>
            </label>
            <br/>
            <select
              name="country"
              value={form.country}
              onChange={handleChange}
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            >
              <option value="">Country</option>
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
              className="w-full rounded p-2 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            >
              <option value="">Language</option>
              {(COUNTRIES.find((c) => c.code === form.country)?.languages ||
                AVAILABLE_LANGUAGES
              ).map((lang) => (
                <option key={lang} value={lang}>
                  {LANG_LABELS[lang]}
                </option>
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
              {t("Admin.Users.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded text-white ${
                loading
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {loading
                ? t("Admin.Users.saving", "Saving…")
                : t("Admin.Users.addUser", "Add User")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
