// frontend/src/features/admin/FoodManager.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { API } from "../../shared/config";
import NotificationModal from "../../components/NotificationModal";
import AddFoodModal from "./AddFoodModal";
import { AVAILABLE_LANGUAGES, LANG_LABELS } from "../../shared/constants";
import { useTranslation } from "react-i18next";

export default function FoodManager() {
  const { t, i18n } = useTranslation();
  const toFoodKey = (food) => {
    const raw = food?.id ?? food?._id;
    return raw != null ? raw.toString() : "";
  };

  const activeLanguageCode = useMemo(
    () => (i18n.language || "en").split("-")[0] || "en",
    [i18n.language]
  );

  const [foods, setFoods] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [translations, setTranslations] = useState({});
  const [activeLang, setActiveLang] = useState(activeLanguageCode);
  const [viewLang, setViewLang] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("adminViewLang");
      if (saved && AVAILABLE_LANGUAGES.includes(saved)) {
        return saved;
      }
    }
    return activeLanguageCode;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const languageLabel = (lang) => LANG_LABELS[lang] || lang.toUpperCase();

  /* ───────────────────────────────
     Fetch all foods
  ─────────────────────────────── */
  const fetchFoods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/admin/foods${query ? `?q=${encodeURIComponent(query)}` : ""}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load foods");
      setFoods(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(t("Admin.Foods.messages.loadError", { message: err.message }));
      setFoods([]);
    } finally {
      setLoading(false);
    }
  }, [query, t]);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("adminViewLang", viewLang);
    }
  }, [viewLang]);

  useEffect(() => {
    setActiveLang(activeLanguageCode);
  }, [activeLanguageCode]);

  /* ───────────────────────────────
     Editing setup
  ─────────────────────────────── */
  const startEdit = (food) => {
    const key = toFoodKey(food);
    setEditingId(key);
    const t = food.translations || {};
    setTranslations(
      Object.fromEntries(
        AVAILABLE_LANGUAGES.map((l) => [
          l,
          {
            dish: t[l]?.dish || (l === "en" ? food.dish || "" : ""),
            category: t[l]?.category || (l === "en" ? food.category || "" : ""), // ✅ new
            description:
              t[l]?.description || (l === "en" ? food.description || "" : ""),
          },
        ])
      )
    );
    setEditForm({
      barcode: food.barcode || "",
      category: food.category || "",
      diabeticFriendly: !!food.diabeticFriendly,
      ...Object.fromEntries(
        ["R", "S", "G", "M", "A", "W", "K", "Y"].map((c) => [
          `contains_${c}`,
          !!food[`contains_${c}`],
        ])
      ),
    });
    setActiveLang(activeLanguageCode);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setTranslations({});
  };

  const updateTranslation = (lang, key, val) =>
    setTranslations((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [key]: val },
    }));

  /* ───────────────────────────────
     Save edited item
  ─────────────────────────────── */
  async function saveEdit(id) {
    try {
      setLoading(true);
      const body = {
        ...editForm,
        diabeticFriendly: editForm.diabeticFriendly ? "on" : "off",
      };

      // ✅ include category in language loop
      for (const [lang, { dish, description, category }] of Object.entries(
        translations
      )) {
        if (dish) body[`dish_${lang}`] = dish;
        if (description) body[`description_${lang}`] = description;
        if (category) body[`category_${lang}`] = category; // ✅ new
      }

      const res = await fetch(`${API}/admin/foods/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save");
      setSaveMsg(t("Admin.Common.messages.saved"));
      await fetchFoods();
      cancelEdit();
    } catch (err) {
      setError(t("Admin.Foods.messages.saveError", { message: err.message }));
    } finally {
      setLoading(false);
    }
  }

  /* ───────────────────────────────
     Delete (single or bulk)
  ─────────────────────────────── */
  async function deleteSelected() {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        t("Admin.Foods.messages.confirmDeleteMany", { count: selected.size })
      )
    )
      return;
    try {
      const res = await fetch(`${API}/admin/foods/bulk-delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete");
      setSaveMsg(
        t("Admin.Common.messages.deleted", { count: data.deletedCount || 0 })
      );
      setSelected(new Set());
      fetchFoods();
    } catch (err) {
      setError(t("Admin.Foods.messages.deleteError", { message: err.message }));
    }
  }

  const toggleSelect = (id) => {
    const newSet = new Set(selected);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelected(newSet);
  };

  const renderAllergenTags = (list = []) => {
    if (!list.length)
      return <span className="text-gray-400">{t("Admin.Common.labels.none")}</span>;
    return (
      <div className="flex flex-wrap gap-1 justify-center">
        {list.map((a, i) => (
          <span
            key={i}
            className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-200 text-yellow-800 dark:bg-yellow-500 dark:text-black"
          >
            {a.replace(/^contains\s*/i, "")}
          </span>
        ))}
      </div>
    );
  };

  /* ───────────────────────────────
     Render
  ─────────────────────────────── */
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {t("Admin.Foods.title")}
      </h2>
      {/* Top controls */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Admin.Foods.searchPlaceholder")}
            className="px-3 py-2 rounded border dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={fetchFoods}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            {t("Admin.Common.buttons.search")}
          </button>
        </div>

        {/* 🌍 Language preview selector */}
        <div className="flex items-center gap-2">
          <label className="font-semibold text-sm text-gray-700 dark:text-gray-300">
            {t("Admin.Common.labels.viewLanguage")}
          </label>
          <select
            value={viewLang}
            onChange={(e) => setViewLang(e.target.value)}
            className="px-3 py-2 rounded border dark:bg-gray-700 dark:border-gray-600"
          >
            {AVAILABLE_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {languageLabel(lang)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white"
          >
            ➕ {t("Admin.Foods.buttons.addFood")}
          </button>
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white"
            >
              🗑️ {t("Admin.Common.buttons.deleteSelected", { count: selected.size })}
            </button>
          )}
        </div>
      </div>

      {loading && <p>{t("Admin.Common.labels.loading")}</p>}
      {error && <p className="text-red-500">{error}</p>}
      {saveMsg && (
        <NotificationModal message={saveMsg} onClose={() => setSaveMsg(null)} />
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-400 dark:border-gray-600">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="p-2"></th>
              <th className="p-2">{t("Admin.Foods.columns.image")}</th>
              <th className="p-2">{t("Admin.Foods.columns.barcode")}</th>
              <th className="p-2">{t("Admin.Foods.columns.dish")}</th>
              <th className="p-2">{t("Admin.Foods.columns.category")}</th>
              <th className="p-2">{t("Admin.Foods.columns.description")}</th>
              <th className="p-2">{t("Admin.Foods.columns.allergens")}</th>
              <th className="p-2">{t("Admin.Foods.columns.diabetic")}</th>
              <th className="p-2">{t("Admin.Foods.columns.contains")}</th>
              <th className="p-2">{t("Admin.Foods.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {foods.map((f) => {
              const rowKey = toFoodKey(f);
              const primaryPath = f.imageURL || null;
              const fallbackPath = f.publicImageURL || null;
              return (
                <tr
                  key={rowKey || f._id}
                  className="border-t border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selected.has(rowKey)}
                      onChange={() => toggleSelect(rowKey)}
                    />
                  </td>
                  <td className="p-2 text-center">
                    {primaryPath || fallbackPath ? (
                      <FoodImageCell
                        primary={primaryPath}
                        fallback={fallbackPath}
                        alt={
                          f.translations?.[viewLang]?.dish ||
                          f.dish ||
                          t("Admin.Foods.columns.image")
                        }
                      />
                    ) : (
                      <span className="text-gray-400">
                        {t("Admin.Common.labels.noImage")}
                      </span>
                    )}
                  </td>
                  <td className="p-2">{f.barcode}</td>

                  {editingId === rowKey ? (
                    <>
                    {/* 🈯 Language Tabs */}
                    <td colSpan={3} className="p-2 align-top">
                      <div className="mb-2 flex gap-2 border-b border-gray-300 dark:border-gray-600">
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
                            {languageLabel(lang)}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <input
                          placeholder={t("Admin.Foods.forms.dish", {
                            language: languageLabel(activeLang),
                          })}
                          value={translations[activeLang]?.dish || ""}
                          onChange={(e) =>
                            updateTranslation(activeLang, "dish", e.target.value)
                          }
                          className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                        />

                        {/* ✅ new: Category input */}
                        <input
                          placeholder={t("Admin.Foods.forms.category", {
                            language: languageLabel(activeLang),
                          })}
                          value={translations[activeLang]?.category || ""}
                          onChange={(e) =>
                            updateTranslation(activeLang, "category", e.target.value)
                          }
                          className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                        />

                        <textarea
                          placeholder={t("Admin.Foods.forms.description", {
                            language: languageLabel(activeLang),
                          })}
                          value={translations[activeLang]?.description || ""}
                          onChange={(e) =>
                            updateTranslation(
                              activeLang,
                              "description",
                              e.target.value
                            )
                          }
                          className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    </td>

                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={editForm.diabeticFriendly}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            diabeticFriendly: e.target.checked,
                          })
                        }
                      />
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex flex-wrap gap-1 justify-center text-xs">
                        {["R", "S", "G", "M", "A", "W", "K", "Y"].map((c) => (
                          <label key={c} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={!!editForm[`contains_${c}`]}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  [`contains_${c}`]: e.target.checked,
                                })
                              }
                            />
                            {c}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => saveEdit(rowKey)}
                        className="px-2 py-1 bg-green-600 text-white rounded mr-1"
                      >
                        {t("Admin.Common.buttons.save")}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 bg-gray-500 text-white rounded"
                      >
                        {t("Admin.Common.buttons.cancel")}
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td
                      className={`p-2 ${
                        !f.translations?.[viewLang] ? "opacity-60 italic" : ""
                      }`}
                    >
                      {f.translations?.[viewLang]?.dish || f.dish || "-"}
                    </td>
                    {/* ✅ localized category display */}
                    <td
                      className={`p-2 ${
                        !f.translations?.[viewLang] ? "opacity-60 italic" : ""
                      }`}
                    >
                      {f.translations?.[viewLang]?.category || f.category || "-"}
                    </td>
                    <td
                      className={`p-2 ${
                        !f.translations?.[viewLang] ? "opacity-60 italic" : ""
                      }`}
                    >
                      {f.translations?.[viewLang]?.description ||
                        f.description ||
                        "-"}
                    </td>
                    <td className="p-2">{renderAllergenTags(f.allergens)}</td>
                    <td className="p-2 text-center">
                      {f.diabeticFriendly ? "✅" : "❌"}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex flex-wrap gap-1 justify-center text-xs">
                        {["R", "S", "G", "M", "A", "W", "K", "Y"].map((c) => (
                          <span
                            key={c}
                            className={`px-1 rounded ${
                              f[`contains_${c}`]
                                ? "bg-green-600 text-white"
                                : "bg-gray-500 text-gray-200"
                            }`}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => startEdit(f)}
                        className="px-2 py-1 bg-blue-600 text-white rounded mr-1"
                      >
                        {t("Admin.Common.buttons.edit")}
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            window.confirm(
                              t("Admin.Foods.messages.confirmDeleteOne")
                            )
                          ) {
                            try {
                              const res = await fetch(`${API}/admin/foods/${rowKey}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok)
                                throw new Error(data.message || `HTTP ${res.status}`);
                              fetchFoods();
                            } catch (err) {
                              setError(
                                t("Admin.Foods.messages.deleteError", {
                                  message: err.message,
                                })
                              );
                            }
                          }
                        }}
                        className="px-2 py-1 bg-red-600 text-white rounded"
                      >
                        {t("Admin.Common.buttons.delete")}
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

      {addOpen && (
        <AddFoodModal
          onClose={() => {
            setAddOpen(false);
            fetchFoods();
          }}
        />
      )}
    </div>
  );
}

const FoodImageCell = ({ primary, fallback, alt }) => {
  const { t } = useTranslation();
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    const controller = new AbortController();

    async function fetchImage() {
      const uniquePaths = Array.from(
        new Set([primary, fallback].filter(Boolean))
      );
      if (!uniquePaths.length) {
        setSrc(null);
        setError(true);
        return;
      }

      for (const path of uniquePaths) {
        try {
          const absolute = path.startsWith("http") ? path : `${API}${path}`;
          const response = await fetch(absolute, {
            credentials: "include",
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const blob = await response.blob();
          if (cancelled) return;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
          setError(false);
          return;
        } catch (err) {
          if (cancelled) return;
          console.warn("Food image fetch failed", err);
        }
      }

      if (!cancelled) {
        setSrc(null);
        setError(true);
      }
    }

    setSrc(null);
    setError(false);
    fetchImage();

    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [primary, fallback]);

  if (error) {
    return (
      <span className="text-gray-400 text-sm">
        {t("Admin.Common.labels.imageUnavailable")}
      </span>
    );
  }

  if (!src) {
    return (
      <span className="text-gray-400 text-sm">
        {t("Admin.Common.labels.loading")}
      </span>
    );
  }

  return (
    <img src={src} alt={alt} className="w-12 h-12 object-cover rounded mx-auto" />
  );
};

