import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ALLERGENS,
  ADDITIVES,
  ALLERGEN_GROUPS,
} from "../../../shared/constants/foodMeta.js";

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
  diabeticFriendly = true,
  diabetic = false,

  // visibility
  showAllergens = true,
  showAdditives = true,
  showPictograms = false, // obsolete (kept for backward compatibility)
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

  /** ──────────────── Allergen logic ──────────────── **/
  const toggleAllergen = (code) => {
    if (!editableAllergens) return;
    setSelAllergens((prev) =>
      prev.includes(code)
        ? prev.filter((a) => a !== code)
        : [...prev, code]
    );
  };

  const toggleGroup = (groupKey) => {
    if (!editableAllergens) return;
    const children = ALLERGEN_GROUPS[groupKey] || [];
    const allSelected = children.every((c) => selAllergens.includes(c));
    setSelAllergens((prev) => {
      const filtered = prev.filter((a) => !children.includes(a));
      return allSelected
        ? filtered // uncheck all
        : [...filtered, ...children]; // check all
    });
  };

  const isGroupFullySelected = (groupKey) => {
    const children = ALLERGEN_GROUPS[groupKey] || [];
    return children.length && children.every((c) => selAllergens.includes(c));
  };

  const isGroupPartiallySelected = (groupKey) => {
    const children = ALLERGEN_GROUPS[groupKey] || [];
    return children.some((c) => selAllergens.includes(c)) && !isGroupFullySelected(groupKey);
  };

  /** ──────────────── Additive logic ──────────────── **/
  const toggleAdditive = (num) => {
    if (!editableAdditives) return;
    setSelAdditives((prev) =>
      prev.includes(num)
        ? prev.filter((a) => a !== num)
        : [...prev, num]
    );
  };

  /** ──────────────── Save handler ──────────────── **/
  const handleSave = () => {
    const payload = {};

    if (showAllergens) payload.allergens = selAllergens;
    if (showAdditives) payload.additives = selAdditives;
    if (showDiabetic) payload.diabetic = isDiabetic;
    if (showDiabeticFriendly) payload.diabeticFriendly = diabeticFriendly;

    onSave(payload);
    onClose();
  };

  /** ──────────────── Derive allergen rendering ──────────────── **/
  const groupKeys = Object.keys(ALLERGEN_GROUPS);
  const groupAllergens = groupKeys.map((k) =>
    ALLERGENS.find((a) => a.code === k)
  );
  const standaloneAllergens = ALLERGENS.filter(
    (a) => !groupKeys.includes(a.code) && !Object.values(ALLERGEN_GROUPS).flat().includes(a.code)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-3xl w-[90%] max-h-[90vh] overflow-y-auto shadow-2xl">
        <h2 className="text-2xl font-semibold text-center mb-4 text-blue-700 dark:text-blue-300">
          {t("Meals.MetaEditor.title")}
        </h2>

        <div className="space-y-6">
          {/* ───────── Allergen Groups ───────── */}
          {showAllergens && (
            <>
              <section>
                <h3 className="text-lg font-semibold mb-2">
                  {t("Meals.MetaEditor.allergens")}
                </h3>

                {groupAllergens.map((parent) => {
                  if (!parent) return null;
                  const children = ALLERGEN_GROUPS[parent.code] || [];
                  return (
                    <div key={parent.code} className="mb-4">
                      {/* Parent checkbox */}
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={isGroupFullySelected(parent.code)}
                          ref={(el) => {
                            if (el)
                              el.indeterminate = isGroupPartiallySelected(parent.code);
                          }}
                          onChange={() => toggleGroup(parent.code)}
                          disabled={!editableAllergens}
                          className="w-5 h-5 accent-blue-600"
                        />
                        <span className="font-semibold">
                          {parent.label}
                        </span>
                      </div>

                      {/* Children */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 ml-6">
                        {children.map((code) => {
                          const allergen = ALLERGENS.find((a) => a.code === code);
                          if (!allergen) return null;
                          return (
                            <button
                              key={allergen.code}
                              onClick={() => toggleAllergen(allergen.code)}
                              disabled={!editableAllergens}
                              className={`border rounded-xl px-3 py-2 text-sm transition-all ${
                                selAllergens.includes(allergen.code)
                                  ? "bg-red-600 text-white border-red-700"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {allergen.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Standalone allergens */}
                {standaloneAllergens.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-2">
                      {t("Meals.MetaEditor.otherAllergens")}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {standaloneAllergens.map((a) => (
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
                  </div>
                )}
              </section>
            </>
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
