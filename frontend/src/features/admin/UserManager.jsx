import React, { useEffect, useMemo, useState } from "react";
import { API } from "../../shared/config";
import { COUNTRIES, LANG_LABELS, AVAILABLE_LANGUAGES } from "../../shared/constants";
import NotificationModal from "../../components/NotificationModal";
import AddUserModal from "./AddUserModal";
import ResetPasswordModal from "./ResetPasswordModal";

export default function UserManager() {
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

            setUsers((prev) => prev.filter((u) => !selected.has(u._id)));
            setSelected(new Set());
            setSaveMsg(`🗑️ Deleted ${ids.length} user(s)`);
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
        <h2 className="text-2xl font-semibold">User Manager</h2>

        <div className="flex items-center gap-2">
            <button
                onClick={() => setAddOpen(true)}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
            >
                + Add New User
            </button>
            <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, username, or email…"
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
                    Delete Selected ({selected.size})
                </button>
            )}

            <button
            onClick={fetchUsers}
            className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
            >
            Refresh
            </button>
        </div>
        </div>

      {loading && <div>Loading users…</div>}
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
                <th className="p-2 text-left">Username</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Full Name</th>
                <th className="p-2 text-left">Gender</th>
                <th className="p-2 text-left">Country</th>
                <th className="p-2 text-left">Language</th>
                <th className="p-2 text-left">Health</th>
                <th className="p-2 text-center w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => {
              const isEditing = editingId === (u._id || u.id);
              return (
                <tr
                  key={u._id || u.id}
                  className="border-t border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="p-2">
                    <input
                    type="checkbox"
                    checked={selected.has(u._id)}
                    onChange={() => toggleSelect(u._id)}
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
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          name="country"
                          value={editForm.country}
                          onChange={handleChange}
                          className="w-full rounded bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-gray-600 p-1"
                        >
                          <option value="">Select Country</option>
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
                          <option value="">Select Language</option>
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
                        <label className="block text-xs mt-1">Allergens</label>
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
                          Diabetic
                        </label>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => saveEdit(u)}
                          className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded mr-1"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="bg-gray-500 hover:bg-gray-400 text-white px-3 py-1 rounded"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">{u.username || "—"}</td>
                      <td className="p-2">{u.email || "—"}</td>
                      <td className="p-2">{u.fullName}</td>
                      <td className="p-2 capitalize">{u.gender}</td>
                      <td className="p-2">{u.country}</td>
                      <td className="p-2">{u.language}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1 text-xs">
                          {["R","S","G","M","A","W","K","Y"].filter(k => u[k]).map(k => (
                            <span key={k} className="px-2 py-0.5 bg-green-200 dark:bg-green-800 rounded">{k}</span>
                          ))}
                        </div>
                        {u.Allergens?.length > 0 && (
                          <div className="text-xs mt-1">
                            🧂 {u.Allergens.join(", ")}
                          </div>
                        )}
                        {u.Diabetic && (
                          <div className="text-xs text-red-600 dark:text-red-400">Diabetic</div>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => startEdit(u)}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                            onClick={() => setResetTarget(u)}
                            className="text-red-600 dark:text-red-400 hover:underline ml-2"
                            >
                            Reset Password
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
                  No users found.
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
                setSaveMsg("✅ User added successfully");
                setTimeout(() => setSaveMsg(null), 2500);
            }}
        />
        <NotificationModal
            open={confirmOpen}
            title="Confirm deletion"
            message={`Are you sure you want to delete ${selected.size} selected user(s)? This cannot be undone.`}
            onClose={() => setConfirmOpen(false)}
            onConfirm={confirmDelete}
            confirmText="Delete"
            cancelText="Cancel"
        />
    </div>
  );
}
