import React from "react";
import { useTranslation } from "react-i18next";
import { useMeta } from "../shared/metaContext.jsx";

export function extractSelectedPictograms(values = {}, prefix = "", pictograms = []) {
  const fieldFor = (key) => (prefix ? `${prefix}${key}` : key);

  return (Array.isArray(pictograms) ? pictograms : [])
    .map(({ key }) => key)
    .filter((key) => !!values[fieldFor(key)]);
}

function AllergenCheckboxes({ values = {}, onChange = () => {}, prefix = "", readOnly = false }) {
  const { t } = useTranslation();
  const { pictograms } = useMeta();

  const fieldFor = (key) => (prefix ? `${prefix}${key}` : key);

  const toggle = (key) => {
    if (readOnly) return;
    const field = fieldFor(key);
    onChange({
      ...values,
      [field]: !values[field],
    });
  };

  if (!Array.isArray(pictograms) || pictograms.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      {pictograms.map(({ key, icon, tKey }) => (
        <label
          key={key}
          className="flex items-center gap-1 border border-gray-300 dark:border-gray-700 rounded p-1"
        >
          <input
            type="checkbox"
            checked={!!values[fieldFor(key)]}
            onChange={() => toggle(key)}
            disabled={readOnly}
          />
          <span>{icon}</span>
          <span>{t(tKey)}</span>
        </label>
      ))}
    </div>
  );
}

export default AllergenCheckboxes;
