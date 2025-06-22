//./src/AppContext.js
import React from "react";
export const AppContext = React.createContext({
  user:  null,
  setUser: () => {},
  bellaFullscreen: false,
  setBellaFullscreen: () => {},
  darkMode: false,
  setDarkMode: () => {},
});