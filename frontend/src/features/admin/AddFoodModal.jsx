// frontend/src/features/admin/AddFoodModal.jsx
import React, { useState } from "react";
import { API } from "../../shared/config";
import { AVAILABLE_LANGUAGES, LANG_LABELS } from "../../shared/constants";

export default function AddFoodModal({ onClose }) {
  const [form, setForm] = useState({
    barcode: "",
    date: new Date().toISOString().slice(0, 10),
    category: "",
    diabeticFriendly: false,
  });
  const [translations, setTranslations] = useState(
    Object.fromEntries(
      AVAILABLE_LANGUAGES.map((l) => [l, { dish: "", description: "", category: "" }])
    )
  );
  const [activeLang, setActiveLang] = useState("en");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) =>
        fd.append(k, typeof v === "boolean" ? (v ? "on" : "off") : v)
      );
      if (file) fd.append("image", file);

      // append translations generically
      for (const [lang, { dish, description, category }] of Object.entries(translations)) {
        if (dish) fd.append(`dish_${lang}`, dish);
        if (description) fd.append(`description_${lang}`, description);
        if (category) fd.append(`category_${lang}`, category);
      }

      const res = await fetch(`${API}/admin/foods`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add food");

      setMsg("✅ Added successfully");
      setTimeout(onClose, 1000);
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateTranslation = (lang, key, val) =>
    setTranslations((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [key]: val },
    }));

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-[90%] max-w-2xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Add New Food</h2>

        {/* Language Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-300 dark:border-gray-700">
          {AVAILABLE_LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`px-3 py-1 rounded-t-md font-semibold ${
                activeLang === lang
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
              }`}
            >
              {LANG_LABELS[lang] || lang.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Active Language Form */}
        <div className="space-y-3 mb-4">
          <input
            placeholder={`Dish (${LANG_LABELS[activeLang]})`}
            value={translations[activeLang]?.dish || ""}
            onChange={(e) => updateTranslation(activeLang, "dish", e.target.value)}
            className="w-full px-3 py-2 rounded border dark:bg-gray-700"
            required={activeLang === "en"}
          />
          <textarea
            placeholder={`Description (${LANG_LABELS[activeLang]})`}
            value={translations[activeLang]?.description || ""}
            onChange={(e) => updateTranslation(activeLang, "description", e.target.value)}
            className="w-full px-3 py-2 rounded border dark:bg-gray-700"
            required={activeLang === "en"}
          />
        </div>

        {/* Shared Fields */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Barcode"
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            className="w-full px-3 py-2 rounded border dark:bg-gray-700"
            required
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 rounded border dark:bg-gray-700"
            required
          />
          <input
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 rounded border dark:bg-gray-700"
            required
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.diabeticFriendly}
              onChange={(e) =>
                setForm({ ...form, diabeticFriendly: e.target.checked })
              }
            />
            Diabetic Friendly
          </label>

          <div>
            <p className="font-semibold mb-1">Contains Flags</p>
            <div className="grid grid-cols-4 gap-2 text-sm">
              {["R", "S", "G", "M", "A", "W", "K", "Y"].map((c) => (
                <label key={c} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={!!form[`contains_${c}`]}
                    onChange={(e) =>
                      setForm({ ...form, [`contains_${c}`]: e.target.checked })
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full"
          />

          {msg && <p className="text-center">{msg}</p>}

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-500 text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
