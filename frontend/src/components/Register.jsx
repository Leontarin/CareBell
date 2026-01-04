// src/components/Register.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../resources/Logo_Gold_Blau_Rubik.png";
import { API } from "../shared/config";
import NotificationModal from "./NotificationModal";
import TopRightControls from "./TopRightControls";


const LANG_LABELS = {
  en: "English",
  de: "German",
  he: "עברית",
  fi: "suomi",
  ru: "русский",
};
const COUNTRIES = [
  { code: "DE", name: "Germany", languages: ["de", "en"], flag: "🇩🇪" },
  { code: "FI", name: "Finland", languages: ["fi", "en"], flag: "🇫🇮" },
  { code: "IL", name: "Israel", languages: ["he", "en"], flag: "🇮🇱" },
];

function CountryWheelPicker({ open, onClose, onSelect }) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    if (!query.trim()) return COUNTRIES;
    const q = query.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [query]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ion-icon name="earth" className="text-2xl text-yellow-600" />
          <h3 className="text-xl font-bold">Select country</h3>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full rounded-2xl border-2 border-yellow-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white pl-10 pr-3 py-2.5 mb-4"
        />
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {list.map((c) => (
            <li
              key={c.code}
              className="rounded-xl border hover:border-yellow-400 bg-gray-50 dark:bg-gray-800/60 px-4 py-2.5 flex items-center justify-between cursor-pointer"
              onClick={() => {
                onSelect(c);
                onClose();
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.flag}</span>
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.code}</div>
                </div>
              </div>
              <ion-icon name="chevron-forward" className="text-xl text-gray-500" />
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 bg-gray-200 hover:bg-gray-300"
          >
            {t("Auth.Register.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("other");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(null);
  const [language, setLanguage] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [modalTitle, setModalTitle] = useState("Notice");

  const emailOk = (v) => /^\S+@\S+\.\S+$/.test(v.trim());
  const usernameOk = (v) => v.trim().length >= 3;
  const passwordOk = (v) => v.length >= 8;
  const confirmOk = (p, c) => p === c && c.length > 0;
  const phoneOk = (v) => v.trim().length >= 6;
  const step1Valid = emailOk(email) || usernameOk(username);
  const step2Valid = passwordOk(password) && confirmOk(password, confirmPassword);
  const step3Valid = fullName.trim().length > 1 && phoneOk(phone);
  const step4Valid = !!country?.code && !!language;

  const submit = async (e) => {
    e.preventDefault();
    if (!step4Valid) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName,
          email,
          username,
          password,
          gender,
          phoneNumber: phone,
          country: country?.code,
          language,
        }),
      });
      if (!res.ok) throw new Error("Registration failed");
      navigate("/");
    } catch (e) {
      setModalMsg(e.message);
      setModalOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
  className="fixed inset-0 overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center"
  style={{ overscrollBehavior: "none", WebkitOverflowScrolling: "auto" }}
>
      <TopRightControls />
      <NotificationModal
        open={modalOpen}
        title={modalTitle}
        message={modalMsg}
        onClose={() => setModalOpen(false)}
      />
      <CountryWheelPicker
        open={countryOpen}
        onClose={() => setCountryOpen(false)}
        onSelect={(c) => {
          setCountry(c);
          setLanguage("");
        }}
      />

      <div className="w-full max-w-4xl h-fit">
        <div className="flex flex-col items-center gap-2 mb-2">
          <img src={logo} alt="CareBells Logo" className="h-20 w-auto" />
          <h1 className="text-3xl font-bold text-blue-900 dark:text-gray-100 text-center">
            {t("Auth.Register.header")}
          </h1>
        </div>

        <div className="rounded-3xl bg-white dark:bg-gray-800 shadow-2xl px-8 py-8 text-[17px]">
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>

          <p className="text-center text-gray-700 dark:text-gray-300 mb-4">
            {t("Auth.Register.step")} {step} {t("Auth.Register.of4")}
          </p>

          <form onSubmit={submit} className="space-y-3">
            {step === 1 && (
              <div className="grid gap-4">
                <p className="text-center font-bold text-xl text-gray-800 dark:text-gray-100 mb-1">
                  {t("Auth.Register.oneOf")}
                </p>
                <LabeledInput
                  id="email"
                  label={t("Auth.Register.email")}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <LabeledInput
                  id="username"
                  label={t("Auth.Register.username")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yourusername"
                  autoComplete="username"
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={!step1Valid}
                    onClick={() => setStep(2)}
                    className={`px-6 py-3 rounded-xl text-white font-bold ${
                      step1Valid ? "bg-yellow-600 hover:bg-yellow-700" : "bg-gray-300"
                    }`}
                  >
                    {t("Auth.Register.Next")}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4">
                <PasswordRow
                  id="password"
                  label= {t("Auth.Register.password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  show={showPassword}
                  setShow={setShowPassword}
                  placeholder={t("Auth.Register.8characters")}
                />
                <PasswordRow
                  id="confirmPassword"
                  label={t("Auth.Register.verifyPassword")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  show={showConfirm}
                  setShow={setShowConfirm}
                  placeholder={t("Auth.Register.verifyPasswordPh")}
                />
                <div className="flex justify-between pt-1">
                  <button
                    onClick={() => setStep(1)}
                    type="button"
                    className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
                  >
                    {t("Auth.Register.back")}
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!step2Valid}
                    type="button"
                    className={`px-6 py-3 rounded-xl text-white font-bold ${
                      step2Valid ? "bg-yellow-600 hover:bg-yellow-700" : "bg-gray-300"
                    }`}
                  >
                    {t("Auth.Register.Next")}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-4">
                <LabeledInput
                  id="fullName"
                  label={t("Auth.Register.fullName")}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("Auth.Register.fullNamePh")}
                />
                <div>
                  <label className="block text-2xl font-bold mb-1">{t("Auth.Register.gender")} *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full text-lg rounded-2xl border-2 border-yellow-400 px-4 py-3 bg-white dark:bg-gray-900 dark:text-white"
                  >
                    <option value="other">{t("Auth.Register.genderOther")}</option>
                    <option value="male">{t("Auth.Register.genderMale")}</option>
                    <option value="female">{t("Auth.Register.genderFemale")}</option>
                  </select>
                </div>
                <LabeledInput
                  id="phone"
                  label={t("Auth.Register.phone")}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="555-123-4567"
                  autoComplete="tel"
                />
                <div className="flex justify-between pt-1">
                  <button
                    onClick={() => setStep(2)}
                    type="button"
                    className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
                  >
                    {t("Auth.Register.back")}
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    disabled={!step3Valid}
                    type="button"
                    className={`px-6 py-3 rounded-xl text-white font-bold ${
                      step3Valid ? "bg-yellow-600 hover:bg-yellow-700" : "bg-gray-300"
                    }`}
                  >
                    {t("Auth.Register.Next")}
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="grid gap-4">
                <div>
                  <label className="block text-lg font-bold mb-1">{t("Auth.Register.country")} *</label>
                  <button
                    type="button"
                    onClick={() => setCountryOpen(true)}
                    className="w-full text-left text-lg rounded-2xl border-2 border-yellow-400 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900 dark:text-white"
                  >
                    <span>
                      {country ? `${country.flag} ${country.name}` : t("Auth.Register.selectCountry")}
                    </span>
                    <ion-icon name="chevron-down" className="text-xl"></ion-icon>
                  </button>
                </div>
                <div>
                  <label className="block text-lg font-bold mb-1">
                    {t("Auth.Register.language")} *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(country?.languages || []).map((code) => (
                      <button
                        key={code}
                        onClick={() => setLanguage(code)}
                        type="button"
                        className={`rounded-2xl border-2 px-4 py-3 font-semibold ${
                          language === code
                            ? "border-yellow-500 bg-yellow-50 dark:text-black"
                            : "border-yellow-400 bg-white dark:text-black"
                        }`}
                      >
                        {LANG_LABELS[code]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between pt-1">
                  <button
                    onClick={() => setStep(3)}
                    type="button"
                    className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
                  >
                    {t("Auth.Register.back")}
                  </button>
                  <button
                    type="submit"
                    disabled={!step4Valid || submitting}
                    className={`px-6 py-3 rounded-xl text-white font-bold ${
                      step4Valid && !submitting
                        ? "bg-yellow-600 hover:bg-yellow-700"
                        : "bg-gray-300"
                    }`}
                  >
                    {submitting ? t("Auth.Register.creating") : t("Auth.Register.create")}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* ─────────── Already have an account line ─────────── */}
          <div className="mt-6 text-center">
            <p className="text-gray-700 dark:text-gray-300">
              {t("Auth.Register.haveAccount")}{" "}
              <Link
                to="/.."
                className="text-blue-700 dark:text-blue-400 underline font-bold hover:text-blue-800 dark:hover:text-blue-200"
              >
                {t("Auth.Register.login")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({ id, label, type = "text", placeholder = "", ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-2xl font-bold mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        {...props}
        className="w-full text-lg rounded-2xl border-2 border-yellow-400 px-4 py-3 bg-white dark:bg-gray-900 dark:text-white"
      />
    </div>
  );
}

function PasswordRow({ id, label, value, onChange, show, setShow, placeholder }) {
  const { t, i18n } = useTranslation();
  const isInvalid = id === "password" && value.length > 0 && value.length < 8;
  return (
    <div>
      <label htmlFor={id} className="block text-2xl font-bold mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full text-xl rounded-2xl border-2 border-yellow-400 pl-4 pr-12 py-3 bg-white dark:bg-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 px-4 text-gray-600 hover:text-gray-800"
        >
          <ion-icon name={show ? "eye-off" : "eye"} className="text-xl"></ion-icon>
        </button>
      </div>
      {isInvalid && (
        <p className="mt-3 text-yellow-600 font-bold text-xl text-center">
          {t("Auth.Register.passwordRule")}
        </p>
      )}
    </div>
  );
}
