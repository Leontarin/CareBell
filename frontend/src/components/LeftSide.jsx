import React, { useContext } from "react";
import Bella from "../features/Bella";
import { AppContext } from "../shared/AppContext";

export default function LeftSide() {
  const { bellaFullscreen, meetFullscreen } = useContext(AppContext);
  
  // Hide LeftSide when meet is fullscreen
  if (meetFullscreen) return null;
  
  const widthClass = bellaFullscreen ? "w-full" : "w-full md:w-2/5";
  return (
    <div id="leftSide" className={`h-fit ${widthClass} flex flex-col items-center`}>
      <Bella/>
    </div>
  );
}