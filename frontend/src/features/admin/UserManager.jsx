import React, { useEffect, useMemo, useState, useCallback } from "react";
import { API } from "../../shared/config";
import { COUNTRIES, LANG_LABELS, AVAILABLE_LANGUAGES } from "../../shared/constants";
import NotificationModal from "../../components/NotificationModal";
import AddUserModal from "./AddUserModal";
import ResetPasswordModal from "./ResetPasswordModal";
import { useTranslation } from "react-i18next";

export default function UserManager() {
  const { t } = useTranslation();
  const userKey = (user) => user?._id || user?.id;
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


  // ────────────────────────────────
  //  Load all users
  // ────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/users`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(t("Admin.Users.messages.loadError", { message: err.message }));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ────────────────────────────────
  //  Editing & Saving
  // ────────────────────────────────
  const startEdit = (u) => {
    setEditingId(userKey(u));
    setEditForm({
      fullName: u.fullName || "",
      username: u.username || "",
      email: u.email || "",
      phoneNumber: u.phoneNumber || "",
      address: u.address || "",
      gender: u.gender || "other",
      country: u.country || "",
      language: u.language || "",
      R: u.R ?? false,
      S: u.S ?? false,
      G: u.G ?? false,
      M: u.M ?? false,
      A: u.A ?? false,
      W: u.W ?? false,
      K: u.K ?? false,
      Y: u.Y ?? false,
      Diabetic: u.Diabetic ?? false,
      Allergens: (u.Allergens || []).join(", "),
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
    const payload = { ...editForm };
    payload.Allergens = payload.Allergens
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a);

    const res = await fetch(`${API}/admin/users/${u._id || u.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Save failed (${res.status})`);

    setSaveMsg(t("Admin.Common.messages.saved"));
    setEditingId(null);
    setEditForm({});
    await fetchUsers();
  } catch (err) {
    console.error(err);
    setSaveMsg(t("Admin.Users.messages.saveError", { message: err.message }));
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

    const handleDeleteSelected = async () => {
        setConfirmOpen(true);
    };

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

            setUsers((prev) => prev.filter((u) => !selected.has(userKey(u))));
            setSelected(new Set());
            setSaveMsg(t("Admin.Common.messages.deleted", { count: ids.length }));
            setTimeout(() => setSaveMsg(null), 2500);
        } catch (err) {
            console.error(err);
            setSaveMsg(t("Admin.Users.messages.deleteError", { message: err.message }));
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
        <h2 className="text-2xl font-semibold">{t("Admin.Users.title")}</h2>

        <div className="flex items-center gap-2">
            <button
                onClick={() => setAddOpen(true)}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
            >
                + {t("Admin.Users.buttons.add")}
            </button>
            <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Admin.Users.searchPlaceholder")}
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
                    {t("Admin.Users.buttons.deleteSelected", { count: selected.size })}
                </button>
            )}

            <button
            onClick={fetchUsers}
            className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
            >
            {t("Admin.Common.buttons.refresh")}
            </button>
        </div>
        </div>

      {loading && <div>{t("Admin.Users.messages.loading")}</div>}
      {error && (
        <div className="p-2 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="overflow-x-auto w-full">
        <table className="min-w-full text-sm border border-gray-400 dark:border-gray-700 rounded-lg text-left align-middle">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <th className="p-2">
            <input
                type="checkbox"
                onChange={(e) => {
                if (e.target.checked) {
                    setSelected(new Set(filteredUsers.map((u) => u._id)));
                } else {
                    setSelected(new Set());
                }
                }}
                checked={
                filteredUsers.length > 0 &&
                selected.size === filteredUsers.length
                }
            />
            </th>
                <th className="p-2 text-left">{t("Admin.Users.table.username")}</th>
                <th className="p-2 text-left">{t("Admin.Users.table.email")}</th>
                <th className="p-2 text-left">{t("Admin.Users.table.fullName")}</th>
                <th className="p-2 text-left">{t("Admin.Users.table.gender")}</th>
                <th className="p-2 text-left">{t("Admin.Users.table.country")}</th>
                <th className="p-2 text-left">{t("Admin.Users.table.language")}</th>
                <th className="p-2 text-left">{t("Admin.Users.table.health")}</th>
                <th className="p-2 text-center w-32">{t("Admin.Users.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => {
              const rowKey = userKey(u);
              const isEditing = editingId === rowKey;
              return (
                <tr
                  key={rowKey}
                  className="border-t border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="p-2">
                    <input
                    type="checkbox"
                    checked={selected.has(rowKey)}
                    onChange={() => toggleSelect(rowKey)}
                    />
                  </td>

                  {isEditing ? (
                    <>
                        <td className="p-2">
                        <input
                            name="username"
                            value={editForm.username}
                            onChange={handleChange}
                            className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-gray-600 p-1"
                        />
                        </td>
                        <td className="p-2">
                        <input
                            name="email"
                            value={editForm.email}
                            onChange={handleChange}
                            className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-gray-600 p-1"
                        />
                        </td>
                        <td className="p-2">
                        <input
                            name="fullName"
                            value={editForm.fullName}
                            onChange={handleChange}
                            className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-gray-600 p-1"
                        />
                        </td>
                      <td className="p-2">
                        <select
                          name="gender"
                          value={editForm.gender}
                          onChange={handleChange}
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-gray-600 p-1"
                        >
                          <option value="male">{t("Admin.Users.gender.male")}</option>
                          <option value="female">{t("Admin.Users.gender.female")}</option>
                          <option value="other">{t("Admin.Users.gender.other")}</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          name="country"
                          value={editForm.country}
                          onChange={handleChange}
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-gray-600 p-1"
                        >
                          <option value="">{t("Admin.Users.select.country")}</option>
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
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-gray-600 p-1"
                        >
                          <option value="">{t("Admin.Users.select.language")}</option>
                          {(COUNTRIES.find(c => c.code === editForm.country)?.languages ||
                            AVAILABLE_LANGUAGES
                          ).map((lang) => (
                            <option key={lang} value={lang}>
                              {LANG_LABELS[lang]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <div className="grid grid-cols-4 gap-1">
                          {["R","S","G","M","A","W","K","Y"].map((key) => (
                            <label key={key} className="flex items-center space-x-1">
                              <input
                                type="checkbox"
                                name={key}
                                checked={!!editForm[key]}
                                onChange={handleChange}
                              />
                              <span>{key}</span>
                            </label>
                          ))}
                        </div>
                        <label className="block text-xs mt-1">
                          {t("Admin.Users.labels.allergens")}
                        </label>
                        <input
                          name="Allergens"
                          value={editForm.Allergens}
                          onChange={handleChange}
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-gray-600 p-1 mt-1"
                        />
                        <label className="flex items-center text-xs mt-1">
                          <input
                            type="checkbox"
                            name="Diabetic"
                            checked={editForm.Diabetic}
                            onChange={handleChange}
                            className="mr-1"
                          />
                          {t("Admin.Users.labels.diabetic")}
                        </label>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => saveEdit(u)}
                          className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded mr-1"
                        >
                          {t("Admin.Common.buttons.save")}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="bg-gray-500 hover:bg-gray-400 text-white px-3 py-1 rounded"
                        >
                          {t("Admin.Common.buttons.cancel")}
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">{u.username || t("Admin.Users.table.empty")}</td>
                      <td className="p-2">{u.email || t("Admin.Users.table.empty")}</td>
                      <td className="p-2">{u.fullName || t("Admin.Users.table.empty")}</td>
                      <td className="p-2 capitalize">
                        {t(`Admin.Users.gender.${u.gender || "other"}`)}
                      </td>
                      <td className="p-2">{u.country || t("Admin.Users.table.empty")}</td>
                      <td className="p-2">{LANG_LABELS[u.language] || u.language || t("Admin.Users.table.empty")}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1 text-xs">
                          {["R","S","G","M","A","W","K","Y"].filter(k => u[k]).map(k => (
                            <span key={k} className="px-2 py-0.5 bg-green-200 dark:bg-green-800 rounded">{k}</span>
                          ))}
                        </div>
                        {u.Allergens?.length > 0 && (
                          <div className="text-xs mt-1">
                            {t("Admin.Users.labels.allergensPrefix", {
                              list: u.Allergens.join(", "),
                            })}
                          </div>
                        )}
                        {u.Diabetic && (
                          <div className="text-xs text-red-600 dark:text-red-400">
                            {t("Admin.Users.labels.diabetic")}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => startEdit(u)}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {t("Admin.Common.buttons.edit")}
                        </button>
                        <button
                            onClick={() => setResetTarget(u)}
                            className="text-red-600 dark:text-red-400 hover:underline ml-2"
                            >
                            {t("Admin.Users.buttons.resetPassword")}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {filteredUsers.length === 0 && !loading && !error && (
              <tr>
                <td colSpan="9" className="p-3 text-center text-gray-500 dark:text-gray-400">
                  {t("Admin.Users.table.emptyState")}
                </td>
              </tr>
            )}
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
                setSaveMsg(t("Admin.Users.messages.added"));
                setTimeout(() => setSaveMsg(null), 2500);
            }}
        />
        <NotificationModal
            open={confirmOpen}
            title={t("Admin.Users.modals.deleteTitle")}
            message={t("Admin.Users.modals.deleteMessage", { count: selected.size })}
            onClose={() => setConfirmOpen(false)}
            onConfirm={confirmDelete}
            confirmText={t("Admin.Common.buttons.delete")}
            cancelText={t("Admin.Common.buttons.cancel")}
        />
    </div>
  );
}
