// src/components/News.jsx
import React, { useState, useEffect } from "react";
import { API } from "../config";

export default function News() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [currentArticleIndex, setCurrentArticleIndex] = useState(null);

  useEffect(() => {
    fetchTodaysNews();

    // Load speechSynthesis voices
    if (window.speechSynthesis) {
      let voicesLoaded = false;
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          voicesLoaded = true;
          const germanVoices = voices.filter(v => v.lang.startsWith("de"));
          console.log("Available German voices:", germanVoices.map(v => `${v.name} (${v.lang})`));
        }
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      if (!voicesLoaded) setTimeout(loadVoices, 1000);
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      }
    };
  }, []);

  const fetchTodaysNews = async () => {
    setLoading(true);
    setError("");
    const url = `${API}/news/todays-news`;
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Fetching news (attempt ${attempt})`);
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Keine gültigen Nachrichtenartikel gefunden");
        }
        const valid = data.filter(
          ({ title, description, source }) => title && description && source
        );
        setNews(valid);
        break;
      } catch (err) {
        console.error(`News fetch error on attempt ${attempt}:`, err);
        if (attempt === maxRetries) {
          setError(`Konnte die heutigen Nachrichten nicht laden: ${err.message}`);
          setNews([]);
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    setLoading(false);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setCurrentArticleIndex(null);
    }
  };

  const speakText = (text, index) => {
    stopSpeaking();
    if (!text) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      const voices = window.speechSynthesis.getVoices();
      let selected = voices.find(v => v.lang === 'de-DE');
      if (!selected) selected = voices.find(v => v.lang.startsWith('de')) || voices[0];
      if (selected) utterance.voice = selected;
      setCurrentArticleIndex(index);
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => { setSpeaking(false); setCurrentArticleIndex(null); };
      utterance.onerror = () => { setSpeaking(false); setCurrentArticleIndex(null); };
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis error:", err);
      setSpeaking(false);
      setCurrentArticleIndex(null);
    }
  };

  const createNewsDescription = article => {
    let desc = `${article.title}. `;
    if (article.description) desc += `${article.description}. `;
    desc += `Diese Nachricht ist von ${article.source}. `;
    return desc;
  };

  const formatDate = dateString => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const retryFetch = () => fetchTodaysNews();

  return (
    <div className="p-4 max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg dark:text-gray-100">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-800">Heute Nachrichten</h1>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-xl text-gray-600">Nachrichten werden geladen...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 border-l-8 border-red-600 text-red-700 p-6 rounded-lg mb-6 text-xl">
          <h3 className="font-bold text-2xl mb-2">Fehler</h3>
          <p className="mb-4">{error}</p>
          <button onClick={retryFetch} className="mt-4 px-5 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            Erneut versuchen
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-6 flex justify-between items-center">
            <p className="text-lg text-gray-600">{news.length} Artikel für heute gefunden</p>
            <button onClick={stopSpeaking} className={`px-5 py-3 rounded-lg text-lg font-semibold ${speaking ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-500'}`} disabled={!speaking}>
              <span className="mr-2 text-xl">🔇</span>Vorlesen stoppen
            </button>
          </div>
          <ul className="space-y-6">
            {news.map((article, idx) => (
              <li key={idx} className={`border ${currentArticleIndex===idx?'border-yellow-500 border-2':'border-gray-200'} rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow`}>
                <div className="p-5 bg-gray-50 flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{article.title}</h3>
                    <p className="text-gray-500 mt-1">Quelle: {article.source} | {formatDate(article.published_at)}</p>
                  </div>
                  {currentArticleIndex===idx && speaking ? (
                    <button onClick={stopSpeaking} className="flex items-center px-4 py-2 rounded-lg text-lg font-semibold bg-yellow-500 text-white">
                      <span className="mr-2 text-xl">🔇</span>Stoppen
                    </button>
                  ) : (
                    <button onClick={() => speakText(createNewsDescription(article), idx)} className="flex items-center px-4 py-2 rounded-lg text-lg font-semibold bg-green-600 text-white">
                      <span className="mr-2 text-xl">🔊</span>Vorlesen
                    </button>
                  )}
                </div>
                <div className="p-5 bg-white dark:bg-gray-700">
                  {article.image && (
                    <img src={article.image} alt={article.title} className="w-full h-auto rounded-lg mb-4" onError={e => { e.target.style.display = 'none'; }} />
                  )}
                  <p className="text-lg text-gray-700 mb-4">{article.description}</p>
                  {article.url && (
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                      Weiterlesen
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
