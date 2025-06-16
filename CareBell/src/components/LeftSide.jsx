import React, { useContext } from "react";
import Bella from "./Bella";
import { AppContext } from "../AppContext";

export default function LeftSide() {
  const { bellaFullscreen } = useContext(AppContext);
  
  if (bellaFullscreen) return null;
  
  return (
    <div id="leftSide" className="w-80 h-[90%] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg border-2 border-blue-200 p-4 overflow-hidden">
      <Bella/>
    </div>
  );
}