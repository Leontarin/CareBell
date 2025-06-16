import React, { useState, useEffect, useCallback, useContext } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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

useEffect(() => {
  if (modalOpen || dayViewOpen) {
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
  } else {
    // Restore body scroll
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.documentElement.style.overflow = '';
  }

  // Cleanup on unmount
  return () => {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.documentElement.style.overflow = '';
  };
}, [modalOpen, dayViewOpen]);

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
  <div className="fixed inset-0 bg-black bg-opacity-60 flex z-[9999]">
    {/* Clean Calendar panel */}
    <div className="bg-white rounded-3xl shadow-2xl m-4 flex flex-col w-full h-full border-4 border-blue-200 relative z-[10000] overflow-hidden">

      {/* Simple Header */}
      <div className="flex-none bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold flex items-center">
            <span className="mr-3 text-4xl">📅</span>
            {currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <div className="flex items-center space-x-4">
            <button 
              onClick={prevMonth} 
              className="px-6 py-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              ← {t("Calendar.prev")}
            </button>
            <input
              type="month"
              value={`${y}-${String(mo+1).padStart(2,"0")}`}
              onChange={jumpToMonth}
              className="border-2 border-white bg-white bg-opacity-20 text-white placeholder-white px-4 py-3 rounded-xl text-lg font-semibold shadow-lg transition-all duration-200"
            />
            <button 
              onClick={nextMonth} 
              className="px-6 py-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              {t("Calendar.next")} →
            </button>
            <button 
              onClick={onClose} 
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              ✕ {t("Calendar.close")}
            </button>
          </div>
        </div>
      </div>

      {/* Fixed Height Calendar Grid */}
      <div className="flex-1 bg-white">
        <div className="h-full grid grid-cols-7" style={{ gridTemplateRows: 'auto repeat(6, 1fr)' }}>
          
          {/* Day Headers */}
          {[t("Calendar.Mon"),t("Calendar.Tue"),t("Calendar.Wed"),t("Calendar.Thu"),t("Calendar.Fri"),t("Calendar.Sat"),t("Calendar.Sun")].map(day => (
            <div key={day} className="p-4 bg-blue-100 text-blue-900 font-bold text-xl text-center border-r border-blue-200 last:border-r-0">
              {day}
            </div>
          ))}
          
          {/* Calendar Days - Fixed Height */}
          {grid.map((day, idx) =>
            day ? (
              <div
                key={idx}
                onClick={() => openDayView(day)}
                className={`relative cursor-pointer border-r border-b border-gray-200 hover:bg-blue-50 transition-all duration-200 flex flex-col ${
                  day.toDateString() === todayString
                    ? "bg-blue-200 font-bold"
                    : day < new Date()
                      ? "bg-gray-100 text-gray-500"
                      : "bg-white hover:bg-blue-50"
                }`}
                style={{ height: '100%' }}
              >
                {/* Day Number - Fixed Position */}
                <div className="flex-none p-3 pb-1">
                  <div className="text-2xl font-bold text-blue-900">
                    {day.getDate()}
                  </div>
                </div>

                {/* Events Container - Fixed Height with Scroll */}
                <div className="flex-1 px-3 pb-12 overflow-hidden">
                  <div className="h-full overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-transparent">
                    {events
                      .filter(e => new Date(e.date).toDateString() === day.toDateString())
                      .slice(0, 10)
                      .map(e => (
                        <div
                          key={e._id}
                          onClick={ev => { ev.stopPropagation(); openEdit(e); }}
                          className="px-2 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold rounded-lg cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all duration-200 block"
                        >
                          <div className="flex items-center mb-0.5">
                            <span className="mr-1">⏰</span>
                            <span className="text-xs">
                              {new Date(e.date).toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit" })}
                            </span>
                          </div>
                          <div className="font-bold truncate text-xs">
                            {e.title}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Add Button - Fixed Position */}
                <button
                  onClick={ev => { ev.stopPropagation(); openNew(day); }}
                  className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200 z-10"
                >
                  +
                </button>

                {/* Event Count Indicator */}
                {events.filter(e => new Date(e.date).toDateString() === day.toDateString()).length > 0 && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {events.filter(e => new Date(e.date).toDateString() === day.toDateString()).length}
                  </div>
                )}
              </div>
            ) : (
              <div key={idx} className="bg-gray-50 border-r border-b border-gray-200" style={{ height: '100%' }} />
            )
          )}
        </div>
      </div>
    </div>

   {/* FIXED Scrollable Add/Edit Modal */}
{modalOpen && (
  <div 
    className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10001] p-4"
    style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0,
      touchAction: 'none'
    }}
    onClick={() => setModalOpen(false)}
  >
    <div 
      className="bg-white rounded-3xl shadow-2xl border-4 border-blue-200 w-full max-w-2xl relative z-[10002] flex flex-col"
      style={{ 
        height: '90vh',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      
      {/* Fixed Header */}
      <div 
        className="flex-none p-6 border-b-2 border-blue-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-3xl"
        style={{ height: 'auto', flexShrink: 0 }}
      >
        <h3 className="text-3xl font-bold text-center flex items-center justify-center">
          <span className="mr-3 text-4xl">📝</span>
          {editing._id ? t("Calendar.editEvent") : t("Calendar.newEvent")}
        </h3>
      </div>
      
      {/* SCROLLABLE Content */}
      <div 
        className="flex-1 p-6 bg-white"
        style={{ 
          height: 'calc(90vh - 160px)',
          overflowY: 'scroll',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          scrollBehavior: 'smooth'
        }}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="mr-2 text-2xl">📅</span>
                {t("Calendar.date")}
              </label>
              <input
                type="date"
                className="w-full border-3 border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-200 rounded-2xl p-4 text-lg transition-all duration-200"
                value={editing.date}
                onChange={e => setEditing({ ...editing, date: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="mr-2 text-2xl">⏰</span>
                {t("Calendar.time")}
              </label>
              <input
                type="time"
                className="w-full border-3 border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-200 rounded-2xl p-4 text-lg transition-all duration-200"
                value={editing.time}
                onChange={e => setEditing({ ...editing, time: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xl font-bold text-gray-800 mb-3 flex items-center">
              <span className="mr-2 text-2xl">📝</span>
              {t("Calendar.title")}
            </label>
            <input
              type="text"
              placeholder={t("Calendar.title")}
              className="w-full border-3 border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-200 rounded-2xl p-4 text-lg transition-all duration-200"
              value={editing.title}
              onChange={e => setEditing({ ...editing, title: e.target.value })}
            />
          </div>
          
          <div>
            <label className="block text-xl font-bold text-gray-800 mb-3 flex items-center">
              <span className="mr-2 text-2xl">📄</span>
              {t("Calendar.details")}
            </label>
            <textarea
              placeholder={t("Calendar.details")}
              className="w-full border-3 border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-200 rounded-2xl p-4 text-lg transition-all duration-200 h-32 resize-none"
              value={editing.content}
              onChange={e => setEditing({ ...editing, content: e.target.value })}
            />
          </div>

          {editing._id && !showConfirmDelete && (
            <button
              className="w-full text-red-600 hover:text-red-800 font-bold text-xl py-3 px-6 border-3 border-red-300 hover:border-red-500 rounded-2xl hover:bg-red-50 transition-all duration-200"
              onClick={() => setShowConfirmDelete(true)}
            >
              <span className="mr-2">🗑️</span>
              {t("Calendar.delete")}
            </button>
          )}
          
          {showConfirmDelete && (
            <div className="p-6 border-3 border-red-200 rounded-2xl bg-red-50">
              <p className="mb-4 font-bold text-xl text-red-800 text-center">
                <span className="mr-2">⚠️</span>
                {t("Calendar.confirmDelete")}
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  className="px-6 py-3 border-3 border-gray-300 hover:border-gray-500 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-all duration-200"
                  onClick={() => setShowConfirmDelete(false)}
                >
                  ❌ No
                </button>
                <button
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  onClick={() => {
                    deleteEvent(editing._id);
                    setModalOpen(false);
                  }}
                >
                  ✅ Yes
                </button>
              </div>
            </div>
          )}

          {/* Add some extra space at bottom for better scrolling */}
          <div style={{ height: '100px' }}></div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div 
        className="flex-none p-6 border-t-2 border-blue-200 bg-gray-50 rounded-b-3xl"
        style={{ height: 'auto', flexShrink: 0 }}
      >
        <div className="flex justify-center space-x-4">
          <button 
            onClick={() => setModalOpen(false)}
            className="px-8 py-4 border-3 border-gray-300 hover:border-gray-500 rounded-2xl font-bold text-xl hover:bg-gray-100 transition-all duration-200"
          >
            <span className="mr-2">❌</span>
            {t("Calendar.cancel")}
          </button>
          <button
            onClick={saveEvent}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            <span className="mr-2">💾</span>
            {t("Calendar.save")}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* FIXED Scrollable Day Detail Modal */}
{dayViewOpen && selectedDay && (
  <div 
    className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10001] p-4"
    style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0,
      touchAction: 'none'
    }}
    onClick={closeDayView}
  >
    <div 
      className="bg-white rounded-3xl shadow-2xl border-4 border-blue-200 w-full max-w-6xl relative z-[10002] flex flex-col"
      style={{ 
        height: '90vh',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      
      {/* Fixed Header */}
      <div 
        className="flex-none p-6 border-b-2 border-blue-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-3xl"
        style={{ height: 'auto', flexShrink: 0 }}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-4xl font-bold flex items-center">
            <span className="mr-4 text-5xl">📅</span>
            {selectedDay.toDateString()}
          </h3>
          <button 
            onClick={closeDayView} 
            className="text-3xl font-bold text-white hover:text-gray-200 w-12 h-12 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-20 transition-all duration-200"
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* SCROLLABLE Hour Grid */}
      <div 
        className="flex-1 p-6 bg-white rounded-b-3xl"
        style={{ 
          height: 'calc(90vh - 140px)',
          overflowY: 'scroll',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          scrollBehavior: 'smooth'
        }}
      >
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(24).keys()].map(hour => {
            const evs = events.filter(e => {
              const d = new Date(e.date);
              return d.toDateString() === selectedDay.toDateString() && d.getHours() === hour;
            });
            return (
              <div
                key={hour}
                onClick={() => openNewAtHour(hour)}
                className="bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-3 border-blue-200 hover:border-blue-400 rounded-2xl p-4 flex flex-col cursor-pointer shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 min-h-[140px]"
              >
                <span className="font-bold text-xl text-blue-900 mb-3 text-center">
                  {String(hour).padStart(2,"0")}:00
                </span>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {evs.length > 0 ? evs.map(e => (
                    <div
                      key={e._id}
                      onClick={ev => { ev.stopPropagation(); openEdit(e); }}
                      className="bg-white p-3 rounded-xl shadow-md hover:shadow-lg text-sm cursor-pointer border-2 border-blue-200 hover:border-blue-400 transition-all duration-200"
                    >
                      <div className="font-bold text-blue-900 flex items-center mb-1">
                        <span className="mr-1">⏰</span>
                        {new Date(e.date).toTimeString().slice(0,5)}
                      </div>
                      <div className="text-gray-700 font-semibold">{e.title}</div>
                    </div>
                  )) : (
                    <div className="text-gray-500 text-center text-sm font-semibold py-6">
                      <div className="text-3xl mb-2">➕</div>
                      Click to add event
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Add extra space at bottom for better scrolling */}
        <div style={{ height: '100px' }}></div>
      </div>
    </div>
  </div>
)}
  </div>
);
}
