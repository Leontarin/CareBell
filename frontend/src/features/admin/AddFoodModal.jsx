// frontend/src/features/admin/AddFoodModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API } from "../../shared/config";
import { useTranslation } from "react-i18next";
import { LANG_LABELS } from "../../shared/constants";

import MetaEditorModal from "../../components/MetaEditorModal";
import DateSelectorModal from "../../components/DateSelectorModal";

import {
  derivePictogramsFromAllergens,
  isDiabeticFriendly,
  formatAdditiveBubble,
  PICTO_BY_KEY,
} from "../../../../shared/constants/foodMeta.utils.js";

const SUPPORTED_LANGS = ["en", "de", "fi", "he"];
const safeLangLabel = (lang, t) =>
  t(`Admin.Foods.languageTabs.${lang}`, LANG_LABELS?.[lang] || lang.toUpperCase());

export default function AddFoodModal({ onClose, onAdded }) {
  const { t } = useTranslation();
  const [activeLang, setActiveLang] = useState("en");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  // NEW MODALS
  const [metaOpen, setMetaOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  // NEW Fields (replacing old pictograms system)
  const [form, setForm] = useState({
    barcode: "",
    dates: [],
    recurringDays: [],
    allergens: [],
    additives: [],
    pictograms: [],
    diabeticFriendly: false,

    translations: {
      en: { dish: "", description: "", category: "" },
      de: { dish: "", description: "", category: "" },
      fi: { dish: "", description: "", category: "" },
      he: { dish: "", description: "", category: "" },
    },
  });

  // Generate random barcode
  const nextBarcode = () =>
    String(Math.floor(100000 + Math.random() * 900000));

  useEffect(() => {
    setForm((f) => ({ ...f, barcode: nextBarcode() }));
  }, []);

  const langData = useMemo(
    () => form.translations[activeLang],
    [form.translations, activeLang]
  );

  const setLangField = (lang, field, value) => {
    setForm((f) => ({
      ...f,
      translations: {
        ...f.translations,
        [lang]: { ...f.translations[lang], [field]: value },
      },
    }));
  };

  // ───────────────────────────────
  // Save from MetaEditorModal
  // ───────────────────────────────
  const handleSaveMeta = (payload) => {
    const allergens = payload.allergens || form.allergens;
    const additives = payload.additives || form.additives;
    const diabeticFriendly =
      typeof payload.diabeticFriendly === "boolean"
        ? payload.diabeticFriendly
        : isDiabeticFriendly(additives);

    const pictograms = derivePictogramsFromAllergens(allergens);

    setForm((prev) => ({
      ...prev,
      allergens,
      additives,
      diabeticFriendly,
      pictograms,
    }));

    setMetaOpen(false);
  };

  // ───────────────────────────────
  // Submit form
  // ───────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const en = form.translations.en || {};
    if (!en.dish?.trim() || !en.category?.trim()) {
      setMsg(t("Admin.Foods.validation.missingEn"));
      setLoading(false);
      return;
    }

    try {
      const fd = new FormData();

      // Required top-level fields
      fd.append("barcode", form.barcode);

      // NEW fields
      fd.append("dates", JSON.stringify(form.dates));
      fd.append("recurringDays", JSON.stringify(form.recurringDays));

      fd.append("allergens", JSON.stringify(form.allergens));
      fd.append("additives", JSON.stringify(form.additives));
      fd.append("pictograms", JSON.stringify(form.pictograms));
      fd.append("diabeticFriendly", JSON.stringify(form.diabeticFriendly));

      // English fallback for backend validation
      fd.append("dish", en.dish);
      fd.append("category", en.category);
      fd.append("description", en.description || "");

      // full translations JSON
      fd.append("translations", JSON.stringify(form.translations));

      if (file) fd.append("image", file);

      const res = await fetch(`${API}/admin/foods`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

      setMsg(t("Admin.Foods.added"));
      onAdded?.(data);
      setTimeout(onClose, 700);
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ───────────────────────────────
  // UI
  // ───────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-[92%] max-w-2xl shadow-lg text-gray-900 dark:text-gray-100">
        <h2 className="text-2xl font-bold mb-4">
          {t("Admin.Foods.modalTitle")}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* BARCODE */}
          <div>
            <label className="block text-sm mb-1">{t("Admin.Foods.barcode")}</label>
            <div className="flex gap-2">
              <input
                value={form.barcode}
                readOnly
                className="w-full px-3 py-2 rounded border dark:bg-gray-800"
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, barcode: nextBarcode() }))}
                className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700"
              >
                {t("Admin.Foods.regen")}
              </button>
            </div>
          </div>

          {/* TRANSLATIONS (UNCHANGED) */}
          <div>
            <div className="flex gap-2 mb-2 flex-wrap">
              {SUPPORTED_LANGS.map((lang) => (
                <button
                  type="button"
                  key={lang}
                  onClick={() => setActiveLang(lang)}
                  className={`px-3 py-1 rounded ${
                    activeLang === lang
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  {safeLangLabel(lang, t)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm mb-1">
                  {t("Admin.Foods.dish")}
                  {activeLang === "en" && <span className="text-red-500">*</span>}
                </label>
                <input
                  placeholder={t("Admin.Foods.dish")}
                  value={langData?.dish || ""}
                  onChange={(e) => setLangField(activeLang, "dish", e.target.value)}
                  className="w-full px-3 py-2 rounded border dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">
                  {t("Admin.Foods.category")}
                  {activeLang === "en" && <span className="text-red-500">*</span>}
                </label>
                <input
                  placeholder={t("Admin.Foods.category")}
                  value={langData?.category || ""}
                  onChange={(e) => setLangField(activeLang, "category", e.target.value)}
                  className="w-full px-3 py-2 rounded border dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">
                  {t("Admin.Foods.description")}
                </label>
                <textarea
                  placeholder={t("Admin.Foods.description")}
                  value={langData?.description || ""}
                  onChange={(e) => setLangField(activeLang, "description", e.target.value)}
                  className="w-full px-3 py-2 rounded border dark:bg-gray-800 min-h-[90px]"
                />
              </div>
            </div>
          </div>

          {/* IMAGE */}
          <div>
            <label className="block text-sm mb-1">
              {t("Admin.Foods.image")}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full"
            />
          </div>

          
          {/* HEALTH VALUES (MetaEditor) */}
          <div className="mt-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-semibold">{t("Admin.Users.health")}</span>
              <button
                type="button"
                onClick={() => setMetaOpen(true)}
                className="px-3 py-1 text-xs rounded bg-blue-600 text-white"
              >
                🧬 {t("Meals.MetaEditor.title")}
              </button>
            </div>

            {/* HEALTH SUMMARY */}
            <div className="flex flex-col gap-1 text-xs">
              {/* Pictograms */}
              {form.pictograms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.pictograms.map((key) => {
                    const p = PICTO_BY_KEY[key];
                    return (
                      <div
                        key={key}
                        className="w-8 h-8 border rounded flex flex-col items-center justify-center text-xs"
                        title={t(p.tKey, p.label)}
                      >
                        <span>{p.icon}</span>
                        <span>{p.key}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Allergens */}
              {form.allergens.length > 0 && (
                <div>{form.allergens.join(", ")}</div>
              )}

              {/* Additives */}
              {form.additives.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.additives.map((n) => (
                    <span key={n}>{formatAdditiveBubble(n, t)}</span>
                  ))}
                </div>
              )}

              {/* Diabetic Friendly */}
              <div>
                {t("Meals.MetaEditor.diabeticFriendly")}:{" "}
                {form.diabeticFriendly
                  ? t("Meals.MetaEditor.friendly")
                  : t("Meals.MetaEditor.notFriendly")}
              </div>
            </div>
          </div>

          {/* DATES */}
          <div className="mt-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">{t("Admin.Foods.date")}</span>
              <button
                type="button"
                onClick={() => setDateOpen(true)}
                className="px-3 py-1 text-xs rounded bg-blue-600 text-white"
              >
                🗓 {t("Admin.Foods.editDates")}
              </button>
            </div>

            {/* Dates summary */}
            {form.dates?.length > 0 && (
              <div className="text-xs mt-1">📅 {form.dates.join(", ")}</div>
            )}
            {form.recurringDays?.length > 0 && (
              <div className="text-xs">🔁 {form.recurringDays.join(", ")}</div>
            )}
            {!form.dates.length && !form.recurringDays.length && (
              <div className="text-xs text-gray-500">{t("Admin.Foods.noDates", "No dates set")}</div>
            )}
          </div>

          {msg && <p className="text-center text-sm">{msg}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-500 text-white"
            >
              {t("Calendar.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-blue-600 text-white"
            >
              {loading ? t("Admin.Users.saving") : t("Calendar.save")}
            </button>
          </div>
        </form>

        {/* MODALS */}
        <MetaEditorModal
          isOpen={metaOpen}
          onClose={() => setMetaOpen(false)}
          onSave={handleSaveMeta}
          allergens={form.allergens}
          additives={form.additives}
          diabeticFriendly={form.diabeticFriendly}
          showAllergens
          showAdditives
          showDiabeticFriendly
        />

        <DateSelectorModal
          isOpen={dateOpen}
          onClose={() => setDateOpen(false)}
          onSave={({ dates, recurringDays }) => {
            setForm((prev) => ({
              ...prev,
              dates,
              recurringDays,
            }));
            setDateOpen(false);
          }}
          initialDates={form.dates}
          initialRecurring={form.recurringDays}
        />
      </div>
    </div>
  );
}
