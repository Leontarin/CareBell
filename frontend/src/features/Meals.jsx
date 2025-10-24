import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import mealsImage from "../resources/meals.png";

export default function Meals() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div
      className="
        fixed inset-0 z-50 flex items-center justify-center
        bg-black bg-opacity-90 backdrop-blur-md
      "
    >
      {/* Exit Button */}
      <button
        onClick={() => navigate("/")}
        className="
          absolute top-6 right-6
          text-white bg-red-600 hover:bg-red-700
          px-4 py-2 rounded-xl text-xl font-semibold shadow-lg
          transition
        "
      >
        ✕ {t("Meals.exit") || "Exit"}
      </button>

      {/* Image */}
      <img
        src={mealsImage}
        alt="Meals preview"
        className="
          max-w-[90%] max-h-[90%]
          rounded-2xl shadow-2xl border-4 border-white
          object-contain
        "
      />
    </div>
  );
}
