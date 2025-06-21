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
    <div className="min-h-screen bg-slate-400 p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className=" bg-blue-900 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-xl transition"
          >
            {t("Medication.addMedication")}
          </button>
        )}
      </div>

      {/* ADD FORM */}
      {isAdding && (
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 mb-6 space-y-6 dark:text-gray-100">
          {[
            { lbl: t("Medication.MedicationName"), name: "name",        placeholder: "Aspirin" },
            { lbl: t("Medication.dosage"),          name: "dosage",      placeholder: "100 mg" },
            { lbl: t("Medication.frequencyHours"), name: "frequency",   placeholder: "8" },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-lg font-semibold text-gray-700">{f.lbl}</label>
              <input
                name={f.name}
                value={form[f.name]}
                onChange={handleChange}
                placeholder={f.placeholder}
                className="mt-2 w-full rounded-md border-2 border-blue-900
                           focus:border-blue-700 focus:ring-blue-700 text-lg px-4 py-3"
              />
            </div>
          ))}

          <div className="flex justify-end gap-4">
            <button onClick={() => setIsAdding(false)} className="px-5 py-2 rounded-xl bg-gray-300 hover:bg-gray-400 transition text-lg">
              {t("Medication.cancel")}
            </button>
            <button
              onClick={saveMedication}
              disabled={saving}
              className="px-6 py-2 rounded-xl text-white font-semibold transition
                         bg-blue-900 hover:bg-blue-700 disabled:opacity-60 text-lg"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* LIST */}
      <div className="grid gap-6 max-w-md mx-auto">
        {meds.map((m, i) => {
          const canTake = !m.taken && isWithinWindow(m.nextDue);
          return (
            <div key={m._id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 flex flex-col gap-3 dark:text-gray-100">
              <div className="text-xl font-semibold text-gray-900">{m.name}</div>
              <div className="text-gray-700 text-sm">{t("Medication.dosage")} {m.dosage}</div>
              {m.frequency && <div className="text-gray-700 text-sm">{t("Medication.frequency")} {m.frequency} {t("Medication.hours")}</div>}
              <div className="text-gray-900 text-sm font-semibold">
                {t("Medication.lastTaken")}&nbsp;{m.lastTaken ? new Date(m.lastTaken).toLocaleString() : "Never"}
              </div>
              {m.nextDue && (
                <div className="text-gray-900 text-sm font-semibold">
                  {t("Medication.nextDue")}&nbsp;{new Date(m.nextDue).toLocaleString()}
                </div>
              )}

              {/* BUTTON BLOCK */}
              {confirmDeleteId === m._id ? (
                /* delete confirm */
                <div className="flex flex-col gap-3">
                  <span className="text-gray-800">{t("Medication.deleteLabel")} <b>{m.name}</b>?</span>
                  <div className="flex gap-4">
                    <button onClick={() => confirmDelete(m._id)} className="flex-1 bg-gray-600 hover:bg-red-500 text-white py-2 rounded-lg text-lg">
                      {t("Medication.yesDelete")}
                    </button>
                    <button onClick={cancelDelete} className="flex-1 bg-gray-300 hover:bg-gray-400 py-2 rounded-lg text-lg">
                      {t("Medication.noKeep")}
                    </button>
                  </div>
                </div>
              ) : confirmTakeId === m._id ? (
                /* take confirm */
                <div className="flex flex-col gap-3">
                  <span className="text-gray-800">{t("Medication.Confirmation")} <b>{m.name}</b>?</span>
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setConfirmTakeId(null);
                        markTakenNow(i, m._id);
                      }}
                      className="flex-1 bg-blue-900 hover:bg-blue-700 text-white py-2 rounded-lg text-lg"
                    >
                      {t("Medication.yesTaken")}
                    </button>
                    <button
                      onClick={() => setConfirmTakeId(null)}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 py-2 rounded-lg text-lg"
                    >
                      {t("Medication.noCancel")}
                    </button>
                  </div>
                </div>
              ) : (
                /* normal buttons */
                <div className="flex gap-4">
                  {/* Mark as Taken – main big button*/}
                  <button
                    onClick={() => setConfirmTakeId(m._id)}
                    disabled={!canTake}
                    className={`flex-1 text-lg font-semibold text-white rounded-xl py-2 transition ${
                      canTake
                        ? "bg-blue-900 hover:bg-blue-700 border-2 border-blue-950"
                        : "bg-gray-400 cursor-not-allowed border-2 border-gray-500"
                    }`}
                  >
                    {m.taken ? t("Medication.taken") : t("Medication.MarkAsTaken")}
                  </button>

                  {/* Delete button style*/}
                  <button
                    onClick={() => askDelete(m._id)}
                    className="bg-gray-300 px-4 py-2 text-sm font-semibold text-gray-900
                               border border-gray-900 rounded-md
                               hover:bg-red-100 transition"
                  >
                    {t("Medication.deleteLabel")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
