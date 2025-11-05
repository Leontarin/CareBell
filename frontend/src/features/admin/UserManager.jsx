// frontend/src/features/admin/UserManager.jsx
import React, { useEffect, useMemo, useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import { API } from "../../shared/config";
import {
  COUNTRIES,
  LANG_LABELS,
  AVAILABLE_LANGUAGES,
} from "../../shared/constants";
import { PICTO_BY_KEY,derivePictogramsFromAllergens } from "../../../../shared/constants/foodMeta.utils.js";
import MetaEditorModal from "../../components/MetaEditorModal";
import NotificationModal from "../../components/NotificationModal";
import AddUserModal from "./AddUserModal";
import ResetPasswordModal from "./ResetPasswordModal";
import { AppContext } from "../../shared/AppContext";

export default function UserManager() {
  const { t } = useTranslation();
  const { user, setUser } = useContext(AppContext);

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
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaUser, setMetaUser] = useState(null);

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
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.fullName, u.username, u.email].some((v) =>
        (v || "").toLowerCase().includes(q)
      )
    );
  }, [users, query]);

  const toggleSelect = (id) => {
    const copy = new Set(selected);
    copy.has(id) ? copy.delete(id) : copy.add(id);
    setSelected(copy);
  };

  const handleRoleChange = async (u, newRole) => {
    try {
      setUsers((prev) =>
        prev.map((usr) =>
          usr._id === u._id ? { ...usr, roles: [newRole] } : usr
        )
      );
      await fetch(`${API}/admin/users/${u._id}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

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
      allergens: u.allergens || [],
      pictograms: u.pictograms || [],
    });
  };

  const cancelEdit = () => {
    const original = users.find(
      (u) => u._id === editingId || u.id === editingId
    );
    if (original) {
      setEditForm({
        fullName: original.fullName || "",
        username: original.username || "",
        email: original.email || "",
        phoneNumber: original.phoneNumber || "",
        address: original.address || "",
        gender: original.gender || "other",
        country: original.country || "",
        language: original.language || "",
        Diabetic: original.Diabetic ?? false,
        allergens: original.allergens || [],
        pictograms: original.pictograms || [],
      });
    }
    setEditingId(null);
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
      const payload = {
        ...editForm,
        allergens: editForm.allergens || [],
        pictograms: editForm.pictograms || [],
        Diabetic: !!editForm.Diabetic,
      };

      const res = await fetch(`${API}/admin/users/${u._id || u.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.message || `Save failed (${res.status})`);
      if (editingId && user && (user._id === editingId || user.id === editingId)) {
        setUser((prev) => ({ ...prev, ...payload }));
      }
      setSaveMsg("✅ Saved");
      setEditingId(null);
      setEditForm({});
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setSaveMsg(`❌ ${err.message}`);
    } finally {
      setTimeout(() => setSaveMsg(null), 2500);
    }
  };

  // 🧬 Meta modal “Save” now updates local form only
  const handleSaveMeta = (data) => {
    // Derive pictograms from updated allergens if empty
    const derivedPictos =
      (data.pictograms && data.pictograms.length > 0)
        ? data.pictograms
        : derivePictogramsFromAllergens(data.allergens || []);
  
    setEditForm((prev) => ({
      ...prev,
      allergens: data.allergens || [],
      pictograms: derivedPictos,
      Diabetic: data.diabetic ?? prev.Diabetic,
    }));
  
    setMetaOpen(false);
    setMetaUser(null);
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
        t("Admin.Users.deleted", {
          count: ids.length,
          defaultValue: "🗑️ Deleted {{count}} user(s)",
        })
      );
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (err) {
      console.error(err);
      setSaveMsg(`❌ ${err.message}`);
    }
  };

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
            placeholder={t("Admin.Users.search")}
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

      {loading && <div>{t("Admin.Users.loading")}</div>}
      {error && (
        <div className="p-2 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto w-full" style={{ maxHeight: "70vh" }}>
        <table className="min-w-full text-sm border border-gray-400 dark:border-gray-700 rounded-lg text-left align-middle">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <th className="p-2"></th>
              <th className="p-2">{t("Admin.Users.username")}</th>
              <th className="p-2">{t("Admin.Users.email")}</th>
              <th className="p-2">{t("Admin.Users.fullName")}</th>
              <th className="p-2">{t("Admin.Users.gender")}</th>
              <th className="p-2">{t("Admin.Users.country")}</th>
              <th className="p-2">{t("Admin.Users.language")}</th>
              <th className="p-2">{t("Admin.Users.health")}</th>
              <th className="p-2 text-center">{t("Admin.Users.actions")}</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((u) => {
              const isEditing = editingId === (u._id || u.id);
              const display = isEditing ? editForm : u;

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
                      {/* Editable cells */}
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
                          <option value="">{t("Admin.Users.selectCountry")}</option>
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
                          <option value="">{t("Admin.Users.selectLanguage")}</option>
                          {(COUNTRIES.find((c) => c.code === editForm.country)?.languages ||
                            AVAILABLE_LANGUAGES
                          ).map((lang) => (
                            <option key={lang} value={lang}>
                              {LANG_LABELS[lang]}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Health meta preview */}
                      <td className="p-2 align-top">
                        <div className="flex flex-col gap-1">
                          {/* Pictograms with live preview (icon + letter) */}
                          <div className="flex flex-wrap gap-1">
                            {(metaUser || editForm.pictograms?.length
                              ? editForm.pictograms
                              : display.pictograms
                            )?.map((key) => {
                              const p = PICTO_BY_KEY[key];
                              return (
                                <div
                                  key={key}
                                  className="w-10 h-10 flex flex-col items-center justify-center text-xs font-semibold border border-gray-400 dark:border-gray-600 rounded-md transition-opacity duration-200"
                                  title={t(p?.tKey, p?.label || key)}
                                >
                                  <span className="text-lg leading-none">{p?.icon || key}</span>
                                  <span className="leading-none">{p?.key || key}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Allergen codes */}
                          {(editForm.allergens?.length || display.allergens?.length) > 0 && (
                            <div className="text-[0.7rem] text-gray-500 dark:text-gray-400">
                              {(editForm.allergens?.length
                                ? editForm.allergens
                                : display.allergens
                              ).join(", ")}
                            </div>
                          )}

                          {/* Diabetic status */}
                          {(editForm.Diabetic || display.Diabetic) && (
                            <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                              {t("Meals.MetaEditor.isDiabetic")}
                            </div>
                          )}

                          {/* Open MetaEditor button */}
                          <button
                            onClick={() => {
                              setMetaUser({
                                allergens: editForm.allergens || [],
                                pictograms: editForm.pictograms || [],
                                Diabetic: editForm.Diabetic ?? false,
                              });
                              setMetaOpen(true);
                            }}
                            className="mt-2 px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white self-start"
                          >
                            🧬 {t("Meals.MetaEditor.title")}
                          </button>
                        </div>
                      </td>

                      <td className="p-2 text-center">
                        <div className="mt-2">
                          <button
                            onClick={() => saveEdit(u)}
                            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded mr-1"
                          >
                            {t("Admin.Users.save")}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="bg-gray-500 hover:bg-gray-400 text-white px-3 py-1 rounded"
                          >
                            {t("Admin.Users.cancel")}
                          </button>
                        </div>
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
                        <div className="flex flex-col gap-1">
                          {/* Pictograms with letters (like SettingsModal) */}
                          <div className="flex flex-wrap gap-1">
                            {u.pictograms?.map((key) => {
                              const p = PICTO_BY_KEY[key];
                              return (
                                <div
                                  key={key}
                                  className="w-10 h-10 flex flex-col items-center justify-center text-xs font-semibold border border-gray-400 dark:border-gray-600 rounded-md"
                                  title={t(p?.tKey, p?.label || key)}
                                >
                                  <span className="text-lg leading-none">{p?.icon || key}</span>
                                  <span className="leading-none">{p?.key || key}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Allergen codes */}
                          {u.allergens?.length > 0 && (
                            <div className="text-[0.7rem] text-gray-500 dark:text-gray-400">
                              {u.allergens.join(", ")}
                            </div>
                          )}

                          {/* Diabetic */}
                          {u.Diabetic && (
                            <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                              {t("Meals.MetaEditor.isDiabetic")}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => startEdit(u)}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {t("Admin.Users.edit")}
                        </button>
                        <button
                          onClick={() => setResetTarget(u)}
                          className="text-red-600 dark:text-red-400 hover:underline ml-2"
                        >
                          {t("Admin.Users.resetPassword")}
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

      {/* Modals */}
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
          setSaveMsg(t("Admin.Users.added"));
          setTimeout(() => setSaveMsg(null), 2500);
        }}
      />
      <NotificationModal
        open={confirmOpen}
        title={t("Admin.Users.confirmDelete")}
        message={t("Admin.Users.confirmMessage", {
          count: selected.size,
        })}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        confirmText={t("Admin.Users.delete")}
        cancelText={t("Admin.Users.cancel")}
      />
      <MetaEditorModal
        isOpen={metaOpen}
        onClose={() => setMetaOpen(false)}
        onSave={handleSaveMeta}
        allergens={metaUser?.allergens || []}
        additives={metaUser?.additives || []}
        pictograms={metaUser?.pictograms || []}
        diabetic={metaUser?.Diabetic ?? false}
        showDiabetic={true}
        editableDiabetic={true}
      />
    </div>
  );
}
