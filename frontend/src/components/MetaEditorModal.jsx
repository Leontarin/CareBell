// frontend/src/components/MetaEditorModal.jsx
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  PICTOGRAMS,
  ALLERGENS,
  ADDITIVES,
} from "../../../shared/constants/foodMeta.utils.js";

/**
 * Universal metadata editor modal for CareBell
 * Works for FoodManager, UserManager, SettingsModal, etc.
 */
export default function MetaEditorModal({
  isOpen,
  onClose,
  onSave,
  allergens = [],
  additives = [],
  pictograms = [],
  diabeticFriendly = true,
  diabetic = false,

  // visibility
  showAllergens = true,
  showAdditives = true,
  showPictograms = false,
  showDiabeticFriendly = false,
  showDiabetic = false,

  // editability
  editableAllergens = true,
  editableAdditives = true,
  editableDiabetic = true,
}) {
  const { t } = useTranslation();
  const [selAllergens, setSelAllergens] = useState(allergens);
  const [selAdditives, setSelAdditives] = useState(additives);
  const [isDiabetic, setIsDiabetic] = useState(diabetic);

  useEffect(() => {
    if (isOpen) {
      setSelAllergens(allergens);
      setSelAdditives(additives);
      setIsDiabetic(diabetic);
    }
  }, [isOpen, allergens, additives, diabetic]);

  const toggleAllergen = (code) => {
    if (!editableAllergens) return;
    setSelAllergens((prev) =>
      prev.includes(code)
        ? prev.filter((a) => a !== code)
        : [...prev, code]
    );
  };

  const toggleAdditive = (num) => {
    if (!editableAdditives) return;
    setSelAdditives((prev) =>
      prev.includes(num)
        ? prev.filter((a) => a !== num)
        : [...prev, num]
    );
  };

  const handleSave = () => {
    onSave({
      allergens: selAllergens,
      additives: selAdditives,
      pictograms,
      diabeticFriendly,
      diabetic: isDiabetic,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-3xl w-[90%] max-h-[90vh] overflow-y-auto shadow-2xl">
        <h2 className="text-2xl font-semibold text-center mb-4 text-blue-700 dark:text-blue-300">
          {t("Meals.MetaEditor.title")}
        </h2>

        <div className="space-y-6">
          {/* ───────── Allergens ───────── */}
          {showAllergens && (
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t("Meals.MetaEditor.allergens")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {ALLERGENS.map((a) => (
                  <button
                    key={a.code}
                    onClick={() => toggleAllergen(a.code)}
                    disabled={!editableAllergens}
                    className={`border rounded-xl px-3 py-2 text-sm transition-all ${
                      selAllergens.includes(a.code)
                        ? "bg-red-600 text-white border-red-700"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ───────── Additives ───────── */}
          {showAdditives && (
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t("Meals.MetaEditor.additives")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {ADDITIVES.map((a) => (
                  <button
                    key={a.number}
                    onClick={() => toggleAdditive(a.number)}
                    disabled={!editableAdditives}
                    className={`border rounded-xl px-3 py-2 text-sm transition-all ${
                      selAdditives.includes(a.number)
                        ? "bg-blue-600 text-white border-blue-700"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    ({a.number}) {a.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ───────── Pictograms (read-only) ───────── */}
          {showPictograms && (
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t("Meals.MetaEditor.pictograms")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {PICTOGRAMS.map((p) => (
                  <div
                    key={p.key}
                    className={`flex items-center gap-1 border rounded-xl px-3 py-1 text-lg ${
                      pictograms.includes(p.key)
                        ? "bg-green-600 text-white border-green-700"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                    }`}
                  >
                    <span>{p.icon}</span>
                    <span className="text-sm">{p.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ───────── Diabetic Friendly (read-only) ───────── */}
          {showDiabeticFriendly && (
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t("Meals.MetaEditor.diabeticFriendly")}
              </h3>
              <div
                className={`px-4 py-2 rounded-xl text-center font-medium ${
                  diabeticFriendly
                    ? "bg-green-600 text-white"
                    : "bg-red-600 text-white"
                }`}
              >
                {diabeticFriendly
                  ? t("Meals.MetaEditor.friendly")
                  : t("Meals.MetaEditor.notFriendly")}
              </div>
            </section>
          )}

          {/* ───────── Diabetic (user toggle) ───────── */}
          {showDiabetic && (
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t("Meals.MetaEditor.diabetic")}
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isDiabetic}
                  onChange={(e) =>
                    editableDiabetic && setIsDiabetic(e.target.checked)
                  }
                  className="w-5 h-5 accent-blue-600"
                />
                <span>
                  {isDiabetic
                    ? t("Meals.MetaEditor.isDiabetic")
                    : t("Meals.MetaEditor.notDiabetic")}
                </span>
              </div>
            </section>
          )}
        </div>

        {/* ───────── Footer Buttons ───────── */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-400 hover:bg-gray-300 px-4 py-2 rounded text-white"
          >
            {t("Meals.MetaEditor.cancel")}
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
          >
            {t("Meals.MetaEditor.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
