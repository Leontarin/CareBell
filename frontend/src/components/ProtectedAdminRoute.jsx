// src/components/ProtectedAdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { AppContext } from "../shared/AppContext";

export default function ProtectedAdminRoute({ children }) {
  const { user } = React.useContext(AppContext);

  // if not logged in or not admin, redirect home
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}