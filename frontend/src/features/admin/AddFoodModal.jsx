import React, { useEffect, useMemo, useState } from "react";
import { API } from "../../shared/config";
import { useTranslation } from "react-i18next";
import { LANG_LABELS } from "../../shared/constants";
import AllergenCheckboxes, {
  extractSelectedPictograms,
} from "../../components/AllergenCheckboxes.jsx";
import { useMeta } from "../../shared/metaContext.jsx";

const SUPPORTED_LANGS = ["en", "de", "fi", "he"];
const safeLangLabel = (lang, t) =>
  t(`Admin.Foods.languageTabs.${lang}`, LANG_LABELS?.[lang] || lang.toUpperCase());

export default function AddFoodModal({ onClose, onAdded }) {
  const { t } = useTranslation();
  const { pictograms } = useMeta();
  const [activeLang, setActiveLang] = useState("en");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const [form, setForm] = useState({
    barcode: "",
    date: new Date().toISOString().slice(0, 10),
    diabeticFriendly: false,
    // multilingual content
    translations: {
      en: { dish: "", description: "", category: "" },
      de: { dish: "", description: "", category: "" },
      fi: { dish: "", description: "", category: "" },
      he: { dish: "", description: "", category: "" },
    },
  });

  // ────────────────────────────────
  //  Helpers
  // ────────────────────────────────
  const nextBarcode = () =>
    String(Math.floor(100000 + Math.random() * 900000)); // 6-digit (ok for small dataset)

  useEffect(() => {
    setForm((f) => ({ ...f, barcode: nextBarcode() }));
  }, []);

  useEffect(() => {
    if (!Array.isArray(pictograms)) return;
    setForm((prev) => {
      const next = { ...prev };
      pictograms.forEach(({ key }) => {
        const field = `contains_${key}`;
        if (typeof next[field] !== "boolean") {
          next[field] = false;
        }
      });
      return next;
    });
  }, [pictograms]);

  const langData = useMemo(() => form.translations[activeLang], [form.translations, activeLang]);

  const setLangField = (lang, field, value) => {
    setForm((f) => ({
      ...f,
      translations: {
        ...f.translations,
        [lang]: { ...f.translations[lang], [field]: value },
      },
    }));
  };

  // ────────────────────────────────
  //  Submit
  // ────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const en = form.translations.en || {};
    if (!en.dish?.trim() || !en.category?.trim()) {
      setMsg(t("Admin.Foods.validation.missingEn", "English dish and category are required."));
      setLoading(false);
      return;
    }

    try {
      const fd = new FormData();

      // Core fields
      fd.append("barcode", form.barcode);
      fd.append("date", form.date);
      fd.append("diabeticFriendly", String(!!form.diabeticFriendly));

      // English fallback for backend validation
      fd.append("dish", en.dish);
      fd.append("category", en.category);
      fd.append("description", en.description || "");

      const selectedPictograms = extractSelectedPictograms(
        form,
        "contains_",
        pictograms
      );
      fd.append("pictograms", JSON.stringify(selectedPictograms));

      // full multilingual payload
      fd.append("translations", JSON.stringify(form.translations));

      if (file) fd.append("image", file);

      const res = await fetch(`${API}/admin/foods`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setMsg(t("Admin.Foods.added", "✅ Added successfully"));
      onAdded?.(data);
      setTimeout(onClose, 700);
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-[92%] max-w-2xl shadow-lg text-gray-900 dark:text-gray-100">
        <h2 className="text-2xl font-bold mb-4">
          {t("Admin.Foods.modalTitle", "Add New Food")}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Barcode (readonly) */}
          <div>
            <label className="block text-sm mb-1">
              {t("Admin.Foods.barcode", "Barcode")}
            </label>
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
                {t("Admin.Foods.regen", "Regen")}
              </button>
            </div>
          </div>

          {/* Date + Diabetic */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">{t("Calendar.date", "Date")}</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded border dark:bg-gray-800"
              />
            </div>
            <label className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={form.diabeticFriendly}
                onChange={(e) => setForm({ ...form, diabeticFriendly: e.target.checked })}
              />
              {t("Admin.Foods.diabeticFriendly", "Diabetic Friendly")}
            </label>
          </div>

          {/* Pictograms */}
          <div>
            <p className="font-semibold mb-2">
              {t("Meals.LegendHeadings.Pictograms", "Pictograms")}
            </p>
            <AllergenCheckboxes
              values={form}
              onChange={setForm}
              prefix="contains_"
            />
          </div>

          {/* Language Tabs */}
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
                  {t("Admin.Foods.dish", "Dish Name")}
                  {activeLang === "en" && <span className="text-red-500"> *</span>}
                </label>
                <input
                  placeholder={t("Admin.Foods.dish", "Dish Name")}
                  value={langData?.dish || ""}
                  onChange={(e) => setLangField(activeLang, "dish", e.target.value)}
                  className="w-full px-3 py-2 rounded border dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">
                  {t("Admin.Foods.category", "Category")}
                  {activeLang === "en" && <span className="text-red-500"> *</span>}
                </label>
                <input
                  placeholder={t("Admin.Foods.category", "Category")}
                  value={langData?.category || ""}
                  onChange={(e) => setLangField(activeLang, "category", e.target.value)}
                  className="w-full px-3 py-2 rounded border dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">
                  {t("Admin.Foods.description", "Description")}
                </label>
                <textarea
                  placeholder={t("Admin.Foods.description", "Description")}
                  value={langData?.description || ""}
                  onChange={(e) => setLangField(activeLang, "description", e.target.value)}
                  className="w-full px-3 py-2 rounded border dark:bg-gray-800 min-h-[90px]"
                />
              </div>
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm mb-1">
              {t("Meals.FoodInfo", "Food Information")} — {t("Admin.Foods.image", "Image")}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full"
            />
          </div>

          {msg && <p className="text-center text-sm">{msg}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-500 text-white"
            >
              {t("Calendar.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
            >
              {loading ? t("Admin.Users.saving", "Saving…") : t("Calendar.save", "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
