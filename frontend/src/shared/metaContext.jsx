import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchJsonAuth } from "./config";
import metaDefaults from "../../../shared/constants/meta.js";

const DEFAULT_STATE = {
  loading: true,
  error: null,
  version: metaDefaults?.VERSION || null,
  pictograms: metaDefaults?.PICTOGRAMS || [],
  allergens: metaDefaults?.ALLERGENS || [],
  additives: metaDefaults?.ADDITIVES || [],
};

const MetaContext = createContext(DEFAULT_STATE);

export function MetaProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await fetchJsonAuth("/api/meta/init");
        if (!alive) return;
        setState({
          loading: false,
          error: null,
          version: data?.version || metaDefaults?.VERSION || null,
          pictograms: Array.isArray(data?.pictograms) ? data.pictograms : metaDefaults?.PICTOGRAMS || [],
          allergens: Array.isArray(data?.allergens) ? data.allergens : metaDefaults?.ALLERGENS || [],
          additives: Array.isArray(data?.additives) ? data.additives : metaDefaults?.ADDITIVES || [],
        });
      } catch (err) {
        if (!alive) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

export function useMeta() {
  return useContext(MetaContext);
}
