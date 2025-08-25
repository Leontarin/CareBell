// src/components/GoogleSignIn.jsx
import { useEffect, useRef } from "react";
import { API } from "../shared/config";

const LOCALE_MAP = {
  en: "en",     // English
  he: "he",     // Hebrew
  de: "de",     // German
  fi: "fi",     // Finnish
};

export default function GoogleSignIn({ locale = "en", onError }) {
  const btnRef = useRef(null);

  useEffect(() => {
    // Safety: wait until the GIS script exists and the container is mounted
    if (!window.google || !window.google.accounts?.id || !btnRef.current) return;

    // If we previously initialized, cancel any ongoing one-tap prompts
    try {
      window.google.accounts.id.cancel();
    } catch {}

    const gisLocale = LOCALE_MAP[locale] || "en";

    // (Re)initialize with the desired locale
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        try {
          const r = await fetch(`${API}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ id_token: credential }),
          });
          if (!r.ok) throw new Error("Google sign-in failed");
          // logged in (cookie set) -> go home
          window.location.href = "/";
        } catch (err) {
          console.error(err);
          onError?.(err?.message || "Google sign-in failed");
        }
      },
      // 👇 This is the important part for localization
      locale: gisLocale,
      // (Optional) disable auto_select if you don't want automatic account pick
      // auto_select: false,
      // (Optional) itp_support: true,
    });

    // Re-render the button each time locale changes
    // (text is translated automatically by GIS for the given locale)
    btnRef.current.innerHTML = ""; // clear previous button
    window.google.accounts.id.renderButton(btnRef.current, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "continue_with",
    });

    // Optional: One Tap prompt (will follow the same locale)
    // window.google.accounts.id.prompt();

    // No cleanup needed beyond canceling prompt next time
  }, [locale, onError]);

  return <div ref={btnRef} />;
}
