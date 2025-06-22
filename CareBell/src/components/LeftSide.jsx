import React, { useContext } from "react";
import Bella from "../features/Bella";
import { AppContext } from "../shared/AppContext";

export default function LeftSide() {
  const { bellaFullscreen } = useContext(AppContext);
  const widthClass = bellaFullscreen ? 'w-full' : 'w-full landscape:w-2/5';
  return (
    <div id="leftSide" className={`h-fit ${widthClass} flex flex-col items-center`}>
      <Bella />
    </div>
  );
}