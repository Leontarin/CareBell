// src/components/NotificationModal.jsx
import React from "react";
import { useTranslation } from "react-i18next";

export default function NotificationModal({ open, title, message, onClose }) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[92%] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6">
        {title && <h3 className="text-2xl font-bold mb-3 text-blue-900 dark:text-blue-200">{title}</h3>}
        <p className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{message}</p>
        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          >
            {t("SettingsModal.close", { defaultValue: "Close" })}
          </button>
        </div>
      </div>
    </div>
  );
}
