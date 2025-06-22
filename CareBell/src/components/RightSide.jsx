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
    { key: "callContacts",     icon: FaPhone,    to: "call-contacts"     },
    { key: "meetWithFriends",  icon: FaUsers,    to: "meet-with-friends" },
    { key: "medicine",         icon: FaPills,    to: "medicine"          },
    { key: "meals",            icon: FaUtensils, to: "meals"             },
    { key: "news",             icon: FaNewspaper,to: "news"              },
    { key: "exercise",         icon: FaDumbbell, to: "exercise"          },
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

  const heightClass = "h-[75vh]";
  const widthClass  = "w-[48vw]";

  if (!user) {
    return (
      <div className={`${widthClass} ${heightClass} px-4 flex items-center justify-center`}>
        <p className="text-xl">{t("RightSide.loadingUser")}</p>
      </div>
    );
  }

  return (
    <div id="rightSide" className={`${widthClass} ${heightClass} px-4 overflow-hidden`}>
      <Routes>
        {/* Main menu */}
        <Route
          index
          element={
            <div className="grid grid-cols-2 gap-6 p-6">
              {MENU_BUTTONS.map(({ key, icon: Icon, to }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex flex-col items-center justify-center border-2 border-blue-900 dark:border-yellow-300 rounded-xl p-6 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition whitespace-nowrap"
                >
                  <Icon className="text-4xl mb-2 text-blue-900 dark:text-blue-200" />
                  <span className="text-lg font-semibold text-blue-900 dark:text-blue-200">
                    {t(`RightSide.${key}`)}
                  </span>
                </Link>
              ))}
            </div>
          }
        />

        {/* Sub-pages */}
        <Route element={
          <div className="flex flex-col h-full min-h-0 bg-slate-400 dark:bg-gray-700 p-4">
            {/* Toolbar */}
            <div className="flex items-center mb-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-blue-900 dark:border-yellow-300 rounded-lg text-blue-900 dark:text-blue-200 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
              >
                <FaArrowLeft /> {t("RightSide.back")}
              </button>
              <h2 className="ml-4 text-2xl font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                {title}
              </h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-w-0">
              <div className="w-full p-2">
                <Outlet />
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
