// src/components/News.jsx
import React, { useState, useEffect } from "react";
import { API, NEWS_REGION } from "../shared/config";
import { useTranslation } from "react-i18next";
import { playTts } from "../shared/tts";

export default function News() {
  const { t, i18n } = useTranslation();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [region, setRegion] = useState(NEWS_REGION);
  const [speaking, setSpeaking] = useState(false);
  const [currentArticleIndex, setCurrentArticleIndex] = useState(null);
  const [audioObj, setAudioObj] = useState(null);

  useEffect(() => {
    fetchTodaysNews(region);
  }, [region]);

  useEffect(() => () => {
    if (audioObj) audioObj.pause();
  }, [audioObj]);

  const fetchTodaysNews = async (selectedRegion) => {
    setLoading(true);
    setError("");
    const url = `${API}/news/todays-news?region=${encodeURIComponent(selectedRegion)}`;
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
    if (audioObj) {
      audioObj.pause();
      audioObj.currentTime = 0;
      setAudioObj(null);
    }
    setSpeaking(false);
    setCurrentArticleIndex(null);
  };

  const speakText = async (text, index) => {
    stopSpeaking();
    if (!text) return;
    try {
      const lang = i18n.language.split('-')[0];
      const audio = await playTts(text, lang);
      setAudioObj(audio);
      setSpeaking(true);
      setCurrentArticleIndex(index);
      audio.onended = () => {
        setSpeaking(false);
        setCurrentArticleIndex(null);
        setAudioObj(null);
      };
    } catch (err) {
      console.error('TTS error:', err);
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

  const retryFetch = () => fetchTodaysNews(region);

  const REGIONS = ['germany', 'international'];

  return (
    <div className="p-4 max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h1 className="text-4xl font-bold mb-4 text-center text-blue-800 dark:text-blue-200">{t('News.latestNews')}</h1>
      <div className="mb-4 text-right">
        <label className="mr-2">{t('News.selectRegion')}:</label>
        <select
          value={region}
          onChange={e => setRegion(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          {REGIONS.map(r => (
            <option key={r} value={r}>{t(`News.${r}`)}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300">Nachrichten werden geladen...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900 border-l-8 border-red-600 text-red-700 dark:text-red-200 p-6 rounded-lg mb-6 text-xl">
          <h3 className="font-bold text-2xl mb-2">Fehler</h3>
          <p className="mb-4">{error}</p>
          <button onClick={retryFetch} className="mt-4 px-5 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            Erneut versuchen
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-6 flex justify-between items-center">
            <p className="text-lg text-gray-600 dark:text-gray-300">{news.length} Artikel für heute gefunden</p>
            <button onClick={stopSpeaking} className={`px-5 py-3 rounded-lg text-lg font-semibold ${speaking ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-500'}`} disabled={!speaking}>
              <span className="mr-2 text-xl">🔇</span>Vorlesen stoppen
            </button>
          </div>
          <ul className="space-y-6">
            {news.map((article, idx) => (
              <li key={idx} className={`border ${currentArticleIndex===idx?'border-yellow-500 border-2':'border-gray-200 dark:border-gray-600'} rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow`}>
                <div className="p-5 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{article.title}</h3>
                    <p className="text-gray-500 dark:text-gray-300 mt-1">Quelle: {article.source} | {formatDate(article.published_at)}</p>
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
                <div className="p-5 bg-white dark:bg-gray-800">
                  {article.image && (
                    <img src={article.image} alt={article.title} className="w-full h-auto rounded-lg mb-4" onError={e => { e.target.style.display = 'none'; }} />
                  )}
                  <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">{article.description}</p>
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
