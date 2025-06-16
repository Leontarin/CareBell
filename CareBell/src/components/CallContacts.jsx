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
    // uses translation with interpolation for count
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
    return <p className="text-center py-8">{t("CallContacts.loading")}</p>;
  if (error)
    return (
      <p className="text-center text-red-600 py-8">
        {t("CallContacts.error", { message: error })}
      </p>
    );
return (
  <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl overflow-hidden">
    {/* Enhanced Header */}
    <div className="bg-white shadow-lg p-6 border-b-4 border-blue-200">
      <div className="flex flex-col lg:flex-row items-center gap-4 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("CallContacts.searchPlaceholder")}
            className="w-full rounded-2xl border-3 border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-200 text-xl px-6 py-4 pr-16 shadow-lg transition-all duration-200"
          />
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-3xl text-blue-500">
            🔍
          </div>
        </div>
        
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white font-bold text-xl rounded-2xl px-8 py-4 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 whitespace-nowrap"
          >
            <span className="mr-3 text-2xl">👤</span>
            {t("CallContacts.addContact")}
          </button>
        )}
        
        {/* Enhanced Bulk menu trigger */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-2xl font-bold focus:outline-none shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            <span className="text-2xl">🗑️</span>
          </button>
          {menuOpen && (
            <div className="absolute mt-2 right-0 bg-white border-2 border-red-200 rounded-xl shadow-2xl z-10 min-w-[200px]">
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0}
                className="w-full text-left px-6 py-4 text-lg text-red-700 font-bold hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🗑️ {t("CallContacts.deleteSelected")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Enhanced Add form */}
    {isAdding && (
      <div className="p-6 bg-white mx-6 mt-6 rounded-2xl shadow-2xl border-2 border-blue-200">
        <div className="max-w-2xl mx-auto space-y-6">
          <h3 className="text-2xl font-bold text-blue-900 text-center mb-6">
            <span className="mr-3">👤</span>
            {t("CallContacts.addContact")}
          </h3>
          
          {[
            {
              lbl: t("CallContacts.fullNameLabel"),
              name: "fullName",
              placeholder: t("CallContacts.fullNamePlaceholder"),
              icon: "👤"
            },
            {
              lbl: t("CallContacts.phoneNumberLabel"),
              name: "phoneNumber",
              placeholder: t("CallContacts.phoneNumberPlaceholder"),
              icon: "📞"
            },
            {
              lbl: t("CallContacts.relationshipLabel"),
              name: "relationship",
              placeholder: t("CallContacts.relationshipPlaceholder"),
              icon: "👥"
            }
          ].map(f => (
            <div key={f.name} className="space-y-2">
              <label className="flex items-center text-xl font-bold text-gray-800">
                <span className="mr-3 text-2xl">{f.icon}</span>
                {f.lbl}
              </label>
              <input
                name={f.name}
                value={form[f.name]}
                onChange={handleChange}
                placeholder={f.placeholder}
                className="w-full rounded-2xl border-3 border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-200 text-xl px-6 py-4 shadow-lg transition-all duration-200"
              />
            </div>
          ))}
          
          <div className="flex justify-center gap-6 pt-4">
            <button
              onClick={() => {
                setIsAdding(false);
                setForm({ fullName: "", phoneNumber: "", relationship: "" });
              }}
              className="px-8 py-4 rounded-2xl bg-gray-300 hover:bg-gray-400 text-gray-800 text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              {t("CallContacts.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white text-xl font-bold disabled:opacity-60 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:transform-none"
            >
              <span className="mr-3">💾</span>
              {saving ? t("CallContacts.saving") : t("CallContacts.save")}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Enhanced Contacts list */}
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {visibleContacts.map(c => (
          <div
            key={c._id}
            className="bg-white rounded-3xl shadow-xl border-2 border-blue-100 hover:border-blue-300 hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center gap-4">
                {menuOpen && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c._id)}
                    onChange={() => toggleSelect(c._id)}
                    className="h-6 w-6 text-blue-600 rounded-lg border-2 border-blue-300"
                  />
                )}
                
                {/* Contact Avatar */}
                <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-full w-16 h-16 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {c.fullName.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {c.fullName}
                  </h3>
                  {c.relationship && (
                    <p className="text-lg text-blue-600 font-semibold mb-2">
                      👥 {c.relationship}
                    </p>
                  )}
                  <p className="text-lg text-gray-600 mb-4">
                    📞 {c.phoneNumber}
                  </p>
                  
                  
                  <a
                    href={`tel:${c.phoneNumber}`}
                    className="inline-flex items-center justify-center text-xl font-bold text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-2xl py-3 px-8 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    <span className="mr-3 text-2xl">📞</span>
                    {t("CallContacts.call")}
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}

        {visibleContacts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl shadow-lg border-2 border-gray-200">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-2xl text-gray-600 font-semibold">
              {t("CallContacts.noMatch")}
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
);
  
}
