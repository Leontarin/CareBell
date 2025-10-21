//frontend/src/features/admin/AddFoodModal.jsx
import React, { useState } from "react";
import { API } from "../../shared/config";

export default function AddFoodModal({ onClose }) {
  const [form, setForm] = useState({
    barcode: "",
    id: "",
    date: new Date().toISOString().slice(0, 10),
    category: "",
    dish: "",
    description: "",
    diabeticFriendly: false,
    allergens: "",
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("image", file);

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
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-[90%] max-w-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Add New Food</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Barcode"
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            className="w-full px-3 py-2 rounded border dark:bg-gray-700"
            required
          />
          <input
            placeholder="ID (numeric)"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
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
          <input
            placeholder="Dish name"
            value={form.dish}
            onChange={(e) => setForm({ ...form, dish: e.target.value })}
            className="w-full px-3 py-2 rounded border dark:bg-gray-700"
            required
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 rounded border dark:bg-gray-700"
          />
          <input
            placeholder="Allergens (comma separated)"
            value={form.allergens}
            onChange={(e) => setForm({ ...form, allergens: e.target.value })}
            className="w-full px-3 py-2 rounded border dark:bg-gray-700"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.diabeticFriendly}
              onChange={(e) => setForm({ ...form, diabeticFriendly: e.target.checked })}
            />
            Diabetic Friendly
          </label>
          <div>
            <p className="font-semibold mb-1">Contains Flags</p>
            <div className="grid grid-cols-4 gap-2 text-sm">
                {["R","S","G","M","A","W","K","Y"].map((c) => (
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
