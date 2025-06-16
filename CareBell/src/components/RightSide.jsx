import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import {
  FaPhone,
  FaUsers,
  FaPills,
  FaUtensils,
  FaNewspaper,
  FaDumbbell,
  FaArrowLeft
} from "react-icons/fa";
import {
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
  Outlet
} from "react-router-dom";
import { AppContext } from "../AppContext";
import CallContacts      from "./CallContacts";
import MeetWithFriends   from "./MeetWithFriends";
import Medication        from "./Medication";
import Meals             from "./Meals";
import News              from "./News";
import Exercise          from "./Exercise";

export default function RightSide() {
  const { t } = useTranslation();
  const { user, bellaFullscreen } = useContext(AppContext);
  const navigate = useNavigate();
  if (bellaFullscreen) return null;
  const { pathname } = useLocation();
  const segment = pathname.split("/").pop();

  // Menu definitions with translation keys
  const MENU_BUTTONS = [
    { key: "callContacts",     icon: FaPhone,     to: "call-contacts"     },
    { key: "meetWithFriends",  icon: FaUsers,     to: "meet-with-friends" },
    { key: "medicine",         icon: FaPills,     to: "medicine"          },
    { key: "meals",            icon: FaUtensils,  to: "meals"             },
    { key: "news",             icon: FaNewspaper, to: "news"              },
    { key: "exercise",         icon: FaDumbbell,  to: "exercise"          },
  ];

  const TITLES = {
    "call-contacts":     "callContacts",
    "meet-with-friends": "meetWithFriends",
    medicine:            "medicine",
    meals:               "meals",
    news:                "news",
    exercise:            "exercise",
  };

  const titleKey = TITLES[segment];
  const title = titleKey ? t(`RightSide.${titleKey}`) : "";

  const heightClass = "h-full";
  const widthClass  = "w-full";

  if (!user) {
    return (
      <div className={`${widthClass} ${heightClass} px-4 flex items-center justify-center overflow-hidden`}>
        <p className="text-xl">{t("RightSide.loadingUser")}</p>
      </div>
    );
  }

  return (
    <div id="rightSide" className={`${widthClass} ${heightClass} px-2 overflow-hidden`}>
      <Routes>
        {/* Main menu - No scroll */}
        <Route
          index
          element={
            <div className="h-full flex flex-col p-4 overflow-hidden">
              <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-4 overflow-hidden">
                {MENU_BUTTONS.map(({ key, icon: Icon, to }) => (
                  <Link
                    key={to}
                    to={to}
                    className="group relative flex flex-col items-center justify-center border-3 border-blue-900 rounded-2xl p-4 bg-white hover:bg-blue-50 hover:shadow-xl hover:scale-105 transition-all duration-300 ease-in-out whitespace-nowrap shadow-lg overflow-hidden"
                  >
                    {/* Icon with background circle */}
                    <div className="bg-blue-100 rounded-full p-3 mb-3 group-hover:bg-blue-200 transition-colors duration-300">
                      <Icon className="text-3xl text-blue-900" />
                    </div>
                    
                    {/* Text with better typography */}
                    <span className="text-lg font-bold text-blue-900 text-center leading-tight">
                      {t(`RightSide.${key}`)}
                    </span>
                    
                    {/* Subtle arrow indicator */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          }
        />

        {/* Sub-pages - No scroll */}
        <Route element={
          <div className="flex flex-col h-full min-h-0 bg-gradient-to-br from-slate-300 to-slate-400 overflow-hidden">
            {/* Compact Toolbar for tablet */}
            <div className="bg-white shadow-lg border-b-2 border-blue-900 px-4 py-2 flex-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(-1)}
                    className="group flex items-center gap-2 px-4 py-2 bg-blue-900 border-2 border-blue-900 rounded-xl text-white font-bold text-sm hover:bg-blue-800 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    <FaArrowLeft className="text-sm group-hover:animate-pulse" /> 
                    {t("RightSide.back")}
                  </button>
                  
                  <div className="w-px h-6 bg-blue-300"></div>
                  
                  <h2 className="text-xl font-bold text-blue-900 whitespace-nowrap tracking-wide">
                    {title}
                  </h2>
                </div>
                
                <div className="flex items-center gap-2 text-blue-700">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium">Active</span>
                </div>
              </div>
            </div>

            {/* Content Area - Scrollable only inside */}
            <div className="flex-1 overflow-hidden p-2">
              <div className="h-full bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <div className="p-4">
                    <Outlet />
                  </div>
                </div>
              </div>
            </div>
          </div>
        }>
          <Route path="call-contacts"     element={<CallContacts />} />
          <Route path="meet-with-friends" element={<MeetWithFriends />} />
          <Route path="medicine"          element={<Medication />} />
          <Route path="meals"             element={<Meals />} />
          <Route path="news"              element={<News />} />
          <Route path="exercise"          element={<Exercise />} />
        </Route>
      </Routes>
    </div>
  );
}