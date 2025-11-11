// frontend/src/features/admin/FoodManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API } from "../../shared/config";
import { useTranslation } from "react-i18next";
import AddFoodModal from "./AddFoodModal";
import { QRCodeCanvas } from "qrcode.react";
import MetaEditorModal from "../../components/MetaEditorModal";

// Shared meta utils (single source of truth)
import {
  PICTO_BY_KEY,
  derivePictogramsFromAllergens,
  isDiabeticFriendly,
  formatAdditiveBubble,
  formatAdditiveTag,
  PICTOGRAM_ORDER,
} from "../../../../shared/constants/foodMeta.utils.js";

// Supported UI languages for inline translation editing
const SUPPORTED_LANGS = ["en", "de", "fi", "he"];

function getLocalized(food, lang) {
  const t = food?.translations || {};
  return t[lang] || t.en || t[Object.keys(t)[0]] || { dish: "", description: "", category: "" };
}

// Normalize additives to numbers (schema may contain strings from legacy)
const normalizeAdditives = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((v) => (typeof v === "string" ? Number(v) : v))
    .filter((v) => !Number.isNaN(v));

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

  // Meta modal state (draft editing like in UserManager)
  const [metaOpen, setMetaOpen] = useState(false);

  // ───────────────── Data loading ─────────────────
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

  // ───────────────── Editing helpers ─────────────────
  function startEdit(food) {
    setEditingId(food.id);
    const uiLang = SUPPORTED_LANGS.includes(i18n.language) ? i18n.language : "en";

    // Normalize additives to numbers; keep allergens/pictograms as arrays of strings
    const additives = normalizeAdditives(food.additives);

    setEditForm({
      id: food.id,
      barcode: food.barcode || "",
      date: (food.date || "").slice?.(0, 10) || "",

      // unified meta fields
      allergens: Array.isArray(food.allergens) ? [...food.allergens] : [],
      additives,
      pictograms:
        Array.isArray(food.pictograms) && food.pictograms.length > 0
          ? [...food.pictograms]
          : derivePictogramsFromAllergens(Array.isArray(food.allergens) ? food.allergens : []),

      // diabeticFriendly as a *draft* value (computed OR stored)
      diabeticFriendly:
        typeof food.diabeticFriendly === "boolean"
          ? food.diabeticFriendly
          : isDiabeticFriendly(additives),

      // translations
      translations: {
        en: { dish: "", description: "", category: "", ...(food.translations?.en || {}) },
        de: { dish: "", description: "", category: "", ...(food.translations?.de || {}) },
        fi: { dish: "", description: "", category: "", ...(food.translations?.fi || {}) },
        he: { dish: "", description: "", category: "", ...(food.translations?.he || {}) },
      },
      uiLang,
    });
    setEditFile(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setEditFile(null);
    setSaveMsg(null);
  }

  // Save (PUT) — sends unified meta fields and translations/image
  async function saveEdit() {
    try {
      const en = editForm.translations?.en || {};
      if (!en.dish?.trim() || !en.category?.trim()) {
        setSaveMsg(t("Admin.Foods.validation.missingEn", "English dish and category are required."));
        return;
      }

      // Prepare FormData (keep your existing pattern)
      const fd = new FormData();
      fd.append("barcode", editForm.barcode || "");
      if (editForm.date) fd.append("date", editForm.date);

      // Meta payload
      const allergens = Array.isArray(editForm.allergens) ? editForm.allergens : [];
      const additives = normalizeAdditives(editForm.additives);

      // If pictograms not explicitly set, derive from allergens
      const pictograms =
        Array.isArray(editForm.pictograms) && editForm.pictograms.length
          ? editForm.pictograms
          : derivePictogramsFromAllergens(allergens);

      // ✅ Prefer manual toggle; fallback to additive-based safety
      const diabeticFriendly =
        typeof editForm.diabeticFriendly === "boolean"
          ? editForm.diabeticFriendly
          : isDiabeticFriendly(additives);

      // Append unified meta
      fd.append("allergens", JSON.stringify(allergens));
      fd.append("additives", JSON.stringify(additives));
      fd.append("pictograms", JSON.stringify(pictograms));
      fd.append("diabeticFriendly", JSON.stringify(!!diabeticFriendly));

      // Translations
      fd.append("translations", JSON.stringify(editForm.translations));

      // Image
      if (editFile) fd.append("image", editFile);

      const res = await fetch(`${API}/admin/foods/${editForm.id}`, {
        method: "PUT",
        credentials: "include",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setSaveMsg(t("Admin.Users.saved", "✅ Saved successfully"));

      
    // Merge updated food into the local list immediately
    setFoods((prev) =>
      prev.map((food) =>
        food.id === editForm.id
          ? {
              ...food,
              allergens: editForm.allergens,
              additives: editForm.additives,
              pictograms: editForm.pictograms,
              diabeticFriendly: editForm.diabeticFriendly,
              translations: editForm.translations,
              barcode: editForm.barcode,
              date: editForm.date,
              category: editForm.translations?.en?.category || food.category,
              dish: editForm.translations?.en?.dish || food.dish,
              description: editForm.translations?.en?.description || food.description,
            }
          : food
      )
    );

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

  // Meta editor save (draft only — mirrors UserManager pattern)
  const handleSaveMeta = (payload) => {
    // payload: { allergens?, additives?, diabetic? }
    setEditForm((prev) => {
      const next = { ...prev };

      if (payload.allergens) {
        next.allergens = [...payload.allergens];
      }
      if (payload.additives) {
        next.additives = normalizeAdditives(payload.additives);
      }

      // Always re-derive pictograms from allergens for draft display
      const allergenSrc = payload.allergens ? payload.allergens : next.allergens || [];
      next.pictograms = derivePictogramsFromAllergens(allergenSrc);

      // Diabetic-friendly (draft rule):
      // true if user toggled "friendly" (payload.diabetic === true) OR safe by additives
      const addSrc = payload.additives ? normalizeAdditives(payload.additives) : next.additives;
      const safeByAdditives = isDiabeticFriendly(addSrc);
      // Determine source of truth for diabeticFriendly
      const modalToggle =
        payload.hasOwnProperty("diabeticFriendly")
          ? !!payload.diabeticFriendly
          : payload.hasOwnProperty("diabetic")
          ? !!payload.diabetic
          : next.diabeticFriendly;

      // Respect manual toggle first, fallback to additive logic
      next.diabeticFriendly =
      typeof modalToggle === "boolean" ? modalToggle : safeByAdditives;

      return next;
    });

    setMetaOpen(false);
  };

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

      <div className="overflow-x-auto overflow-y-auto w-full" style={{ maxHeight: "70vh" }}>
        <table className="min-w-full text-sm border border-gray-400 dark:border-gray-700 rounded-lg text-left align-middle">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <th className="p-2">#</th>
              <th className="p-2">{t("Admin.Foods.image", "Image")}</th>
              <th className="p-2">{t("Admin.Foods.dish", "Dish Name")}</th>
              <th className="p-2">{t("Admin.Foods.barcode", "Barcode")}</th>
              <th className="p-2">{t("Admin.Foods.category", "Category")}</th>
              <th className="p-2">{t("Admin.Foods.date", "Date")}</th>
              <th className="p-2">{t("Admin.Users.health", "Health")}</th>
              <th className="p-2 text-center">{t("Admin.Users.actions", "Actions")}</th>
            </tr>
          </thead>

          <tbody>
            {filteredFoods.map((f) => {
              const isEditing = editingId === f.id;
              const loc = getLocalized(isEditing ? editForm : f, i18n.language);

              // Calculate row display values
              const additives = isEditing ? editForm.additives : normalizeAdditives(f.additives);
              const pictos = isEditing
                ? editForm.pictograms
                : (Array.isArray(f.pictograms) && f.pictograms.length
                    ? f.pictograms
                    : derivePictogramsFromAllergens(f.allergens || []));
              const diabetic = isEditing ? editForm.diabeticFriendly : f.diabeticFriendly;

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
                    {isEditing && (
                      <div className="mt-2">
                        <label className="block text-xs mb-1">{t("Admin.Foods.image", "Image")}</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </td>

                  {!isEditing ? (
                    <>
                      {/* Dish (read-only) */}
                      <td className="p-2">{loc.dish || "—"}</td>

                      {/* Barcode (with QR) */}
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

                      {/* Category */}
                      <td className="p-2">{loc.category || "—"}</td>

                      {/* Date (keep + placeholder note) */}
                      <td className="p-2">
                        <div>{f.date?.slice?.(0, 10) || "—"}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">🕒 To be implemented</div>
                      </td>

                      {/* Health (READ ONLY): pictograms + additives bubbles + diabetic label */}
                      <td className="p-2">
                        <div className="flex flex-col gap-1">
                          {/* Pictograms */}
                          <div className="flex flex-wrap gap-1">
                            {pictos
                              ?.slice()
                              .sort((a, b) => PICTOGRAM_ORDER.indexOf(a) - PICTOGRAM_ORDER.indexOf(b))
                              .map((key) => {
                                const p = PICTO_BY_KEY[key];
                                return (
                                  <div
                                    key={key}
                                    className="w-8 h-8 flex flex-col items-center justify-center text-xs font-semibold border border-gray-400 dark:border-gray-600 rounded-md"
                                    title={t(p?.tKey, p?.label || key)}
                                  >
                                    <span className="text-base leading-none">{p?.icon || key}</span>
                                    <span className="leading-none">{p?.key || key}</span>
                                  </div>
                                );
                              })}
                          </div>

                          {/* Additives — Option A (compact bubbles) */}
                          <div className="flex flex-wrap gap-1 text-xs">
                            {additives?.map((n) => (
                              <span key={n} className="px-1">
                                {formatAdditiveBubble(n, t)}
                              </span>
                            ))}
                          </div>

                          {/* DiabeticFriendly */}
                          <div className="text-xs font-medium">
                            {t("Meals.MetaEditor.diabeticFriendly", "Diabetic Friendly")}:{" "}
                            <span className="font-semibold">
                              {diabetic
                                ? t("Meals.MetaEditor.friendly", "Diabetic-Friendly ✅")
                                : t("Meals.MetaEditor.notFriendly", "Not Diabetic-Friendly ❌")}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
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
                      {/* Dish + translations (EDIT) */}
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

                      {/* Barcode + QR (unchanged) */}
                      <td className="p-2">
                        <div className="flex flex-col items-start gap-1">
                          <input
                            value={editForm.barcode || ""}
                            onChange={(e) =>
                              setEditForm((ef) => ({ ...ef, barcode: e.target.value }))
                            }
                            className="w-full rounded bg-gray-100 dark:bg-gray-900 border p-1"
                            placeholder={t("Admin.Foods.barcode", "Barcode")}
                          />
                          {editForm.barcode && (
                            <QRCodeCanvas
                              value={editForm.barcode}
                              size={70}
                              bgColor="white"
                              fgColor="black"
                              includeMargin={true}
                              style={{ border: "1px solid #ccc", borderRadius: "4px" }}
                            />
                          )}
                        </div>
                      </td>

                      {/* Category + description + image */}
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
                      </td>

                      {/* Date (keep + placeholder note) */}
                      <td className="p-2">
                        <input
                          type="date"
                          value={editForm.date || ""}
                          onChange={(e) =>
                            setEditForm((ef) => ({ ...ef, date: e.target.value }))
                          }
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border p-1"
                        />
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">🕒 To be implemented</div>
                      </td>

                      {/* Health (EDIT): pictograms + additives tags + diabetic label + Edit button */}
                      <td className="p-2 align-top">
                        <div className="flex flex-col gap-2">
                          {/* Pictograms live preview */}
                          <div className="flex flex-wrap gap-1">
                            {editForm.pictograms
                              ?.slice()
                              .sort((a, b) => PICTOGRAM_ORDER.indexOf(a) - PICTOGRAM_ORDER.indexOf(b))
                              .map((key) => {
                                const p = PICTO_BY_KEY[key];
                                return (
                                  <div
                                    key={key}
                                    className="w-8 h-8 flex flex-col items-center justify-center text-xs font-semibold border border-gray-400 dark:border-gray-600 rounded-md"
                                    title={t(p?.tKey, p?.label || key)}
                                  >
                                    <span className="text-base leading-none">{p?.icon || key}</span>
                                    <span className="leading-none">{p?.key || key}</span>
                                  </div>
                                );
                              })}
                          </div>

                          {/* Additives — Option B (rectangle tags) */}
                          <div className="flex flex-wrap gap-1">
                            {(editForm.additives || []).map((n) => {
                              const tag = formatAdditiveTag(n, t);
                              return (
                                <span
                                  key={n}
                                  className="px-2 py-0.5 border border-gray-300 dark:border-gray-700 rounded text-xs"
                                  title={tag.label}
                                >
                                  {tag.display}
                                </span>
                              );
                            })}
                          </div>

                          {/* DiabeticFriendly (edit) */}
                          <div className="text-xs font-medium">
                            {t("Meals.MetaEditor.diabeticFriendly", "Diabetic Friendly")}:{" "}
                            <span className="font-semibold">
                              {diabetic
                                ? t("Meals.MetaEditor.friendly", "Diabetic-Friendly ✅")
                                : t("Meals.MetaEditor.notFriendly", "Not Diabetic-Friendly ❌")}
                            </span>
                          </div>

                          {/* Open MetaEditor button */}
                          <button
                            onClick={() => setMetaOpen(true)}
                            className="mt-1 px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white self-start"
                          >
                            🧬 {t("Meals.MetaEditor.title")}
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
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

      {/* Add Food */}
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

      {/* Meta Editor (draft updates only; save button commits via PUT) */}
      <MetaEditorModal
        isOpen={metaOpen}
        onClose={() => setMetaOpen(false)}
        onSave={handleSaveMeta}
        allergens={editForm?.allergens || []}
        additives={editForm?.additives || []}
        diabeticFriendly={editForm?.diabeticFriendly ?? false}
        showAllergens={true}
        showAdditives={true}
        showDiabeticFriendly={true}
        editableAllergens={true}
        editableAdditives={true}
        editableDiabeticFriendly={true}
      />
    </div>
  );
}
