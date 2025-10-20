//frontend/src/features/admin/UserManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API } from "../../shared/config";
import {
  COUNTRIES,
  LANG_LABELS,
  AVAILABLE_LANGUAGES,
} from "../../shared/constants";
import NotificationModal from "../../components/NotificationModal";
import AddUserModal from "./AddUserModal";
import ResetPasswordModal from "./ResetPasswordModal";
import { useTranslation } from "react-i18next";
import { useContext } from "react";
import { AppContext } from "../../shared/AppContext";

export default function UserManager() {
  const { t } = useTranslation();

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

  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const { user, setUser } = useContext(AppContext);

  // ────────────────────────────────
  //  Load all users
  // ────────────────────────────────
  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/users`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  // ────────────────────────────────
  //  Helpers
  // ────────────────────────────────
  const pictogramLabel = (key) =>
    t(`Meals.Legend.Pictograms.${key}`, key);

  // ────────────────────────────────
  //  Editing & Saving
  // ────────────────────────────────
  const startEdit = (u) => {
    setEditingId(u._id || u.id);
    setEditForm({
      fullName: u.fullName || "",
      username: u.username || "",
      email: u.email || "",
      phoneNumber: u.phoneNumber || "",
      address: u.address || "",
      gender: u.gender || "other",
      country: u.country || "",
      language: u.language || "",
      Diabetic: u.Diabetic ?? false,
      ...ALLERGEN_KEYS.reduce(
        (acc, { key }) => ({ ...acc, [key]: !!u[key] }),
        {}
      ),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setSaveMsg(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const saveEdit = async (u) => {
    try {
      // clone form
      const payload = { ...editForm };
  
      // 🔒 Safety check — only split if Allergens field exists
      if (typeof payload.Allergens === "string") {
        payload.Allergens = payload.Allergens
          .split(",")
          .map((a) => a.trim())
          .filter((a) => a);
      }
  
      // if the Allergens text field doesn't exist in edit mode, ensure it's an array
      if (!payload.Allergens) {
        payload.Allergens = [];
      }
  
      const res = await fetch(`${API}/admin/users/${u._id || u.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Save failed (${res.status})`);
      if (editingId && user && (user._id === editingId || user.id === editingId)) {
        // If admin edited their own profile, sync context too
        setUser((prev) => ({ ...prev, ...payload }));
      }
      setSaveMsg("✅ Saved");
      setEditingId(null);
      setEditForm({});
      await fetchUsers(); // 🔥 force refresh from backend to get up-to-date values
    } catch (err) {
      console.error(err);
      setSaveMsg(`❌ ${err.message}`);
    } finally {
      setTimeout(() => setSaveMsg(null), 2500);
    }
  };

  // ────────────────────────────────
  //  Selection & Bulk Delete
  // ────────────────────────────────
  const toggleSelect = (id) => {
    const copy = new Set(selected);
    copy.has(id) ? copy.delete(id) : copy.add(id);
    setSelected(copy);
  };

  const handleDeleteSelected = async () => setConfirmOpen(true);

  const confirmDelete = async () => {
    setConfirmOpen(false);
    try {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      const res = await fetch(`${API}/admin/users/bulk-delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`);
      setUsers((prev) => prev.filter((u) => !selected.has(u._id)));
      setSelected(new Set());
      setSaveMsg(
        t("Admin.Users.deleted", { count: ids.length, defaultValue: "🗑️ Deleted {{count}} user(s)" })
      );
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (err) {
      console.error(err);
      setSaveMsg(`❌ ${err.message}`);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.fullName, u.username, u.email].some((v) =>
        (v || "").toLowerCase().includes(q)
      )
    );
  }, [users, query]);

  // ────────────────────────────────
  //  Render
  // ────────────────────────────────
  return (
    <div className="p-4 text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-2xl font-semibold">
          {t("Admin.Users.title", "User Manager")}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            {t("Admin.Users.addUser", "+ Add New User")}
          </button>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Admin.Users.search", "Search name, username, or email…")}
            className="px-3 py-1 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
          {selected.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={confirmOpen}
              className={`px-3 py-1 rounded text-white transition ${
                confirmOpen
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {t("Admin.Users.deleteSelected", {
                count: selected.size,
                defaultValue: "Delete Selected ({{count}})",
              })}
            </button>
          )}
          <button
            onClick={fetchUsers}
            className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
          >
            {t("Admin.Users.refresh", "Refresh")}
          </button>
        </div>
      </div>

      {loading && <div>{t("Admin.Users.loading", "Loading users…")}</div>}
      {error && (
        <div className="p-2 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto w-full">
        <table className="min-w-full text-sm border border-gray-400 dark:border-gray-700 rounded-lg text-left align-middle">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <th className="p-2"></th>
              <th className="p-2">{t("Admin.Users.username", "Username")}</th>
              <th className="p-2">{t("Admin.Users.email", "Email")}</th>
              <th className="p-2">{t("Admin.Users.fullName", "Full Name")}</th>
              <th className="p-2">{t("Admin.Users.gender", "Gender")}</th>
              <th className="p-2">{t("Admin.Users.country", "Country")}</th>
              <th className="p-2">{t("Admin.Users.language", "Language")}</th>
              <th className="p-2">{t("Admin.Users.health", "Health")}</th>
              <th className="p-2 text-center">{t("Admin.Users.actions", "Actions")}</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((u) => {
              const isEditing = editingId === (u._id || u.id);
              return (
                <tr key={u._id || u.id}>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selected.has(u._id)}
                      onChange={() => toggleSelect(u._id)}
                    />
                  </td>

                  {isEditing ? (
                    <>
                      {/* Edit mode */}
                      <td className="p-2">
                        <input
                          name="username"
                          value={editForm.username}
                          onChange={handleChange}
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border p-1"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          name="email"
                          value={editForm.email}
                          onChange={handleChange}
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border p-1"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          name="fullName"
                          value={editForm.fullName}
                          onChange={handleChange}
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border p-1"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          name="gender"
                          value={editForm.gender}
                          onChange={handleChange}
                          className="w-full rounded border bg-gray-100 dark:bg-gray-900"
                        >
                          <option value="male">{t("Auth.Register.genderMale")}</option>
                          <option value="female">{t("Auth.Register.genderFemale")}</option>
                          <option value="other">{t("Auth.Register.genderOther")}</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          name="country"
                          value={editForm.country}
                          onChange={handleChange}
                          className="w-full rounded border bg-gray-100 dark:bg-gray-900"
                        >
                          <option value="">
                            {t("Admin.Users.selectCountry", "Select Country")}
                          </option>
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          name="language"
                          value={editForm.language}
                          onChange={handleChange}
                          className="w-full rounded border bg-gray-100 dark:bg-gray-900"
                        >
                          <option value="">
                            {t("Admin.Users.selectLanguage", "Select Language")}
                          </option>
                          {(
                            COUNTRIES.find(
                              (c) => c.code === editForm.country
                            )?.languages || AVAILABLE_LANGUAGES
                          ).map((lang) => (
                            <option key={lang} value={lang}>
                              {LANG_LABELS[lang]}
                            </option>
                          ))}
                        </select>
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
                                name={key}
                                checked={!!editForm[key]}
                                onChange={handleChange}
                              />
                              <span>{icon}</span>
                              <span>{pictogramLabel(key)}</span>
                            </label>
                          ))}
                        </div>
                        <label className="flex items-center text-xs mt-1">
                          <input
                            type="checkbox"
                            name="Diabetic"
                            checked={editForm.Diabetic}
                            onChange={handleChange}
                            className="mr-1"
                          />
                          {t("Meals.diabeticFriendlyLabel")}
                        </label>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => saveEdit(u)}
                          className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded mr-1"
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
                  ) : (
                    <>
                      {/* Read-only */}
                      <td className="p-2">{u.username || "—"}</td>
                      <td className="p-2">{u.email || "—"}</td>
                      <td className="p-2">{u.fullName}</td>
                      <td className="p-2 capitalize">{u.gender}</td>
                      <td className="p-2">{u.country}</td>
                      <td className="p-2">{u.language}</td>
                      <td className="p-2">
                       <div className="flex flex-wrap gap-1">
                          {ALLERGEN_KEYS.filter(({ key }) => u[key]).map(({ key, icon }) => (
                            <div
                              key={key}
                              className="w-8 h-8 flex flex-col items-center justify-center text-xs font-semibold border border-gray-400 dark:border-gray-600 rounded-md"
                              title={pictogramLabel(key)}
                            >
                              <span className="text-base leading-none">{icon}</span>
                              <span className="leading-none">{key}</span>
                            </div>
                          ))}
                        </div>
                        {u.Diabetic && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {t("Meals.diabeticFriendlyLabel")}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => startEdit(u)}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {t("Admin.Users.edit", "Edit")}
                        </button>
                        <button
                          onClick={() => setResetTarget(u)}
                          className="text-red-600 dark:text-red-400 hover:underline ml-2"
                        >
                          {t("Admin.Users.resetPassword", "Reset Password")}
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

      {saveMsg && (
        <div className="mt-2 text-sm text-center text-green-600 dark:text-green-400">
          {saveMsg}
        </div>
      )}

      <ResetPasswordModal
        open={!!resetTarget}
        user={resetTarget}
        onClose={() => setResetTarget(null)}
      />
      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(newUser) => {
          setUsers((prev) => [newUser, ...prev]);
          setSaveMsg(t("Admin.Users.added", "✅ User added successfully"));
          setTimeout(() => setSaveMsg(null), 2500);
        }}
      />
      <NotificationModal
        open={confirmOpen}
        title={t("Admin.Users.confirmDelete", "Confirm deletion")}
        message={t("Admin.Users.confirmMessage", {
          count: selected.size,
          defaultValue:
            "Are you sure you want to delete {{count}} selected user(s)? This cannot be undone.",
        })}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        confirmText={t("Admin.Users.delete", "Delete")}
        cancelText={t("Admin.Users.cancel", "Cancel")}
      />
    </div>
  );
}
