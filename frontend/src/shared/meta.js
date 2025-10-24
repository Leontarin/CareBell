import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { API } from "./config";

const MetaContext = createContext({
  version: null,
  pictograms: [],
  allergens: [],
  additives: [],
  loading: true,
  error: null,
  ready: false,
  refresh: async () => {},
});

function normalizeMeta(payload = {}) {
  const normalizeList = (value) => (Array.isArray(value) ? value : []);
  return {
    version: typeof payload.version === "string" ? payload.version : null,
    pictograms: normalizeList(payload.pictograms),
    allergens: normalizeList(payload.allergens),
    additives: normalizeList(payload.additives),
  };
}

export function MetaProvider({ children }) {
  const mountedRef = useRef(true);
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: normalizeMeta(),
  });

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchMeta = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`${API}/api/meta/init`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (!mountedRef.current) return;
      setState({ loading: false, error: null, data: normalizeMeta(json) });
    } catch (error) {
      if (!mountedRef.current) return;
      setState((prev) => ({ ...prev, loading: false, error }));
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  const value = useMemo(() => {
    const { loading, error, data } = state;
    return {
      ...data,
      loading,
      error,
      ready: !loading && !error,
      refresh: fetchMeta,
    };
  }, [state, fetchMeta]);

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

export function useMeta() {
  return useContext(MetaContext);
}
