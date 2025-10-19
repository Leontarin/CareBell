// src/features/admin/AllergyManager.jsx
import React, { useEffect, useState } from "react";
import { API } from "../../shared/config";

export default function AllergyManager() {
  const [allergies, setAllergies] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/foods`, { credentials: "include" });
        const data = await res.json();
        const uniqueAllergies = Array.from(
          new Set(data.flatMap((f) => f.allergens || []))
        );
        setAllergies(uniqueAllergies);
      } catch (err) {
        console.error("Failed to load allergies", err);
      }
    })();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Allergies</h2>
      <ul className="list-disc pl-6">
        {allergies.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  );
}
