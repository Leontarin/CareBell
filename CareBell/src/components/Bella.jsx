// src/components/Bella.jsx
//test
import React, { useEffect, useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Vapi from '@vapi-ai/web';
import { FaPhone, FaPhoneSlash, FaExpand, FaCompress } from 'react-icons/fa';
import bella_img from '../resources/Grafik3a.png';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../AppContext';
import { API } from '../config';

export default function Bella() {
  const { t, i18n } = useTranslation();
  const { user, bellaFullscreen, setBellaFullscreen } = useContext(AppContext);
  const navigate   = useNavigate();

  const [callStatus, setCallStatus] = useState('ready');   // 'ready' | 'calling' | 'in-call'
  const [messages, setMessages]     = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const vapiRef = useRef(null);
  const chatRef = useRef(null);

  // Intent classifier
  async function classifyIntent(text) {
    const lc = text.toLowerCase().trim();
    // open menu
    const menus = {
      'open contacts':     'call-contacts',
      'open contact':     'call-contacts',
      'open friends':      'meet-with-friends',
      'open meet with friends':      'meet-with-friends',
      'open medicine':     'medicine',
      'open medication':     'medicine',
      'open meals':        'meals',
      'open meal':        'meals',
      'open food':        'meals',
      'open news':         'news',
      'open exercise':     'exercise',
      'open workout':     'exercise'
    };
    for (let phrase in menus) {
      if (lc.includes(phrase)) {
        return { intent: 'open_menu', slot: menus[phrase] };
      }
    }
    // call contact
    if (lc.startsWith('call ')) {
      const name = lc.slice(5).trim();
      return { intent: 'call_contact', slot: name };
    }
    // list medications
    if (/(what|which).*(medication|medicine).*(take|should take)/.test(lc)) {
      return { intent: 'list_medications', slot: null };
    }
    // mark medication taken
    let m = lc.match(/(?:i (?:have )?taken|i took) (.+)/);
    if (m) {
      const medName = m[1].replace(/\?$/, '').trim();
      return { intent: 'mark_medication_taken', slot: medName };
    }
    // default chat
    return { intent: 'chat', slot: null };
  }

  // locale → assistant IDs
  const assistantIdMap = {
    en: import.meta.env.VITE_VAPI_ASSISTANT_ID_EN,
    de: import.meta.env.VITE_VAPI_ASSISTANT_ID_DE,
    he: import.meta.env.VITE_VAPI_ASSISTANT_ID_HE
  };
  const getAssistantId = () => {
    const lang = i18n.language.split('-')[0];
    return assistantIdMap[lang] || assistantIdMap.en;
  };

  // load & persist chat, auto-scroll
  useEffect(() => {
    const saved = localStorage.getItem('bella_chat');
    if (saved) try { setMessages(JSON.parse(saved)); } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem('bella_chat', JSON.stringify(messages));
  }, [messages]);
  useEffect(() => {
    if (chatRef.current && isChatOpen) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isChatOpen]);

  // init Vapi
  useEffect(() => {
    const vapi = vapiRef.current = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY);

    // inject reminders
    vapi.on('call-start', async () => {
      setCallStatus('in-call');
      setIsChatOpen(true);
      setBellaFullscreen(true);
      if (!user?.id) return;
      try {
        const res = await fetch(`${API}/bellaReminders/user/${user.id}`);
        if (!res.ok) throw new Error(res.statusText);
        const rems = await res.json();
        for (let r of rems) {
          await vapi.send({
            type: 'add-message',
            message: { role: 'system', content: `Remember: ${r.description}` }
          });
        }
      } catch (e) { console.error(e); }
    });

    vapi.on('call-end', () => {
      setCallStatus('ready');
      setBellaFullscreen(false);
    });

    vapi.on('message', async msg => {
      if (msg.type !== 'transcript') return;

      const speaker = msg.role === 'assistant' ? 'assistant' : 'user';
      const text    = msg.transcript.trim();

      // partial update
      if (msg.transcriptType === 'partial') {
        setMessages(prev => {
          const out = [...prev];
          const last = out[out.length-1];
          if (last && last.speaker===speaker && last.partial) {
            out[out.length-1] = { speaker, text, partial: true };
          } else {
            out.push({ speaker, text, partial: true });
          }
          return out;
        });
        return;
      }

      // final update
      setMessages(prev => {
        const out = [...prev];
        const last = out[out.length-1];
        if (last && last.speaker===speaker && last.partial) {
          out[out.length-1] = { speaker, text, partial: false };
        } else {
          out.push({ speaker, text, partial: false });
        }
        return out;
      });

      // only user final
      if (speaker !== 'user' || !user?.id) return;

      let { intent, slot } = await classifyIntent(text);

      switch (intent) {
        case 'chat':
          await vapi.send({
            type: 'add-message',
            message: { role: 'user', content: text }
          });
          break;

        case 'open_menu':
          setBellaFullscreen(false);
          navigate(`/${slot}`);
          await vapi.send({
            type: 'add-message',
            message: { role: 'system', content: `Say "Opening ${slot.replace('-', ' ')}"` }
          });
          break;

        case 'call_contact': {
          const resp = await fetch(`${API}/contacts/getAll/${user.id}`);
          const contacts = await resp.json();
          const match = contacts.find(c =>
            c.fullName.toLowerCase().includes(slot)
          );
          if (match) {
            await vapi.send({
              type: 'add-message',
              message: { role: 'system', content: `Calling ${match.fullName}` }
            });
            // TODO: trigger actual call UI with match.phoneNumber
          } else {
            await vapi.send({
              type: 'add-message',
              message: { role: 'system', content: `Sorry, I can't find that person in your contacts` }
            });
          }
          break;
        }

        case 'list_medications': {
          const resp = await fetch(`${API}/medications/user/${user.id}`);
          const meds = await resp.json();
          const due = meds.filter(m => m.canTake);
          const list = due.map(m=>m.name).join(', ');
          await vapi.send({
            type: 'add-message',
            message: {
              role: 'system',
              content: `The medication you need to take are: ${list}. Feel free to tell me when you've taken any.`
            }
          });
          break;
        }

        case 'mark_medication_taken': {
          const resp = await fetch(`${API}/medications/user/${user.id}`);
          const meds = await resp.json();
          const found = meds.find(m =>
            m.name.toLowerCase().includes(slot.toLowerCase())
          );
          if (found) {
            await fetch(`${API}/medications/markTaken`, {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ id: found._id })
            });
            await vapi.send({
              type:'add-message',
              message:{ role:'system', content: `${found.name} marked as taken.` }
            });
          } else {
            await vapi.send({
              type:'add-message',
              message:{ role:'system', content:`Sorry, I don't see that medication` }
            });
          }
          break;
        }

        default:
          console.log('Unhandled intent', intent);
      }
    });

    vapi.on('error', err => console.error(err));
    return () => vapi.removeAllListeners();
  }, [user, t]);

  // call controls
  const startCall = () => {
    setCallStatus('calling');
    vapiRef.current.start(getAssistantId(), {});
  };
  const endCall    = () => vapiRef.current.stop();
  const toggleCall = () => callStatus==='ready' ? startCall() : endCall();

  const Icon      = callStatus==='ready' ? FaPhone : FaPhoneSlash;
  const callLabel =
    callStatus==='ready'    ? t('Bella.talk')
  : callStatus==='calling' ? t('Bella.calling')
  :                          t('Bella.stop');

  const btnClass = `
    inline-flex items-center justify-center
    text-base border-2 border-blue-900 rounded-xl
    py-2 px-4 bg-blue-900 text-white font-semibold
    hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-white
    transition
  `;
  const chatBtnClass = `
    inline-flex items-center justify-center
    border-2 border-blue-700 rounded-full
    py-1 px-4 text-sm bg-blue-700 text-white font-semibold
    hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300
    transition mb-4
  `;

  return (
    <div
      className={`w-full flex ${
        bellaFullscreen ? 'flex-row items-start' : 'flex-col items-center'
      }`}
    >
      <div
        className={`${
          bellaFullscreen ? 'w-1/3 flex flex-col items-center pr-4' : 'flex flex-col items-center w-full'
        }`}
      >
        {isChatOpen ? (
          <>
            <div
              id="bella-img"
              className={`rounded-full overflow-hidden border-[5px] border-blue-800 mb-2 ${
                bellaFullscreen ? 'w-56 h-56' : 'w-24 h-24'
              }`}
            >
              <img src={bella_img} alt="Bella" className="w-full h-full object-cover" />
            </div>
            <button onClick={() => setIsChatOpen(false)} className={chatBtnClass}>
              {t('Bella.closeChat')}
            </button>
          </>
        ) : (
          <>
            <div
              id="bella-img"
              className={`rounded-full overflow-hidden border-[5px] border-blue-800 mb-4 ${
                bellaFullscreen ? 'w-72 h-72 ml-4' : 'w-48 h-48'
              }`}
            >
              <img src={bella_img} alt="Bella" className="w-full h-full object-cover" />
            </div>
            {messages.length > 0 && (
              <button onClick={() => setIsChatOpen(true)} className={chatBtnClass}>
                {t('Bella.openChat')}
              </button>
            )}
          </>
        )}
        <button onClick={toggleCall} className={btnClass}>
          <Icon className="mr-2 text-xl"/>
          {callLabel}
        </button>
        <button
          onClick={() => setBellaFullscreen(!bellaFullscreen)}
          className={`${btnClass} mt-2`}
      >
        {bellaFullscreen ? (
          <FaCompress className="mr-2 text-xl" />
        ) : (
          <FaExpand className="mr-2 text-xl" />
        )}
        {bellaFullscreen ? t('Bella.exitFullscreen') : t('Bella.fullscreen')}
      </button>
      </div>

      {isChatOpen && (
        <div
          className={`${
            bellaFullscreen ? 'w-2/3' : 'w-full'
          } flex flex-col`}
        >
          <div
            ref={chatRef}
            className={`p-4 bg-white rounded-lg shadow overflow-y-auto mb-4 space-y-3 ${
              bellaFullscreen ? 'h-[60vh]' : ''
            }`}
            style={{ maxHeight: bellaFullscreen ? 'none' : '300px' }}
          >
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.speaker === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`px-4 py-2 rounded-lg ${
                    m.speaker === 'assistant' ? 'bg-blue-900 text-white' : 'bg-gray-300 text-black'
                  }`}
                  style={{ fontSize: '18px', lineHeight: '1.4' }}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={toggleCall} className={btnClass}>
        <Icon className="mr-2 text-xl"/>
        {callLabel}
      </button>
      <button
        onClick={() => setBellaFullscreen(!bellaFullscreen)}
        className={`${btnClass} mt-2`}
      >
        {bellaFullscreen ? (
          <FaCompress className="mr-2 text-xl" />
        ) : (
          <FaExpand className="mr-2 text-xl" />
        )}
        {bellaFullscreen ? t('Bella.exitFullscreen') : t('Bella.fullscreen')}
      </button>
    </div>
  );
}
