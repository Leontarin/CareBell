// src/components/GoogleSignIn.jsx
import { useEffect, useRef } from "react";
import { API } from "../shared/config";

export default function GoogleSignIn() {
  const btnRef = useRef(null);

  useEffect(() => {
    if (window.google && btnRef.current) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            // Send the ID token (JWT) to your backend
            await fetch(`${API}/auth/google`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include", // so cookies are set/read
              body: JSON.stringify({ id_token: response.credential }),
            });
            // now you're logged in on the server (cookie set)
            window.location.href = "/";
          } catch (err) {
            console.error("Google sign-in failed", err);
          }
        },
      });

      // Render the button
      window.google.accounts.id.renderButton(btnRef.current, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
      });

      // Optional: One Tap prompt
      window.google.accounts.id.prompt();
    }
  }, []);

  return <div ref={btnRef} />;
}
