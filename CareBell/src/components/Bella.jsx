// src/components/Bella.jsx

import React, { useEffect, useState, useRef, useContext } from 'react';
import Vapi from '@vapi-ai/web';
import { FaPhone, FaPhoneSlash } from 'react-icons/fa';
import bella_img from '../resources/Grafik3a.png';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../AppContext';
import { API } from '../config';

export default function Bella() {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AppContext);

  const [callStatus, setCallStatus] = useState('ready'); // 'ready' | 'calling' | 'in-call'
  const [messages, setMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const vapiRef = useRef(null);
  const chatRef = useRef(null);

  // map locales → env var names
  const assistantIdMap = {
    en: import.meta.env.VITE_VAPI_ASSISTANT_ID_EN,
    de: import.meta.env.VITE_VAPI_ASSISTANT_ID_DE,
    he: import.meta.env.VITE_VAPI_ASSISTANT_ID_HE,
  };
  // pick the right one, fallback to English
  const getAssistantId = () => {
    const lang = i18n.language.split('-')[0];
    return assistantIdMap[lang] || assistantIdMap.en;
  };

  // ——— persist chat history ———
  useEffect(() => {
    const saved = localStorage.getItem('bella_chat');
    if (saved) {
      try { setMessages(JSON.parse(saved)); }
      catch { /*ignore*/ }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('bella_chat', JSON.stringify(messages));
  }, [messages]);
  useEffect(() => {
    if (chatRef.current && isChatOpen) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isChatOpen]);

  // ——— Init Vapi & load reminders on call-start ———
  useEffect(() => {
    const vapi = (vapiRef.current = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY));

    vapi.on('call-start', async () => {
      setCallStatus('in-call');
      setIsChatOpen(true);
      if (!user?.id) return;
      try {
        const res = await fetch(`${API}/bellaReminders/user/${user.id}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const reminders = await res.json();
        for (let r of reminders) {
          console.log(r)
          await vapi.send({
            type: 'add-message',
            message: {
              role: "system",
              content: `Remember this about the user: ${r.description}`,
            },
          });
        }
      } catch (err) {
        console.error('Could not load Bella reminders:', err);
      }
    });

    vapi.on('call-end', () => setCallStatus('ready'));

    vapi.on('message', msg => {
      if (msg.type !== 'transcript') return;
      const speaker = msg.role === 'assistant' ? 'assistant' : 'user';
      const text = msg.transcript;

      // partial vs final…
      if (msg.transcriptType === 'partial') {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.speaker === speaker && last.partial) {
            const up = [...prev];
            up[up.length - 1] = { speaker, text, partial: true };
            return up;
          }
          return [...prev, { speaker, text, partial: true }];
        });
      } else {
        setMessages(prev => {
          const out = [...prev];
          const last = out[out.length - 1];
          if (last && last.speaker === speaker && last.partial) {
            out[out.length - 1] = { speaker, text, partial: false };
          } else {
            out.push({ speaker, text, partial: false });
          }
          return out;
        });

        // final user → analyze
        if (speaker === 'user' && user?.id) {
          fetch(`${API}/bellaReminders/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, text })
          })
            .then(r => r.json())
            .then(async ({ saved, reminder, label }) => {
              const v = vapiRef.current;
              if (!v) return;

              if (saved) {
                await v.send({
                  type: 'text',
                  text: t('Bella.confirmSaved', { title: reminder.title })
                });
              } else if (label === 'question') {
                const r2 = await fetch(`${API}/bellaReminders/user/${user.id}`);
                const list = (await r2.json()) || [];
                if (list.length) {
                  for (let r of list) {
                    await v.send({
                      type: 'text',
                      text: `${t('Bella.reminderPrefix')} ${r.title} — ${r.description}`
                    });
                  }
                } else {
                  await v.send({ type: 'text', text: t('Bella.noReminders') });
                }
              }
            })
            .catch(err => console.error('Analyze error:', err));
        }
      }
    });

    vapi.on('error', err => console.error('Vapi error', err));
    return () => vapi.removeAllListeners();
  }, [user, t]);

  // ——— call controls ———
  const startCall = () => {
    setCallStatus('calling');
    const assistantId = getAssistantId();
    vapiRef.current.start(assistantId, {
      clientMessages: ['transcript']
    });
  };
  const endCall = () => vapiRef.current.stop();
  const toggleCall = () =>
    callStatus === 'ready' ? startCall() : endCall();

  // ——— labels & classes ———
  const Icon = callStatus === 'ready' ? FaPhone : FaPhoneSlash;
  const callLabel =
    callStatus === 'ready'
      ? t('Bella.talk')
      : callStatus === 'calling'
      ? t('Bella.calling')
      : t('Bella.stop');

  const btnClass = `
    inline-flex items-center justify-center
    text-base
    border-2 border-blue-900 rounded-xl
    py-2 px-4 bg-blue-900 text-white
    font-semibold hover:bg-blue-800
    focus:outline-none focus:ring-2 focus:ring-white
    transition
  `;

  const chatBtnClass = `
    inline-flex items-center justify-center
    border-2 border-blue-700 rounded-full
    py-1 px-4 text-sm
    bg-blue-700 text-white font-semibold
    hover:bg-blue-600
    focus:outline-none focus:ring-2 focus:ring-blue-300
    transition mb-4
  `;

  return (
    <div className="flex flex-col items-center w-full">
      {isChatOpen ? (
        <>
          <div
            className="rounded-full overflow-hidden border-[5px] border-blue-800 mb-2 w-24 h-24"
            id="bella-img"
          >
            <img
              src={bella_img}
              alt="Bella"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={() => setIsChatOpen(false)}
            className={chatBtnClass}
            aria-label={t('Bella.closeChat')}
          >
            {t('Bella.closeChat')}
          </button>
          <div
            ref={chatRef}
            className="w-full max-w-md p-4 bg-white rounded-lg shadow overflow-y-auto mb-4 space-y-3"
            style={{ maxHeight: '300px' }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.speaker === 'assistant' ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`px-4 py-2 rounded-lg ${
                    m.speaker === 'assistant'
                      ? 'bg-blue-900 text-white'
                      : 'bg-gray-300 text-black'
                  } text-lg leading-snug`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div
            id="bella-img"
            className="rounded-full overflow-hidden border-[5px] border-blue-800 mb-4 w-48 h-48"
          >
            <img
              src={bella_img}
              alt="Bella"
              className="w-full h-full object-cover"
            />
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setIsChatOpen(true)}
              className={chatBtnClass}
              aria-label={t('Bella.openChat')}
            >
              {t('Bella.openChat')}
            </button>
          )}
        </>
      )}
      <button onClick={toggleCall} className={btnClass}>
        <Icon className="mr-2 text-xl" />
        {callLabel}
      </button>
    </div>
  );
}
