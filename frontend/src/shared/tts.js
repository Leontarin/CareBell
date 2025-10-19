import { API } from "./config";

/**
 * Non-streaming fallback (legacy endpoint)
 */
export async function playTts(text, lang = "en") {
  if (!text) return;
  const res = await fetch(`${API}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });
  if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
  audio.onended = () => URL.revokeObjectURL(url);
  return audio;
}

/**
 * Streaming version (progressive Piper playback)
 */
export async function playTtsStream(text, lang = "en") {
  if (!text) return;
  const res = await fetch(`${API}/tts/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });

  if (!res.ok || !res.body)
    throw new Error(`Streaming TTS failed: ${res.status}`);

  // Collect the chunks as they arrive
  const reader = res.body.getReader();
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  // Merge into one Blob and play
  const blob = new Blob(chunks, { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
  audio.onended = () => URL.revokeObjectURL(url);
  return audio;
}

/**
 * Auto-select streaming if supported, fallback otherwise
 */
export async function playSmartTts(text, lang = "en") {
  try {
    if (window.ReadableStream) {
      return await playTtsStream(text, lang);
    } else {
      return await playTts(text, lang);
    }
  } catch (err) {
    console.warn("Streaming failed, falling back:", err);
    return await playTts(text, lang);
  }
}
