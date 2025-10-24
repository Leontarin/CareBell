import React from "react";
import { useTranslation } from "react-i18next";
import { useMeta } from "../shared/meta";

export default function AllergenCheckboxes({ values, onChange, prefix = "", readOnly = false }) {
  const { t } = useTranslation();
  const { pictograms } = useMeta();

  const handleToggle = (key) => {
    if (readOnly) return;
    const field = prefix ? `${prefix}${key}` : key;
    const current = !!values?.[field];
    const nextValues = { ...(values || {}) };
    nextValues[field] = !current;
    onChange?.(nextValues);
  };

  if (!Array.isArray(pictograms) || pictograms.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      {pictograms.map(({ key, icon, tKey }) => {
        const field = prefix ? `${prefix}${key}` : key;
        const checked = !!values?.[field];
        return (
          <label
            key={key}
            className="flex items-center gap-1 border border-gray-300 dark:border-gray-700 rounded p-1"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => handleToggle(key)}
              disabled={readOnly}
            />
            <span>{icon || key}</span>
            <span>{t(tKey, key)}</span>
          </label>
        );
      })}
    </div>
  );
}
