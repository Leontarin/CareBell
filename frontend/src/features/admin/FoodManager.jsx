import React, { useEffect, useState } from "react";
import { API } from "../../shared/config";
import NotificationModal from "../../components/NotificationModal";
import AddFoodModal from "./AddFoodModal";

export default function FoodManager() {
  const [foods, setFoods] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // ───────────────────────────────
  //  Fetch all foods
  // ───────────────────────────────
  async function fetchFoods() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/foods${query ? `?q=${encodeURIComponent(query)}` : ""}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load foods");
      setFoods(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setFoods([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFoods();
  }, []);

  // ───────────────────────────────
  //  Editing
  // ───────────────────────────────
  const startEdit = (food) => {
    setEditingId(food._id);
    setEditForm({
      barcode: food.barcode || "",
      dish: food.dish || "",
      category: food.category || "",
      description: food.description || "",
      diabeticFriendly: !!food.diabeticFriendly,
      allergens: food.allergens?.join(", ") || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  async function saveEdit(id) {
    try {
      setLoading(true);
      const body = { ...editForm };
      // normalize CSV to array
      if (body.allergens) {
        body.allergens = body.allergens.split(",").map((a) => a.trim()).filter(Boolean);
      }
      const res = await fetch(`${API}/admin/foods/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save");
      setSaveMsg("✅ Saved");
      await fetchFoods();
      cancelEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ───────────────────────────────
  //  Delete (single or bulk)
  // ───────────────────────────────
  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} food item(s)?`)) return;
    try {
      const res = await fetch(`${API}/admin/foods/bulk-delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete");
      setSaveMsg(`🗑️ Deleted ${data.deletedCount} item(s)`);
      setSelected(new Set());
      fetchFoods();
    } catch (err) {
      setError(err.message);
    }
  }

  // ───────────────────────────────
  //  UI Helpers
  // ───────────────────────────────
  const toggleSelect = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dish, category or barcode..."
            className="px-3 py-2 rounded border dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={fetchFoods}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            Search
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white"
          >
            ➕ Add Food
          </button>
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white"
            >
              🗑️ Delete Selected ({selected.size})
            </button>
          )}
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {saveMsg && <NotificationModal message={saveMsg} onClose={() => setSaveMsg(null)} />}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-400 dark:border-gray-600">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="p-2"></th>
              <th className="p-2">Image</th>
              <th className="p-2">Barcode</th>
              <th className="p-2">Dish</th>
              <th className="p-2">Category</th>
              <th className="p-2">Description</th>
              <th className="p-2">Allergens</th>
              <th className="p-2">Diabetic</th>
              <th className="p-2">Contains Flags</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {foods.map((f) => (
              <tr
                key={f._id}
                className="border-t border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(f._id)}
                    onChange={() => toggleSelect(f._id)}
                  />
                </td>
                <td className="p-2 text-center">
                  {f.imageURL ? (
                    <img
                      src={`${API}${f.imageURL}`}
                      alt="food"
                      className="w-12 h-12 object-cover rounded mx-auto"
                    />
                  ) : (
                    <span className="text-gray-400">no image</span>
                  )}
                </td>
                <td className="p-2">{f.barcode}</td>

                {editingId === f._id ? (
                  <>
                    <td className="p-2">
                      <input
                        value={editForm.dish}
                        onChange={(e) => setEditForm({ ...editForm, dish: e.target.value })}
                        className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                      />
                    </td>
                    <td className="p-2">
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={editForm.allergens}
                        onChange={(e) => setEditForm({ ...editForm, allergens: e.target.value })}
                        placeholder="comma separated"
                        className="w-full px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={editForm.diabeticFriendly}
                        onChange={(e) =>
                          setEditForm({ ...editForm, diabeticFriendly: e.target.checked })
                        }
                      />
                    </td>
                    <td className="p-2 text-center">
                        <div className="flex flex-wrap gap-1 justify-center text-xs">
                            {["R","S","G","M","A","W","K","Y"].map((c) => (
                            <label key={c} className="flex items-center gap-1">
                                <input
                                type="checkbox"
                                checked={!!editForm[`contains_${c}`]}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, [`contains_${c}`]: e.target.checked })
                                }
                                />
                                {c}
                            </label>
                            ))}
                        </div>
                        </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => saveEdit(f._id)}
                        className="px-2 py-1 bg-green-600 text-white rounded mr-1"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 bg-gray-500 text-white rounded"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-2">{f.dish}</td>
                    <td className="p-2">{f.category}</td>
                    <td className="p-2">{f.description || "-"}</td>
                    <td className="p-2">{f.allergens?.join(", ") || "-"}</td>
                    <td className="p-2 text-center">
                      {f.diabeticFriendly ? "✅" : "❌"}
                    </td>
                    <td className="p-2 text-center">
                        <div className="flex flex-wrap gap-1 justify-center text-xs">
                            {["R","S","G","M","A","W","K","Y"].map((c) => (
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
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm("Delete this food?")) {
                            await fetch(`${API}/admin/foods/${f._id}`, {
                              method: "DELETE",
                              credentials: "include",
                            });
                            fetchFoods();
                          }
                        }}
                        className="px-2 py-1 bg-red-600 text-white rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
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
