// src/components/NotificationModal.jsx
import React from "react";
import { useTranslation } from "react-i18next";

/**
 * Backward-compatible notification/confirmation modal.
 *
 * Props:
 * - open: boolean
 * - title?: string
 * - message: string | ReactNode
 * - onClose: function
 * - onConfirm?: function  -> if provided, renders Cancel & Confirm buttons
 * - confirmText?: string  -> default "Confirm"
 * - cancelText?: string   -> default "Cancel"
 */
export default function NotificationModal({
  open,
  title,
  message,
  onClose,
  onConfirm,
  confirmText,
  cancelText,
}) {
  const { t } = useTranslation();
  if (!open) return null;

  const confirmLabel = confirmText || t("Common.confirm", { defaultValue: "Confirm" });
  const cancelLabel =
    cancelText || t("SettingsModal.close", { defaultValue: "Close" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[92%] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6">
        {title && (
          <h3 className="text-2xl font-bold mb-3 text-blue-900 dark:text-blue-200">
            {title}
          </h3>
        )}
        <div className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
          {message}
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-center gap-3">
          {onConfirm ? (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-semibold"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold"
              >
                {confirmLabel}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
