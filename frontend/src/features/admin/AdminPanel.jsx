// src/features/admin/AdminPanel.jsx
import React, { useState } from "react";
import { FaUsers, FaUtensils, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import UserManager from "./UserManager";
import FoodManager from "./FoodManager";
import { useTranslation } from "react-i18next";

export default function AdminPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState("users");

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          🛡️ {t("Admin.Panel.title", "Admin Panel")}
        </h1>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
        >
          <FaArrowLeft className="inline mr-1" /> {t("Admin.Panel.back", "Back")}
        </button>
      </div>
  
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 rounded ${
            tab === "users"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700"
          } flex items-center gap-2`}
        >
          <FaUsers /> {t("Admin.Panel.users", "Users")}
        </button>
  
        <button
          onClick={() => setTab("foods")}
          className={`px-4 py-2 rounded ${
            tab === "foods"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700"
          } flex items-center gap-2`}
        >
          <FaUtensils /> {t("Admin.Panel.foods", "Foods")}
        </button>
      </div>
  
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-inner min-h-[60vh] overflow-auto">
        {tab === "users" && <UserManager />}
        {tab === "foods" && <FoodManager />}
      </div>
    </div>
  );
  
}
