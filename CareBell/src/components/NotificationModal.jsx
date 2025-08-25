//.src/components/NotificationModal.jsx
import React from "react";

export default function NotificationModal({ open, title = "Notice", message, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-800 shadow-2xl">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">{title}</h3>
          <div className="mt-4 text-gray-700 dark:text-gray-300 whitespace-pre-line text-center">
            {message}
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-center">
          <button
            onClick={onClose}
            className="min-w-32 rounded-2xl bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-2.5 px-6"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
