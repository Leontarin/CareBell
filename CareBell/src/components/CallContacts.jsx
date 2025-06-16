import React, { useEffect, useState, useMemo, useContext } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { AppContext } from "../AppContext";
import { API } from "../config";

export default function CallContacts() {
  const { t } = useTranslation();
  const { user } = useContext(AppContext);
  const userId = user?.id;

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: "", phoneNumber: "", relationship: "" });
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/contacts/getAll/${userId}`)
      .then(res => setContacts(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  const visibleContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter(c =>
        c.fullName.toLowerCase().includes(q) ||
        c.phoneNumber.includes(q) ||
        c.relationship?.toLowerCase().includes(q)
      )
      .sort((a, b) =>
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" })
      );
  }, [contacts, query]);

  const toggleSelect = id => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setMenuOpen(false);
    if (!window.confirm(t("CallContacts.confirmBulkDelete", { count: selectedIds.size })))
      return;
    Promise.all(
      Array.from(selectedIds).map(id =>
        axios.delete(`${API}/contacts/deleteContact/${id}`)
      )
    )
      .then(() => {
        setContacts(prev => prev.filter(c => !selectedIds.has(c._id)));
        setSelectedIds(new Set());
      })
      .catch(err =>
        alert(err.response?.data?.message || err.message)
      );
  };

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = () => {
    if (!form.fullName || !form.phoneNumber) {
      alert(t("CallContacts.fillAllFields"));
      return;
    }
    setSaving(true);
    axios
      .post(`${API}/contacts/addContact`, { userId, ...form })
      .then(res => {
        setContacts(prev => [...prev, res.data]);
        setIsAdding(false);
        setForm({ fullName: "", phoneNumber: "", relationship: "" });
      })
      .catch(err => alert(err.response?.data?.message || err.message))
      .finally(() => setSaving(false));
  };

  if (loading)
    return <p className="text-center py-4 text-sm">{t("CallContacts.loading")}</p>;
  if (error)
    return (
      <p className="text-center text-red-600 py-4 text-sm">
        {t("CallContacts.error", { message: error })}
      </p>
    );

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white shadow-sm p-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t("CallContacts.searchPlaceholder")}
              className="w-full rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm px-3 py-2 pr-8"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400">
              🔍
            </div>
          </div>
          
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg px-4 py-2 whitespace-nowrap"
            >
              + {t("CallContacts.addContact")}
            </button>
          )}
          
          {/* Bulk delete button */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg"
            >
              🗑️
            </button>
            {menuOpen && (
              <div className="absolute mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                >
                  {t("CallContacts.deleteSelected")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add form - Compact */}
      {isAdding && (
        <div className="p-3 bg-white mx-3 mt-3 rounded-lg shadow-sm border border-gray-200">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-800">
              {t("CallContacts.addContact")}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder={t("CallContacts.fullNamePlaceholder")}
                className="rounded-lg border border-gray-300 focus:border-blue-500 text-sm px-3 py-2"
              />
              <input
                name="phoneNumber"
                value={form.phoneNumber}
                onChange={handleChange}
                placeholder={t("CallContacts.phoneNumberPlaceholder")}
                className="rounded-lg border border-gray-300 focus:border-blue-500 text-sm px-3 py-2"
              />
              <input
                name="relationship"
                value={form.relationship}
                onChange={handleChange}
                placeholder={t("CallContacts.relationshipPlaceholder")}
                className="rounded-lg border border-gray-300 focus:border-blue-500 text-sm px-3 py-2"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setForm({ fullName: "", phoneNumber: "", relationship: "" });
                }}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium"
              >
                {t("CallContacts.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-60"
              >
                {saving ? t("CallContacts.saving") : t("CallContacts.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contacts list - Compact grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleContacts.map(c => (
            <div
              key={c._id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-3"
            >
              <div className="flex items-start gap-3">
                {menuOpen && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c._id)}
                    onChange={() => toggleSelect(c._id)}
                    className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                )}
                
                {/* Compact Avatar */}
                <div className="bg-blue-500 rounded-full w-10 h-10 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {c.fullName.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {c.fullName}
                  </h3>
                  {c.relationship && (
                    <p className="text-xs text-gray-600 truncate">
                      {c.relationship}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {c.phoneNumber}
                  </p>
                  
                  
                  <a
                    href={`tel:${c.phoneNumber}`}
                    className="inline-flex items-center mt-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md px-3 py-1.5"
                  >
                    📞 {t("CallContacts.call")}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {visibleContacts.length === 0 && (
          <div className="text-center py-8 bg-white rounded-lg">
            <p className="text-sm text-gray-600">
              {t("CallContacts.noMatch")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}