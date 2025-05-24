import React, { useState, useEffect, useCallback, useContext } from "react";
import axios from "axios";
import { AppContext } from "../AppContext";
import { API } from "../config";

const FORECAST_API = "https://api.openweathermap.org/data/2.5/forecast";
const OWM_KEY      = "6d3ad80f32ae07a071aeb542a0049d46";

// Helper: format a Date object as "YYYY-MM-DD"
const formatDateLocal = date => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function Calendar({ onClose }) {
  const { user } = useContext(AppContext);
  const userId    = user?.id;

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events,      setEvents]      = useState([]);
  const [weather,     setWeather]     = useState([]);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [dayViewOpen, setDayViewOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [editing,     setEditing]     = useState({
    _id:     null,
    date:    "",
    time:    "09:00",
    title:   "",
    content: ""
  });

  const todayString = new Date().toDateString();

  // Fetch reminders
  const fetchEvents = useCallback(() => {
    if (!userId) return;
    axios.get(`${API}/reminders/${userId}`)
      .then(res => setEvents(res.data))
      .catch(err => {
        if (err.response?.status === 404) setEvents([]);
        else console.error(err);
      });
  }, [userId]);

  // Fetch 7-day forecast
  const fetchWeather = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      axios.get(FORECAST_API, {
        params: { appid: OWM_KEY, lat: coords.latitude, lon: coords.longitude, units: "metric" }
      })
      .then(res => {
        const daily = {};
        res.data.list.forEach(item => {
          const dayKey = new Date(item.dt * 1000).toDateString();
          if (!daily[dayKey]) daily[dayKey] = { temps: [], icon: item.weather[0].icon };
          daily[dayKey].temps.push(item.main.temp);
        });
        const arr = Object.entries(daily).slice(0, 7).map(([day, { temps, icon }]) => ({
          day,
          min: Math.min(...temps).toFixed(0),
          max: Math.max(...temps).toFixed(0),
          icon
        }));
        setWeather(arr);
      })
      .catch(console.error);
    });
  }, []);

  useEffect(fetchEvents, [fetchEvents]);
  useEffect(fetchWeather, [fetchWeather]);

  // Month navigation
  const prevMonth = () =>
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const jumpToMonth = e => {
    const [y, m] = e.target.value.split("-").map(Number);
    setCurrentDate(new Date(y, m - 1, 1));
  };

  // Upcoming events (next 7 days)
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);
  const upcomingEvents = events
    .map(e => ({ ...e, dateObj: new Date(e.date) }))
    .filter(e => e.dateObj >= new Date() && e.dateObj <= weekAhead)
    .sort((a, b) => a.dateObj - b.dateObj);

  // Modal actions
  const openNew = day => {
    setEditing({ _id: null, date: formatDateLocal(day), time: "09:00", title: "", content: "" });
    setShowConfirmDelete(false);
    setModalOpen(true);
  };
  const openNewAtHour = hour => {
    const d = new Date(selectedDay);
    setEditing({ _id: null, date: formatDateLocal(d), time: `${String(hour).padStart(2,"0")}:00`, title: "", content: "" });
    setShowConfirmDelete(false);
    setModalOpen(true);
  };
  const openEdit = evt => {
    const d = new Date(evt.date);
    setEditing({
      _id:     evt._id,
      date:    formatDateLocal(d),
      time:    d.toTimeString().slice(0,5),
      title:   evt.title,
      content: evt.content
    });
    setShowConfirmDelete(false);
    setModalOpen(true);
  };
  const deleteEvent = id =>
    axios.delete(`${API}/reminders/${userId}/${id}`).then(fetchEvents);
  const saveEvent = () => {
    const { _id, date, time, title, content } = editing;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date); d.setHours(h, m);
    const payload = { userId, date: d, title, content };
    const req = _id
      ? axios.put(`${API}/reminders/${userId}/${_id}`, payload)
      : axios.post(`${API}/reminders`, payload);
    req.then(() => { fetchEvents(); setModalOpen(false); });
  };

  // Day-detail view
  const openDayView = day => { setSelectedDay(day); setDayViewOpen(true); };
  const closeDayView = () => setDayViewOpen(false);

  // Build month grid
  const y   = currentDate.getFullYear();
  const mo  = currentDate.getMonth();
  const fw  = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday = 0
  const dim = new Date(y, mo + 1, 0).getDate();
  const grid = [];
  for (let i = 0; i < fw; i++) grid.push(null);
  for (let d = 1; d <= dim; d++) grid.push(new Date(y, mo, d));
  while (grid.length < 42) grid.push(null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex">
      {/* Calendar panel */}
      <div className="bg-blue-100 rounded-lg shadow-lg m-2 flex flex-col w-full h-screen max-h-screen">

        {/* Header */}
        <div className="flex-none h-16 p-3 bg-blue-200 border-b border-blue-900 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-blue-800">
            {currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <div className="flex space-x-2">
            <button onClick={prevMonth} className="px-3 py-1 bg-blue-600 text-white rounded">《Prev</button>
            <input
              type="month"
              value={`${y}-${String(mo+1).padStart(2,"0")}`}
              onChange={jumpToMonth}
              className="border px-2 py-1 rounded"
            />
            <button onClick={nextMonth} className="px-3 py-1 bg-blue-600 text-white rounded">Next〉</button>
            <button onClick={onClose} className="px-3 py-1 bg-red-600 text-white rounded">Close</button>
          </div>
        </div>

        {/* Upcoming events */}
        <div className="flex-none h-24 p-3 border-b border-blue-300 bg-blue-50">
          <strong className="text-blue-700">Upcoming (7 days):</strong>
          <div className="mt-2 flex space-x-2 overflow-x-auto">
            {upcomingEvents.length > 0 ? upcomingEvents.map(e => {
              const d = e.dateObj;
              const t = d.toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit" });
              return (
                <button
                  key={e._id}
                  onClick={() => openDayView(d)}
                  className="px-2 py-1 bg-blue-100 border border-blue-400 rounded text-sm hover:bg-blue-200"
                >
                  {d.getDate()}/{d.getMonth()+1} {t} — {e.title}
                </button>
              );
            }) : (
              <span className="text-blue-500">No events</span>
            )}
          </div>
        </div>

        {/* Month grid */}
        <div className="flex-1 overflow-auto grid grid-cols-7 grid-rows-7 divide-y divide-x divide-gray-300">
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(w => (
            <div key={w} className="p-2 bg-blue-300 text-white font-semibold text-center">{w}</div>
          ))}
          {grid.map((day, idx) =>
            day ? (
              <div
                key={idx}
                onClick={() => openDayView(day)}
                className={`p-2 relative cursor-pointer ${
                  day.toDateString() === todayString
                    ? "bg-blue-400 text-white"
                    : day < new Date()
                      ? "bg-gray-300 text-gray-700"
                      : "bg-blue-100 text-blue-900"
                }`}
              >
                <div className="text-xl font-medium">{day.getDate()}</div>

                {/* Weather */}
                {weather.filter(w => w.day === day.toDateString()).map(w => (
                  <div key={w.day} className="flex items-center space-x-1 mt-1">
                    <img
                      src={`https://openweathermap.org/img/wn/${w.icon}@2x.png`}
                      alt="weather"
                      className="w-6 h-6"
                    />
                    <span className="text-s">
                      {w.min}°/{w.max}°
                    </span>
                  </div>
                ))}

                {/* Events */}
                {events
                  .filter(e => new Date(e.date).toDateString() === day.toDateString())
                  .slice(0, 2)
                  .map(e => (
                    <div
                      key={e._id}
                      onClick={ev => { ev.stopPropagation(); openEdit(e); }}
                      className="mt-1 px-1 bg-blue-200 text-xs truncate rounded hover:bg-blue-300 cursor-pointer"
                    >
                      {new Date(e.date).toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit" })} {e.title}
                    </div>
                  ))
                }

                <button
                  onClick={ev => { ev.stopPropagation(); openNew(day); }}
                  className="absolute bottom-1 right-1 text-green-600 font-bold"
                >
                  + Add
                </button>
              </div>
            ) : (
              <div key={idx} className="bg-white" />
            )
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-80">
            <h3 className="text-lg font-bold mb-2">{editing._id ? "Edit Event" : "New Event"}</h3>
            <label className="block font-medium">Date</label>
            <input
              type="date"
              className="w-full mb-2 border p-1"
              value={editing.date}
              onChange={e => setEditing({ ...editing, date: e.target.value })}
            />
            <label className="block font-medium">Time</label>
            <input
              type="time"
              className="w-full mb-2 border p-1"
              value={editing.time}
              onChange={e => setEditing({ ...editing, time: e.target.value })}
            />
            <input
              type="text"
              placeholder="Title"
              className="w-full mb-2 border p-1"
              value={editing.title}
              onChange={e => setEditing({ ...editing, title: e.target.value })}
            />
            <textarea
              placeholder="Details"
              className="w-full mb-2 border p-1"
              value={editing.content}
              onChange={e => setEditing({ ...editing, content: e.target.value })}
            />

            {/* Confirmation panel */}
            {editing._id && !showConfirmDelete && (
              <button
                className="text-red-600 mb-2"
                onClick={() => setShowConfirmDelete(true)}
              >
                Delete
              </button>
            )}
            {showConfirmDelete && (
              <div className="mb-2 p-2 border rounded bg-red-50">
                <p className="mb-2 font-medium">Are you sure you want to delete this event?</p>
                <div className="flex justify-end space-x-2">
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => setShowConfirmDelete(false)}
                  >
                    No
                  </button>
                  <button
                    className="px-2 py-1 bg-red-600 text-white rounded"
                    onClick={() => {
                      deleteEvent(editing._id);
                      setModalOpen(false);
                    }}
                  >
                    Yes
                  </button>
                </div>
              </div>
            )}

              <button onClick={() => setModalOpen(false)}>Cancel</button>
              <button onClick={saveEvent} className="bg-blue-600 text-white px-3 py-1 rounded">
                Save
              </button>
            </div>
          </div>
      
      )}

      {/* Day-detail View */}
      {dayViewOpen && selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl h-full max-h-screen overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{selectedDay.toDateString()}</h3>
              <button onClick={closeDayView} className="text-xl font-bold">✕</button>
            </div>
            <div className="grid grid-cols-4 grid-rows-6 gap-4 h-full">
              {[...Array(24).keys()].map(hour => {
                const evs = events.filter(e => {
                  const d = new Date(e.date);
                  return d.toDateString() === selectedDay.toDateString() && d.getHours() === hour;
                });
                return (
                  <div
                    key={hour}
                    onClick={() => openNewAtHour(hour)}
                    className="bg-teal-100 hover:bg-teal-200 border rounded-lg p-2 flex flex-col cursor-pointer"
                  >
                    <span className="font-semibold">{String(hour).padStart(2,"0")}:00</span>
                    <div className="flex-1 overflow-auto mt-1">
                      {evs.length > 0 ? evs.map(e => (
                        <div
                          key={e._id}
                          onClick={ev => { ev.stopPropagation(); openEdit(e); }}
                          className="bg-blue-50 p-1 rounded mb-1 text-sm cursor-pointer"
                        >
                          <strong>{new Date(e.date).toTimeString().slice(0,5)}</strong> {e.title}
                        </div>
                      )) : (
                        <div className="text-gray-500 text-sm">No events</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
