// src/components/Bella.jsx

import React, { useEffect, useState, useRef, useContext } from 'react';
import Vapi from '@vapi-ai/web';
import { FaPhone, FaPhoneSlash } from 'react-icons/fa';
import bella_img from '../resources/Grafik3a.png';
import { AppContext } from '../AppContext';
import { API } from '../config';

export default function Bella() {
  const { user } = useContext(AppContext);
  const [callStatus, setCallStatus] = useState('ready');   // 'ready' | 'calling' | 'in-call'
  const [messages, setMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const vapiRef = useRef(null);
  const chatRef = useRef(null);

  // Load and persist chat in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bella_chat');
    if (saved) {
      try { setMessages(JSON.parse(saved)); }
      catch (err) { console.error('Failed to parse saved chat:', err); }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('bella_chat', JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatRef.current && isChatOpen) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isChatOpen]);

  // Initialize Vapi and handlers
  useEffect(() => {
    const vapi = (vapiRef.current = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY));

    // On call start: inject all saved reminders
    vapi.on('call-start', async () => {
      setCallStatus('in-call');
      setIsChatOpen(true);
      if (!user?.id) return;
      try {
        const res = await fetch(`${API}/bellaReminders/user/${user.id}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const reminders = await res.json();
        for (let r of reminders) {
          await vapi.send({ type: 'add-message', message: {role: "user", content: `Remember this about the user ${r.description}`}});
        }
      } catch (err) {
        console.error('Could not load Bella reminders:', err);
      }
    });

    vapi.on('call-end', () => setCallStatus('ready'));

    // Handle transcripts
    vapi.on('message', msg => {
      if (msg.type !== 'transcript') return;
      const speaker = msg.role === 'assistant' ? 'assistant' : 'user';
      const text = msg.transcript;

      // Partial vs final transcript handling
      if (msg.transcriptType === 'partial') {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.speaker === speaker && last.partial) {
            const upd = [...prev];
            upd[upd.length - 1] = { speaker, text, partial: true };
            return upd;
          }
          return [...prev, { speaker, text, partial: true }];
        });
      } else {
        // final
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

        // On final user transcript: analyze & react
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
                console.log('✅ Saved personal fact:', reminder);
                await v.send({
                  type: 'text',
                  text: `Okay, I saved: ${reminder.title}.`
                });
              } else if (label === 'question') {
                // read back all reminders
                const r2 = await fetch(`${API}/bellaReminders/user/${user.id}`);
                if (!r2.ok) throw new Error('Failed to load reminders');
                const list = await r2.json();
                if (list.length) {
                  for (let r of list) {
                    await v.send({
                      type: 'text',
                      text: `REMINDER: ${r.title} — ${r.description}`
                    });
                  }
                } else {
                  await v.send({
                    type: 'text',
                    text: `You have no saved reminders.`
                  });
                }
              }
            })
            .catch(err => console.error('Analyze error:', err));
        }
      }
    });

    vapi.on('error', err => console.error('Vapi error', err));
    return () => vapi.removeAllListeners();
  }, [user]);

  // Call controls
  const startCall = () => {
    setCallStatus('calling');
    vapiRef.current.start(
      import.meta.env.VITE_VAPI_ASSISTANT_ID,
      { clientMessages: ['transcript'] }
    );
  };
  const endCall = () => vapiRef.current.stop();
  const toggleCall = () =>
    callStatus === 'ready' ? startCall() : endCall();

  // Render
  const Icon = callStatus === 'ready' ? FaPhone : FaPhoneSlash;
  const callLabel =
    callStatus === 'ready'
      ? 'Talk to Bella'
      : callStatus === 'calling'
      ? 'Calling Bella…'
      : 'Stop Call';

  const chatBtnClass = `
    inline-flex items-center justify-center
    border-2 border-blue-700
    rounded-full py-1 px-4 text-sm
    bg-blue-700 text-white font-semibold
    hover:bg-blue-600 focus:outline-none
    focus:ring-2 focus:ring-blue-300
    transition mb-4
  `;

  return (
    <div className="flex flex-col items-center w-full">
      {isChatOpen ? (
        <>
          <div
            id="bella-img"
            className="rounded-full overflow-hidden border-[5px] border-blue-800 mb-2 w-24 h-24"
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
            aria-label="Close chat"
          >
            Close Chat
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
                  }`}
                  style={{ fontSize: '18px', lineHeight: '1.4' }}
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
              aria-label="Open chat"
            >
              Open Chat
            </button>
          )}
        </>
      )}
      <button
        onClick={toggleCall}
        className="inline-flex items-center justify-center border-2 border-blue-900 rounded-xl py-2 px-4 bg-blue-900 text-white font-semibold hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-white transition"
      >
        <Icon className="mr-2 text-xl" />
        {callLabel}
      </button>
    </div>
  );
}
