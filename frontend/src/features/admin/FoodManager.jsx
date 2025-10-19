// src/features/admin/FoodManager.jsx
import React, { useEffect, useState } from "react";
import { API } from "../../shared/config";

export default function FoodManager() {
  const [foods, setFoods] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/foods`, { credentials: "include" });
        const data = await res.json();
        setFoods(data);
      } catch (err) {
        console.error("Failed to load foods", err);
      }
    })();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Foods</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-200 dark:bg-gray-700">
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Calories</th>
          </tr>
        </thead>
        <tbody>
          {foods.map((f) => (
            <tr key={f._id} className="border-b border-gray-300 dark:border-gray-600">
              <td className="p-2">{f.name}</td>
              <td className="p-2">{f.calories}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
