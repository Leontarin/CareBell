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
  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl overflow-hidden min-h-screen">
    <div className="bg-white shadow-lg p-8 border-b-4 border-blue-200">
      <h1 className="text-5xl font-bold text-center text-blue-900 flex items-center justify-center">
        <span className="mr-4 text-6xl">📰</span>
        Heute Nachrichten
      </h1>
    </div>

    <div className="p-8">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl shadow-xl border-2 border-blue-200">
          <div className="animate-spin rounded-full h-20 w-20 border-6 border-blue-500 border-t-transparent mb-6"></div>
          <p className="text-2xl text-gray-600 font-bold">Nachrichten werden geladen...</p>
        </div>
      ) : error ? (
        <div className="bg-gradient-to-r from-red-100 to-red-200 border-4 border-red-400 text-red-800 p-8 rounded-3xl shadow-xl">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="font-bold text-3xl mb-4">Fehler</h3>
            <p className="text-xl mb-6">{error}</p>
            <button 
              onClick={retryFetch} 
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xl font-bold rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
            >
              <span className="mr-3 text-2xl">🔄</span>
              Erneut versuchen
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Enhanced Header with controls */}
          <div className="mb-8 bg-white rounded-3xl p-6 shadow-xl border-2 border-blue-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="text-3xl mr-3">📊</span>
                <p className="text-2xl text-blue-700 font-bold">
                  {news.length} Artikel für heute gefunden
                </p>
              </div>
              <button 
                onClick={stopSpeaking} 
                className={`px-6 py-3 rounded-2xl text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 ${
                  speaking 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`} 
                disabled={!speaking}
              >
                <span className="mr-3 text-2xl">🔇</span>
                Vorlesen stoppen
              </button>
            </div>
          </div>

          {/* Enhanced News List */}
          <div className="space-y-8">
            {news.map((article, idx) => (
              <div 
                key={idx} 
                className={`bg-white border-3 border-blue-200 hover:border-blue-400 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transform hover:scale-[1.01] transition-all duration-300 ${
                  currentArticleIndex === idx ? 'ring-4 ring-yellow-400 border-yellow-400' : ''
                }`}
              >
                {/* Enhanced Article Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-3xl font-bold mb-3 leading-tight">{article.title}</h3>
                      <div className="flex items-center text-blue-100 text-lg">
                        <span className="mr-2 text-xl">🏢</span>
                        <span className="font-semibold mr-4">Quelle: {article.source}</span>
                        <span className="mr-2 text-xl">📅</span>
                        <span>{formatDate(article.published_at)}</span>
                      </div>
                    </div>
                    
                    <div className="ml-6">
                      {currentArticleIndex === idx && speaking ? (
                        <button 
                          onClick={stopSpeaking} 
                          className="flex items-center px-6 py-3 rounded-2xl text-xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                        >
                          <span className="mr-3 text-2xl">🔇</span>
                          Stoppen
                        </button>
                      ) : (
                        <button 
                          onClick={() => speakText(createNewsDescription(article), idx)} 
                          className="flex items-center px-6 py-3 rounded-2xl text-xl font-bold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                        >
                          <span className="mr-3 text-2xl">🔊</span>
                          Vorlesen
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Enhanced Article Content */}
                <div className="p-8">
                  {/* Enhanced Article Image */}
                  {article.image && (
                    <div className="mb-6">
                      <img 
                        src={article.image} 
                        alt={article.title} 
                        className="w-full rounded-2xl shadow-lg border-2 border-blue-200" 
                        onError={e => { 
                          e.target.style.display = 'none'; 
                        }} 
                      />
                    </div>
                  )}
                  
                  <div className="bg-blue-50 rounded-2xl p-6 mb-6 border-2 border-blue-200">
                    <p className="text-2xl text-gray-800 leading-relaxed">{article.description}</p>
                  </div>
                  
                  {article.url && (
                    <div className="text-center">
                      <a 
                        href={article.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      >
                        <span className="mr-3 text-2xl">📖</span>
                        Weiterlesen
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);
}
