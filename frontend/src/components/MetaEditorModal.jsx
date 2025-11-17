// frontend/src/components/MetaEditorModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ALLERGENS,
  ADDITIVES,
} from "../../../shared/constants/foodMeta.utils.js";
import { ALLERGEN_GROUPS } from "../../../shared/constants/foodMeta.js";

export default function MetaEditorModal({
  isOpen,
  onClose,
  onSave,

  // incoming values
  allergens = [],
  additives = [],
  diabetic = false,           // for user context
  diabeticFriendly = false,   // for food context

  // visibility
  showAllergens = true,
  showAdditives = false,
  showDiabetic = false,         // user diabetic status
  showDiabeticFriendly = false, // food diabetic friendliness

  // editability
  editableAllergens = true,
  editableAdditives = true,
  editableDiabetic = true,
  editableDiabeticFriendly = true,
}) {
  const { t } = useTranslation();

  // ───────── state ─────────
  const [selAllergens, setSelAllergens] = useState(allergens);
  const [selAdditives, setSelAdditives] = useState(additives);
  const [isDiabetic, setIsDiabetic] = useState(diabetic);
  const [isFriendly, setIsFriendly] = useState(diabeticFriendly);

  useEffect(() => {
    if (isOpen) {
      setSelAllergens(allergens || []);
      setSelAdditives(additives || []);
      setIsDiabetic(!!diabetic);
      setIsFriendly(!!diabeticFriendly);
    }
  }, [isOpen]);

  // ───────────────── allergen grouping ─────────────────
  const PARENTS = ["A", "H", "N"]; // gluten, tree nuts, molluscs
  const childrenOf = (parent) => ALLERGEN_GROUPS[parent] || [];

  // Split allergens into groups and standalones
  const {
    groups,    // { A: [...], H: [...], N: [] }
    rest,      // remaining single codes like B,C,D,E,F,G,I,J,K,L,M
  } = useMemo(() => {
    const groups = Object.fromEntries(PARENTS.map(p => [p, childrenOf(p)]));
    const groupedCodes = new Set(
      PARENTS.flatMap(p => [p, ...childrenOf(p)])
    );
    const rest = ALLERGENS
      .map(a => a.code)
      .filter(code => !groupedCodes.has(code));
    return { groups, rest };
  }, []);

  // ───────────────── helpers ─────────────────
  const isChecked = (code) => selAllergens.includes(code);

  const toggleAllergen = (code) => {
    if (!editableAllergens) return;
    setSelAllergens(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Toggle a parent: include/exclude parent and all children
  const toggleParent = (parent) => {
    if (!editableAllergens) return;
    const kids = childrenOf(parent);
    const allCodes = [parent, ...kids];
    const hasAll = allCodes.every(c => selAllergens.includes(c));
    setSelAllergens(prev => {
      if (hasAll) {
        // remove parent + all kids
        return prev.filter(c => !allCodes.includes(c));
      } else {
        // add parent + all kids (avoid duplicates)
        const set = new Set(prev);
        allCodes.forEach(c => set.add(c));
        return [...set];
      }
    });
  };

  const toggleAdditive = (num) => {
    if (!editableAdditives) return;
    setSelAdditives(prev =>
      prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
    );
  };

  // Build payload respecting visibility: if a section is hidden, we DO NOT send it
  const handleSave = () => {
    const payload = {};
    if (showAllergens) payload.allergens = selAllergens;
    if (showAdditives) payload.additives = selAdditives;
    if (showDiabetic) payload.diabetic = isDiabetic;
    if (showDiabeticFriendly) payload.diabeticFriendly = isFriendly;
    onSave(payload);
    onClose();
  };
  
  if (!isOpen) return null;

  // Label lookup
  const labelFor = (code) => {
    const a = ALLERGENS.find(x => x.code === code);
    return t(a?.tKey || `Meals.Meta.Allergens.${code}`, a?.label || code);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-3xl w-[90%] max-h-[90vh] overflow-y-auto shadow-2xl">
        <h2 className="text-2xl font-semibold text-center mb-4 text-blue-700 dark:text-blue-300">
          {t("Meals.MetaEditor.title")}
        </h2>

        <div className="space-y-6">
          {/* ───────── Allergens (default visible) ───────── */}
          {!!showAllergens && (
            <section>
              <h3 className="text-lg font-semibold mb-3">
                {t("Meals.MetaEditor.allergens")}
              </h3>

              {/* Parent groups */}
              <div className="space-y-4">
                {/* A (Gluten cereals) */}
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={isChecked("A") && childrenOf("A").every(isChecked)}
                      onChange={() => toggleParent("A")}
                      disabled={!editableAllergens}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="font-medium">{labelFor("A")}</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {childrenOf("A").map((code) => (
                      <button
                        key={code}
                        onClick={() => toggleAllergen(code)}
                        disabled={!editableAllergens}
                        className={`border rounded-xl px-3 py-2 text-sm transition-all ${
                          isChecked(code)
                            ? "bg-red-600 text-white border-red-700"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        ({code}) {labelFor(code)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* H (Tree nuts) */}
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={isChecked("H") && childrenOf("H").every(isChecked)}
                      onChange={() => toggleParent("H")}
                      disabled={!editableAllergens}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="font-medium">{labelFor("H")}</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {childrenOf("H").map((code) => (
                      <button
                        key={code}
                        onClick={() => toggleAllergen(code)}
                        disabled={!editableAllergens}
                        className={`border rounded-xl px-3 py-2 text-sm transition-all ${
                          isChecked(code)
                            ? "bg-red-600 text-white border-red-700"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                       ({code}) {labelFor(code)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* N (Molluscs) */}
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={isChecked("N") && childrenOf("N").every(isChecked)}
                      onChange={() => toggleParent("N")}
                      disabled={!editableAllergens}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="font-medium">{labelFor("N")}</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {childrenOf("N").map((code) => (
                      <button
                        key={code}
                        onClick={() => toggleAllergen(code)}
                        disabled={!editableAllergens}
                        className={`border rounded-xl px-3 py-2 text-sm transition-all ${
                          isChecked(code)
                            ? "bg-red-600 text-white border-red-700"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                       ({code}) {labelFor(code)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Standalone allergens (not in A/H/N groups) */}
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">
                  {t("Meals.MetaEditor.otherAllergens", "Other allergens")}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {rest.map((code) => (
                    <button
                      key={code}
                      onClick={() => toggleAllergen(code)}
                      disabled={!editableAllergens}
                      className={`border rounded-xl px-3 py-2 text-sm transition-all ${
                        isChecked(code)
                          ? "bg-red-600 text-white border-red-700"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                     ({code}) {labelFor(code)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ───────── Additives (hidden by default) ───────── */}
          {!!showAdditives && (
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
                    ({a.number}) {t(a.tKey, a.label)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ───────── Diabetic (hidden by default) ───────── */}
          {!!showDiabetic && (
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t("Meals.MetaEditor.diabetic")}
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isDiabetic}
                  onChange={(e) => editableDiabetic && setIsDiabetic(e.target.checked)}
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

          {/* ───────── Diabetic Friendly (for foods) ───────── */}
          {!!showDiabeticFriendly && (
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t("Meals.MetaEditor.diabeticFriendly")}
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isFriendly}
                  onChange={(e) =>
                    editableDiabeticFriendly && setIsFriendly(e.target.checked)
                  }
                  className="w-5 h-5 accent-blue-600"
                />
                <span>
                  {isFriendly
                    ? t("Meals.MetaEditor.friendly")
                    : t("Meals.MetaEditor.notFriendly")}
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
