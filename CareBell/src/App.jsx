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
      className="w-screen h-screen flex flex-col overflow-hidden"
      style={{ fontSize: "var(--font-size-base,18px)" }}
    >
      {/* Header at fixed height */}
      <Header />

      {/* Main content takes remaining height, no page scroll */}
      <div
        id="mainContent"
        className="flex-1 flex flex-row gap-2 overflow-hidden px-2"
        style={{ height: 'calc(100vh - 120px)' }}
      >
        <LeftSide />
        <RightSide />
      </div>
    </div>
  </BrowserRouter>
  </AppContext.Provider>
);
}
