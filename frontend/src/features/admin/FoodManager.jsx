// frontend/src/features/admin/FoodManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API } from "../../shared/config";
import { useTranslation } from "react-i18next";
import AddFoodModal from "./AddFoodModal";
import { QRCodeCanvas } from "qrcode.react";

const ALLERGEN_KEYS = [
  { key: "R", icon: "🥩" },
  { key: "S", icon: "🐷" },
  { key: "G", icon: "🐔" },
  { key: "M", icon: "🥛" },
  { key: "A", icon: "🍷" },
  { key: "W", icon: "🌾" },
  { key: "K", icon: "🧄" },
  { key: "Y", icon: "🌱" },
];
const SUPPORTED_LANGS = ["en", "de", "fi", "he"];

function getLocalized(food, lang) {
  const t = food?.translations || {};
  return t[lang] || t.en || t[Object.keys(t)[0]] || { dish: "", description: "", category: "" };
}

export default function FoodManager() {
  const { t, i18n } = useTranslation();
  const [foods, setFoods] = useState([]);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editFile, setEditFile] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchFoods() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/foods`, { credentials: "include" });
      const data = await res.json();
      setFoods(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFoods();
  }, []);

  const filteredFoods = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter((f) => {
      const loc = getLocalized(f, i18n.language);
      return [loc.dish, loc.category, loc.description].some((s) =>
        (s || "").toLowerCase().includes(q)
      );
    });
  }, [foods, query, i18n.language]);

  function startEdit(food) {
    setEditingId(food.id);
    const b = {};
    ALLERGEN_KEYS.forEach(({ key }) => (b[key] = !!food[`contains_${key}`] || !!food[key]));
    setEditForm({
      id: food.id,
      barcode: food.barcode || "",
      date: (food.date || "").slice?.(0, 10) || "",
      diabeticFriendly: !!food.diabeticFriendly,
      ...b,
      translations: {
        en: { dish: "", description: "", category: "", ...(food.translations?.en || {}) },
        de: { dish: "", description: "", category: "", ...(food.translations?.de || {}) },
        fi: { dish: "", description: "", category: "", ...(food.translations?.fi || {}) },
        he: { dish: "", description: "", category: "", ...(food.translations?.he || {}) },
      },
      uiLang: SUPPORTED_LANGS.includes(i18n.language) ? i18n.language : "en",
    });
    setEditFile(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setEditFile(null);
    setSaveMsg(null);
  }

  async function saveEdit() {
    try {
      const en = editForm.translations?.en || {};
      if (!en.dish?.trim() || !en.category?.trim()) {
        setSaveMsg(t("Admin.Foods.validation.missingEn", "English dish and category are required."));
        return;
      }

      const fd = new FormData();
      fd.append("barcode", editForm.barcode || "");
      if (editForm.date) fd.append("date", editForm.date);
      fd.append("diabeticFriendly", String(!!editForm.diabeticFriendly));
      ALLERGEN_KEYS.forEach(({ key }) => fd.append(`contains_${key}`, String(!!editForm[key])));
      fd.append("translations", JSON.stringify(editForm.translations));
      if (editFile) fd.append("image", editFile);

      const res = await fetch(`${API}/admin/foods/${editForm.id}`, {
        method: "PUT",
        credentials: "include",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setSaveMsg(t("Admin.Users.saved", "✅ Saved successfully"));
      setEditingId(null);
      setEditForm({});
      setEditFile(null);
      await fetchFoods();
    } catch (err) {
      console.error(err);
      setSaveMsg(`❌ ${err.message}`);
    } finally {
      setTimeout(() => setSaveMsg(null), 2500);
    }
  }

  async function deleteFood(food) {
    if (!confirm(t("Admin.Foods.confirmDelete", "Delete this food?"))) return;
    try {
      const res = await fetch(`${API}/admin/foods/${food.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setFoods((prev) => prev.filter((f) => f.id !== food.id));
    } catch (err) {
      console.error(err);
      setSaveMsg(`❌ ${err.message}`);
      setTimeout(() => setSaveMsg(null), 2500);
    }
  }

  const imageUrl = (id) => `${API}/admin/foods/${id}/image`;

  return (
    <div className="p-4 text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-2xl font-semibold">{t("Admin.Foods.title", "Food Manager")}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            {t("Admin.Foods.add", "+ Add New Food")}
          </button>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Meals.searchPlaceholder", "Search for food by name...")}
            className="px-3 py-1 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={fetchFoods}
            className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
          >
            {t("Admin.Users.refresh", "Refresh")}
          </button>
        </div>
      </div>

      {loading && <div>{t("Meals.loadingLabel", "Loading...")}</div>}

      <div className="overflow-x-auto w-full">
        <table className="min-w-full text-sm border border-gray-400 dark:border-gray-700 rounded-lg text-left align-middle">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <th className="p-2">#</th>
              <th className="p-2">{t("Admin.Foods.image", "Image")}</th>
              <th className="p-2">{t("Admin.Foods.dish", "Dish Name")}</th>
              <th className="p-2">{t("Admin.Foods.barcode", "Barcode")}</th>
              <th className="p-2">{t("Admin.Foods.category", "Category")}</th>
              <th className="p-2">{t("Meals.diabeticFriendlyLabel", "Diabetic friendly")}</th>
              <th className="p-2">{t("Meals.LegendHeadings.Pictograms", "Pictograms")}</th>
              <th className="p-2 text-center">{t("Admin.Users.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredFoods.map((f) => {
              const isEditing = editingId === f.id;
              const loc = getLocalized(isEditing ? editForm : f, i18n.language);

              return (
                <tr key={f.id}>
                  <td className="p-2 font-semibold">{f.id}</td>
                  <td className="p-2">
                    <img
                      src={imageUrl(f.id)}
                      alt={loc.dish || `food-${f.id}`}
                      className="w-14 h-14 object-cover rounded border border-gray-300 dark:border-gray-700"
                      onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                    />
                  </td>
                  {!isEditing ? (
                    <>
                      <td className="p-2">{loc.dish || "—"}</td>

                      <td className="p-2">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-mono text-xs">{f.barcode || "—"}</span>
                        {f.barcode && (
                          <QRCodeCanvas
                            value={f.barcode}
                            size={70}
                            bgColor="white"
                            fgColor="black"
                            includeMargin={true}
                            style={{ cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px" }}
                            onClick={(e) => {
                              // auto-download on click
                              const canvas = e.target;
                              const url = canvas.toDataURL("image/png");
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `barcode-${f.barcode}.png`;
                              a.click();
                            }}
                          />
                        )}
                      </div>
                    </td>

                      <td className="p-2">{loc.category || "—"}</td>
                      <td className="p-2">
                        {f.diabeticFriendly
                          ? t("Meals.diabeticFriendlyYes", "Yes")
                          : t("Meals.diabeticFriendlyNo", "No")}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {ALLERGEN_KEYS.filter(({ key }) => f[`contains_${key}`] || f[key]).map(
                            ({ key, icon }) => (
                              <div
                                key={key}
                                className="w-8 h-8 flex flex-col items-center justify-center text-xs font-semibold border border-gray-400 dark:border-gray-600 rounded-md"
                                title={t(`Meals.Legend.Pictograms.${key}`, key)}
                              >
                                <span className="text-base leading-none">{icon}</span>
                                <span className="leading-none">{key}</span>
                              </div>
                            )
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => startEdit(f)}
                          className="text-blue-600 dark:text-blue-400 hover:underline mr-3"
                        >
                          {t("Admin.Foods.edit", "Edit")}
                        </button>
                        <button
                          onClick={() => deleteFood(f)}
                          className="text-red-600 dark:text-red-400 hover:underline"
                        >
                          {t("Admin.Foods.delete", "Delete")}
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {SUPPORTED_LANGS.map((lang) => (
                            <button
                              type="button"
                              key={lang}
                              onClick={() =>
                                setEditForm((ef) => ({ ...ef, uiLang: lang }))
                              }
                              className={`px-2 py-1 rounded ${
                                editForm.uiLang === lang
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-200 dark:bg-gray-700"
                              }`}
                            >
                              {lang.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <input
                          value={editForm.translations?.[editForm.uiLang]?.dish || ""}
                          onChange={(e) =>
                            setEditForm((ef) => ({
                              ...ef,
                              translations: {
                                ...ef.translations,
                                [ef.uiLang]: {
                                  ...ef.translations[ef.uiLang],
                                  dish: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border p-1"
                          placeholder={t("Admin.Foods.dish", "Dish Name")}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          value={editForm.translations?.[editForm.uiLang]?.category || ""}
                          onChange={(e) =>
                            setEditForm((ef) => ({
                              ...ef,
                              translations: {
                                ...ef.translations,
                                [ef.uiLang]: {
                                  ...ef.translations[ef.uiLang],
                                  category: e.target.value,
                                },
                              },
                            }))
                          }
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border p-1"
                          placeholder={t("Admin.Foods.category", "Category")}
                        />
                        <textarea
                          value={editForm.translations?.[editForm.uiLang]?.description || ""}
                          onChange={(e) =>
                            setEditForm((ef) => ({
                              ...ef,
                              translations: {
                                ...ef.translations,
                                [ef.uiLang]: {
                                  ...ef.translations[ef.uiLang],
                                  description: e.target.value,
                                },
                              },
                            }))
                          }
                          className="mt-2 w-full rounded bg-gray-100 dark:bg-gray-900 border p-1 min-h-[60px]"
                          placeholder={t("Admin.Foods.description", "Description")}
                        />
                        <div className="mt-2">
                          <label className="block text-xs mb-1">{t("Admin.Foods.image", "Image")}</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                          />
                        </div>
                      </td>
                      <td className="p-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!editForm.diabeticFriendly}
                            onChange={(e) =>
                              setEditForm((ef) => ({
                                ...ef,
                                diabeticFriendly: e.target.checked,
                              }))
                            }
                          />
                          {t("Meals.diabeticFriendlyLabel")}
                        </label>
                      </td>
                      <td className="p-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {ALLERGEN_KEYS.map(({ key, icon }) => (
                            <label
                              key={key}
                              className="flex items-center gap-1 border border-gray-300 dark:border-gray-700 rounded p-1"
                            >
                              <input
                                type="checkbox"
                                checked={!!editForm[key]}
                                onChange={(e) =>
                                  setEditForm((ef) => ({ ...ef, [key]: e.target.checked }))
                                }
                              />
                              <span>{icon}</span>
                              <span>{t(`Meals.Legend.Pictograms.${key}`, key)}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <button
                          onClick={saveEdit}
                          className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded mr-2"
                        >
                          {t("Admin.Users.save", "Save")}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="bg-gray-500 hover:bg-gray-400 text-white px-3 py-1 rounded"
                        >
                          {t("Admin.Users.cancel", "Cancel")}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {saveMsg && <div className="mt-2 text-sm text-center">{saveMsg}</div>}

      {addOpen && (
        <AddFoodModal
          onClose={() => setAddOpen(false)}
          onAdded={(newFood) => {
            setFoods((prev) => [newFood, ...prev]);
            setSaveMsg(t("Admin.Foods.added", "✅ Added successfully"));
            setTimeout(() => setSaveMsg(null), 2000);
          }}
        />
      )}
    </div>
  );
}
