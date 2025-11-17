// frontend/src/components/MetaEditorModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  ALLERGENS,
  ADDITIVES,
  sortAdditives,
  derivePictogramsFromAllergens,
  PICTOGRAMS,
  PICTOGRAM_ORDER,
} from "../../../shared/constants/foodMeta.utils.js";

import { ALLERGEN_GROUPS } from "../../../shared/constants/foodMeta.js";

const MANUAL_ONLY_KEYS = ["R", "S", "V", "Y"];

export default function MetaEditorModal({
  isOpen,
  onClose,
  onSave,

  // incoming values
  allergens = [],
  additives = [],
  pictograms = [],          // incoming picture set (manual + auto)
  diabetic = false,
  diabeticFriendly = false,

  // visibility
  showPictograms = true,
  showAllergens = true,
  showAdditives = false,
  showDiabetic = false,
  showDiabeticFriendly = false,

  // editability
  editablePictograms = true,
  editableAllergens = true,
  editableAdditives = true,
  editableDiabetic = true,
  editableDiabeticFriendly = true,
}) {
  const { t } = useTranslation();

  // ───────────────────────────────
  // Internal State
  // ───────────────────────────────
  const [selAllergens, setSelAllergens] = useState(allergens);
  const [selAdditives, setSelAdditives] = useState(additives);
  const [selPictos, setSelPictos] = useState(pictograms); // manual+auto incoming
  const [isDiabetic, setIsDiabetic] = useState(diabetic);
  const [isFriendly, setIsFriendly] = useState(diabeticFriendly);

  useEffect(() => {
    if (isOpen) {
      setSelAllergens(allergens || []);
      setSelAdditives(additives || []);
      setSelPictos(pictograms || []);
      setIsDiabetic(!!diabetic);
      setIsFriendly(!!diabeticFriendly);
    }
  }, [isOpen]);

  // ───────────────────────────────
  // Auto pictograms (from allergens)
  // ───────────────────────────────
  const autoPictos = useMemo(() => {
    return derivePictogramsFromAllergens(selAllergens);
  }, [selAllergens]);

  // Manual pictograms = all selected minus auto ones
  const manualPictos = useMemo(() => {
    return selPictos.filter((p) => !autoPictos.includes(p));
  }, [selPictos, autoPictos]);

  // Final pictos = auto + manual (sorted)
  const finalPictos = useMemo(() => {
    const merged = [...new Set([...autoPictos, ...manualPictos])];
    return merged.sort(
      (a, b) => PICTOGRAM_ORDER.indexOf(a) - PICTOGRAM_ORDER.indexOf(b)
    );
  }, [autoPictos, manualPictos]);

  // ───────────────────────────────
  // Allergen grouping (A / H / N)
  // ───────────────────────────────
  const PARENTS = ["A", "H", "N"];
  const childrenOf = (parent) => ALLERGEN_GROUPS[parent] || [];

  const { groups, rest } = useMemo(() => {
    const groups = Object.fromEntries(PARENTS.map((p) => [p, childrenOf(p)]));
    const groupedCodes = new Set(PARENTS.flatMap((p) => [p, ...childrenOf(p)]));
    const rest = ALLERGENS.map((a) => a.code).filter((c) => !groupedCodes.has(c));
    return { groups, rest };
  }, []);

  // ───────────────────────────────
  // Toggle logic
  // ───────────────────────────────
  const isChecked = (code) => selAllergens.includes(code);

  const toggleAllergen = (code) => {
    if (!editableAllergens) return;
    setSelAllergens((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code]
    );
  };

  const toggleParent = (parent) => {
    if (!editableAllergens) return;
    const kids = childrenOf(parent);
    const all = [parent, ...kids];
    const hasAll = all.every((c) => selAllergens.includes(c));

    setSelAllergens((prev) => {
      if (hasAll) return prev.filter((c) => !all.includes(c));
      const set = new Set(prev);
      all.forEach((c) => set.add(c));
      return [...set];
    });
  };

  const toggleAdditive = (num) => {
    if (!editableAdditives) return;
    setSelAdditives((prev) => {
      let next;
      if (prev.includes(num)) next = prev.filter((n) => n !== num);
      else next = [...prev, num];
      return sortAdditives(next);
    });
  };

  const toggleManualPicto = (key) => {
    if (!editablePictograms) return;
    if (autoPictos.includes(key)) return; // auto locked

    setSelPictos((prev) => {
      const isSelected = prev.includes(key);
      if (isSelected) {
        return prev.filter((p) => p !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  // ───────────────────────────────
  // Save
  // ───────────────────────────────
  const handleSave = () => {
    const payload = {};

    if (showAllergens) payload.allergens = selAllergens;
    if (showAdditives) payload.additives = selAdditives;
    if (showPictograms) payload.pictograms = finalPictos;
    if (showDiabetic) payload.diabetic = isDiabetic;
    if (showDiabeticFriendly) payload.diabeticFriendly = isFriendly;

    onSave(payload);
    onClose();
  };

  if (!isOpen) return null;

  // ───────────────────────────────
  // Label lookup
  // ───────────────────────────────
  const labelFor = (code) => {
    const a = ALLERGENS.find((x) => x.code === code);
    return t(a?.tKey || `Meals.Meta.Allergens.${code}`, a?.label || code);
  };

  const labelPicto = (p) => {
    const obj = PICTOGRAMS.find((x) => x.key === p);
    return t(obj?.tKey, obj?.label || p);
  };

  const iconPicto = (p) => {
    const obj = PICTOGRAMS.find((x) => x.key === p);
    return obj?.icon || p;
  };

  const isManualOnly = (p) => ["R", "S", "V", "Y"].includes(p);
  const autoOrMixedPictos = PICTOGRAMS.filter(p => !MANUAL_ONLY_KEYS.includes(p.key));
  const manualOnlyPictos = PICTOGRAMS.filter(p => MANUAL_ONLY_KEYS.includes(p.key));
  // ───────────────────────────────
  // RENDER
  // ───────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-3xl w-[90%] max-h-[90vh] overflow-y-auto shadow-2xl">

        <h2 className="text-2xl font-semibold text-center mb-4 text-blue-700 dark:text-blue-300">
          {t("Meals.MetaEditor.title")}
        </h2>

        <div className="space-y-6">

          {/* ───────────── PICTOGRAMS ───────────── */}
          {showPictograms && (
            <section>
              <h3 className="text-lg font-semibold mb-3">
                {t("Meals.MetaEditor.pictograms", "Pictograms")}
              </h3>

              {/* First row: normal pictograms */}
              <div className="flex flex-wrap gap-3 mb-4">
                {autoOrMixedPictos.map((p) => {
                  const auto = autoPictos.includes(p.key);
                  const selected = finalPictos.includes(p.key);

                  const base = "w-14 h-14 flex flex-col items-center justify-center rounded-lg border text-xs font-semibold transition-all";
                  const style = auto
                    ? "bg-blue-200 dark:bg-blue-900 border-blue-500 cursor-not-allowed opacity-80"
                    : selected
                    ? "bg-blue-600 text-white border-blue-700"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-400 dark:border-gray-700";

                  return (
                    <button
                      key={p.key}
                      onClick={() => !auto && toggleManualPicto(p.key)}
                      disabled={auto}
                      className={`${base} ${style}`}
                      title={auto ? t("Meals.MetaEditor.autoFromAllergens") : labelPicto(p.key)}
                    >
                      <span className="text-xl leading-none">{iconPicto(p.key)}</span>
                      <span className="leading-none mt-1">{p.key}</span>
                    </button>
                  );
                })}
              </div>

              {/* Second row: manual-only pictograms */}
              <div className="flex flex-wrap gap-3">
                {manualOnlyPictos.map((p) => {
                  const selected = finalPictos.includes(p.key);

                  return (
                    <button
                      key={p.key}
                      onClick={() => toggleManualPicto(p.key)}
                      className={`w-14 h-14 flex flex-col items-center justify-center rounded-lg border text-xs font-semibold transition-all ${
                        selected
                          ? "bg-blue-600 text-white border-blue-700"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-400 dark:border-gray-700"
                      }`}
                      title={labelPicto(p.key)}
                    >
                      <span className="text-xl leading-none">{iconPicto(p.key)}</span>
                      <span className="leading-none mt-1">{p.key}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ───────────── ALLERGENS ───────────── */}
          {!!showAllergens && (
            <section>
              <h3 className="text-lg font-semibold mb-3">
                {t("Meals.MetaEditor.allergens")}
              </h3>

              {/* Parent Groups */}
              <div className="space-y-4">
                {/* A */}
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={
                        isChecked("A") && childrenOf("A").every((c) => isChecked(c))
                      }
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
                        className={
                          isChecked(code)
                            ? "border rounded-xl px-3 py-2 text-sm bg-red-600 text-white border-red-700"
                            : "border rounded-xl px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800"
                        }
                      >
                        ({code}) {labelFor(code)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* H */}
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={
                        isChecked("H") && childrenOf("H").every((c) => isChecked(c))
                      }
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
                        className={
                          isChecked(code)
                            ? "border rounded-xl px-3 py-2 text-sm bg-red-600 text-white border-red-700"
                            : "border rounded-xl px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800"
                        }
                      >
                        ({code}) {labelFor(code)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* N */}
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={
                        isChecked("N") && childrenOf("N").every((c) => isChecked(c))
                      }
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
                        className={
                          isChecked(code)
                            ? "border rounded-xl px-3 py-2 text-sm bg-red-600 text-white border-red-700"
                            : "border rounded-xl px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800"
                        }
                      >
                        ({code}) {labelFor(code)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Standalone Allergens */}
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
                      className={
                        isChecked(code)
                          ? "border rounded-xl px-3 py-2 text-sm bg-red-600 text-white border-red-700"
                          : "border rounded-xl px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800"
                      }
                    >
                      ({code}) {labelFor(code)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ───────────── ADDITIVES ───────────── */}
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
                    className={
                      selAdditives.includes(a.number)
                        ? "border rounded-xl px-3 py-2 text-sm bg-blue-600 text-white border-blue-700"
                        : "border rounded-xl px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800"
                    }
                  >
                    ({a.number}) {t(a.tKey, a.label)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ───────────── DIABETIC USER ───────────── */}
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

          {/* ───────────── DIABETIC FRIENDLY (FOOD) ───────────── */}
          {showDiabeticFriendly && (
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

        {/* FOOTER */}
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
