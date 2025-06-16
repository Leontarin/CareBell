import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { API } from "../config";
import { AppContext } from "../AppContext";
import { useTranslation } from "react-i18next";

export default function Medication() {
  /* ---- Translation ---- */
  const { t } = useTranslation();
  /* ===== CONFIG ===== */
  const { user } = useContext(AppContext);
  const userId = user?.id;
  /* ===== STATE ===== */
  const [meds, setMeds]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* add-form */
  const [isAdding, setIsAdding] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({
    name: "", dosage: "", frequency: "", lastTaken: "", nextDue: "",
  });

  /* confirmations */
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmTakeId,   setConfirmTakeId]   = useState(null);

  /* Timer – to enable the button an hour before taking the medicine*/
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000); // A minute
    return () => clearInterval(id);
  }, []);

  /* ===== FETCH ===== */
  useEffect(() => {
    axios
      .get(`${API}/medications/getAll/${userId}`)
      .then((r) => setMeds(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  /* ===== HELPERS ===== */
  const calcNextISO = (hrs) =>
    !isNaN(hrs) ? new Date(Date.now() + hrs * 3_600_000).toISOString() : null;

  const isWithinWindow = (nextIso) => {
    if (!nextIso) return true;
    const diff = new Date(nextIso).getTime() - nowTick;        
    return diff <= 3_600_000 || diff < 0;                   //A hour before and after the nextDue   
  };

  /* ===== MARK AS TAKEN ===== */
  const markTakenNow = (index, id) => {
    const nowISO  = new Date().toISOString();
    const hrs     = parseInt(meds[index].frequency);
    const nextISO = calcNextISO(hrs);

    /* UI */
    setMeds((prev) => {
      const upd = [...prev];
      upd[index] = { ...upd[index], taken: true, lastTaken: nowISO, nextDue: nextISO ?? upd[index].nextDue };
      return upd;
    });

    /* PATCH to DB */
    axios.patch(`${API}/medications/${id}/updateLastTaken`, { lastTaken: nowISO }).catch(console.error);
    if (nextISO)
      axios.patch(`${API}/medications/${id}/updateNextDue`, { nextDue: nextISO }).catch(console.error);
  };

  /* ===== ADD ===== */
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const saveMedication = () => {
    if (!form.name || !form.dosage) return alert("Name & dosage required");
    setSaving(true);
    axios
      .post(`${API}/medications/addMedication`, { userId, ...form })
      .then((r) => setMeds((p) => [...p, r.data]))
      .catch((e) => alert(e.response?.data?.message || e.message))
      .finally(() => {
        setSaving(false);
        setIsAdding(false);
        setForm({ name: "", dosage: "", frequency: "", lastTaken: "", nextDue: "" });
      });
  };

  /* ===== DELETE ===== */
  const askDelete     = (id) => setConfirmDeleteId(id);
  const cancelDelete  = ()  => setConfirmDeleteId(null);
  const confirmDelete = (id) => {
    axios
      .delete(`${API}/medications/${id}`)
      .then(() => setMeds((p) => p.filter((m) => m._id !== id)))
      .catch((e) => alert(e.response?.data?.message || e.message))
      .finally(() => setConfirmDeleteId(null));
  };

  /* ===== RENDER ===== */
  if (loading) return <p className="text-center">{t("Meals.loadingLabel")}</p>;
  if (error)   return <p className="text-center text-red-600">{error}</p>;

  return (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl overflow-hidden">
    {/* Enhanced Header */}
    <div className="bg-white shadow-lg p-6 border-b-4 border-blue-200">
      <div className="flex items-center justify-center">
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white font-bold text-xl rounded-2xl px-8 py-4 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
          >
            <span className="mr-3 text-2xl">💊</span>
            {t("Medication.addMedication")}
          </button>
        )}
      </div>
    </div>

    <div className="p-6">
      {/* Enhanced ADD FORM */}
      {isAdding && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl border-2 border-blue-200 p-8 mb-8">
          <h3 className="text-3xl font-bold text-blue-900 text-center mb-8">
            <span className="mr-3">💊</span>
            {t("Medication.addMedication")}
          </h3>
          
          <div className="space-y-6">
            {[
              { lbl: t("Medication.MedicationName"), name: "name", placeholder: "Aspirin", icon: "💊" },
              { lbl: t("Medication.dosage"), name: "dosage", placeholder: "100 mg", icon: "⚖️" },
              { lbl: t("Medication.frequencyHours"), name: "frequency", placeholder: "8", icon: "⏰" },
            ].map((f) => (
              <div key={f.name} className="space-y-3">
                <label className="flex items-center text-xl font-bold text-gray-800">
                  <span className="mr-3 text-2xl">{f.icon}</span>
                  {f.lbl}
                </label>
                <input
                  name={f.name}
                  value={form[f.name]}
                  onChange={handleChange}
                  placeholder={f.placeholder}
                  className="w-full rounded-2xl border-3 border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-200 text-xl px-6 py-4 shadow-lg transition-all duration-200"
                />
              </div>
            ))}

            <div className="flex justify-center gap-6 pt-6">
              <button 
                onClick={() => setIsAdding(false)} 
                className="px-8 py-4 rounded-2xl bg-gray-300 hover:bg-gray-400 text-gray-800 text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <span className="mr-2">❌</span>
                {t("Medication.cancel")}
              </button>
              <button
                onClick={saveMedication}
                disabled={saving}
                className="px-8 py-4 rounded-2xl text-white font-bold text-xl transition-all duration-200 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 disabled:opacity-60 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
              >
                <span className="mr-2">💾</span>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Medication LIST */}
      <div className="max-w-2xl mx-auto space-y-6">
        {meds.map((m, i) => {
          const canTake = !m.taken && isWithinWindow(m.nextDue);
          return (
            <div key={m._id} className="bg-white rounded-3xl shadow-xl border-2 border-blue-100 hover:border-blue-300 hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300 overflow-hidden">
              <div className="p-6">
                {/* Medication Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-full w-16 h-16 flex items-center justify-center text-white text-2xl shadow-lg">
                    💊
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900">{m.name}</h3>
                    <p className="text-lg text-blue-600 font-semibold">
                      ⚖️ {t("Medication.dosage")} {m.dosage}
                    </p>
                  </div>
                  {canTake && (
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-bold">
                      ✅ Ready
                    </div>
                  )}
                </div>

                {/* Medication Details */}
                <div className="bg-blue-50 rounded-2xl p-4 mb-4 space-y-2">
                  {m.frequency && (
                    <div className="flex items-center text-lg">
                      <span className="mr-3">⏰</span>
                      <span className="font-semibold">{t("Medication.frequency")} {m.frequency} {t("Medication.hours")}</span>
                    </div>
                  )}
                  <div className="flex items-center text-lg">
                    <span className="mr-3">📅</span>
                    <span className="font-semibold">{t("Medication.lastTaken")}</span>
                    <span className="ml-2">{m.lastTaken ? new Date(m.lastTaken).toLocaleString() : "Never"}</span>
                  </div>
                  {m.nextDue && (
                    <div className="flex items-center text-lg">
                      <span className="mr-3">⏰</span>
                      <span className="font-semibold">{t("Medication.nextDue")}</span>
                      <span className="ml-2">{new Date(m.nextDue).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {confirmDeleteId === m._id ? (
                  <div className="bg-red-50 rounded-2xl p-4 space-y-4">
                    <p className="text-xl text-gray-800 text-center">
                      <span className="mr-2">⚠️</span>
                      {t("Medication.deleteLabel")} <b>{m.name}</b>?
                    </p>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => confirmDelete(m._id)} 
                        className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white py-3 rounded-2xl text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      >
                        <span className="mr-2">✅</span>
                        {t("Medication.yesDelete")}
                      </button>
                      <button 
                        onClick={cancelDelete} 
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-2xl text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      >
                        <span className="mr-2">❌</span>
                        {t("Medication.noKeep")}
                      </button>
                    </div>
                  </div>
                ) : confirmTakeId === m._id ? (
                  <div className="bg-green-50 rounded-2xl p-4 space-y-4">
                    <p className="text-xl text-gray-800 text-center">
                      <span className="mr-2">💊</span>
                      {t("Medication.Confirmation")} <b>{m.name}</b>?
                    </p>
                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          setConfirmTakeId(null);
                          markTakenNow(i, m._id);
                        }}
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white py-3 rounded-2xl text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      >
                        <span className="mr-2">✅</span>
                        {t("Medication.yesTaken")}
                      </button>
                      <button
                        onClick={() => setConfirmTakeId(null)}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-2xl text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      >
                        <span className="mr-2">❌</span>
                        {t("Medication.noCancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={() => setConfirmTakeId(m._id)}
                      disabled={!canTake}
                      className={`flex-1 text-xl font-bold text-white rounded-2xl py-4 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 ${
                        canTake
                          ? "bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700"
                          : "bg-gray-400 cursor-not-allowed transform-none"
                      }`}
                    >
                      <span className="mr-2">{m.taken ? "✅" : "💊"}</span>
                      {m.taken ? t("Medication.taken") : t("Medication.MarkAsTaken")}
                    </button>

                    <button
                      onClick={() => askDelete(m._id)}
                      className="bg-red-100 hover:bg-red-200 border-2 border-red-300 hover:border-red-400 px-6 py-4 text-lg font-bold text-red-700 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    >
                      <span className="mr-2">🗑️</span>
                      {t("Medication.deleteLabel")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {meds.length === 0 && (
          <div className="text-center py-12 bg-white rounded-3xl shadow-lg border-2 border-gray-200">
            <div className="text-6xl mb-4">💊</div>
            <p className="text-2xl text-gray-600 font-semibold">
              No medications added yet
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
);
}
