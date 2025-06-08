//./src/App.jsx
import React, {useEffect, useState} from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";


import Header        from "./components/Header";
import LeftSide      from "./components/LeftSide";
import RightSide     from "./components/RightSide";
import { AppContext } from "./AppContext";
import { API } from "./config"

/**
 * Fetches JSON from the given URL and throws on HTTP errors.
 * @param {string} url
 * @returns {Promise<any>}
 */
export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}


export default function App() {

  const [user, setUser] = useState(null);
  const [bellaFullscreen, setBellaFullscreen] = useState(false);

  useEffect(() => {
    //Set first user as default user
    async function loadInitUser(){
      try{
        var users = await fetchJson(`${API}/users/`);
        setUser(users[0]);
      }
      catch(error){
        console.error("Error fetching users:",error);
      }
    };
    loadInitUser();
  }, []);

  return (
    <AppContext.Provider value={{user, setUser, bellaFullscreen, setBellaFullscreen}}>
    <BrowserRouter>
      <div
        className="
          w-full max-w-screen-lg mx-auto
          p-4
          h-screen          /* exactly viewport height */
          flex flex-col
        "
        style={{ fontSize: "var(--font-size-base,22px)" }}
      >
        {/* 1) Header at fixed height */}
        <Header />

        {/* 2) Main content takes remaining height, no page scroll */}
        <div
          id="mainContent"
          className="
            flex-1               /* fill remaining height */
            flex flex-col md:flex-row gap-2
            overflow-hidden      /* hide any overflow—scroll in children only */
          "
        >
          <LeftSide />

          {/* RightSide now will be h-full and scroll internally */}
          <RightSide />
        </div>
      </div>
    </BrowserRouter>
    </AppContext.Provider>
  );
}
