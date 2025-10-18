// src/features/AdminPanel.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function AdminPanel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h1 className="text-4xl font-bold mb-6">🛡️ Admin Panel</h1>
      <p className="text-lg text-center max-w-md mb-8">
        Welcome, admin! This section will soon include management tools for users, meals, and allergies.
      </p>
      <button
        onClick={() => navigate("/")}
        className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-lg"
      >
        ⬅ Back to Home
      </button>
    </div>
  );
}