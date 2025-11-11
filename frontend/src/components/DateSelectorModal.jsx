// frontend/src/components/DateSelectorModal.jsx
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

// ──────────────────────────────────────────────────────────────────────────────
//  DateSelectorModal — used in FoodManager to define meal schedule
// ──────────────────────────────────────────────────────────────────────────────
export default function DateSelectorModal({
  isOpen,
  onClose,
  onSave,
  initialDates = [],
  initialRecurring = [],
}) {
  const { t } = useTranslation();
  const [dates, setDates] = useState(initialDates);
  const [recurringDays, setRecurringDays] = useState(initialRecurring);
  const [pendingDate, setPendingDate] = useState("");

  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  useEffect(() => {
    if (isOpen) {
      setDates(initialDates || []);
      setRecurringDays(initialRecurring || []);
      setPendingDate("");
    }
  }, [isOpen]);

  // ────────────────────────────────
  //  Handlers
  // ────────────────────────────────
  const addDate = () => {
    if (!pendingDate || dates.includes(pendingDate)) return;
    setDates([...dates, pendingDate]);
    setPendingDate("");
  };

  const removeDate = (d) => setDates(dates.filter((x) => x !== d));

  const toggleRecurring = (day) => {
    setRecurringDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };

  const handleSave = () => onSave({ dates, recurringDays });

  // ────────────────────────────────
  //  UI
  // ────────────────────────────────
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-[90%] shadow-2xl">
        <h2 className="text-2xl font-semibold text-center mb-4 text-blue-700 dark:text-blue-300">
          {t("Admin.Foods.datesTitle", "Meal Dates & Recurrence")}
        </h2>

        <div className="flex flex-col gap-6 text-gray-900 dark:text-gray-100">
          {/* Specific Dates Section */}
          <section>
            <h3 className="text-lg font-semibold mb-2">
              {t("Admin.Foods.specificDates", "Specific Dates")}
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={pendingDate}
                onChange={(e) => setPendingDate(e.target.value)}
                className="border rounded p-1 dark:bg-gray-800 dark:border-gray-700"
              />
              <button
                onClick={addDate}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1 rounded"
              >
                {t("Common.add", "Add")}
              </button>
            </div>

            {dates.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {dates.map((d) => (
                  <span
                    key={d}
                    onClick={() => removeDate(d)}
                    title={t("Common.remove", "Remove")}
                    className="cursor-pointer px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 hover:bg-red-400 hover:text-white transition-colors"
                  >
                    {d} ✕
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Recurring Days Section */}
          <section>
            <h3 className="text-lg font-semibold mb-2">
              {t("Admin.Foods.recurringDays", "Recurring Days")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {weekdays.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleRecurring(w)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    recurringDays.includes(w)
                      ? "bg-blue-600 text-white border-blue-700"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {t(`Days.${w}`, w)}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-400 hover:bg-gray-300 px-4 py-2 rounded text-white"
          >
            {t("Common.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
          >
            {t("Admin.Foods.saveDates", "Save Dates")}
          </button>
        </div>
      </div>
    </div>
  );
}
