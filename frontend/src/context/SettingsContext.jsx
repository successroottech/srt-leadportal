import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

const SettingsContext = createContext(null);

const DEFAULTS = {
  portal_name: "SRT Management Portal",
  organization_name: "Success Root Technologies",
  logo_path: null,
  work_start_hour: 9,
  work_end_hour: 18,
  support_email: null,
  support_phone: null,
  address: null,
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/settings");
      setSettings(data);
    } catch {
      /* keep defaults if unreachable */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!settings.logo_path) return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = settings.logo_path;
  }, [settings.logo_path]);

  useEffect(() => {
    document.title = settings.portal_name;
  }, [settings.portal_name]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
