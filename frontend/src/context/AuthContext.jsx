import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, apiErrorMessage } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("srt_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem("srt_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      const merged = { ...data };
      setUser(merged);
      localStorage.setItem("srt_user", JSON.stringify(merged));
    } catch {
      localStorage.removeItem("srt_token");
      localStorage.removeItem("srt_user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(identifier, password) {
    try {
      const { data } = await api.post("/auth/login", { identifier, password });
      localStorage.setItem("srt_token", data.access_token);
      const userInfo = { id: data.user_id, name: data.name, role: data.role };
      localStorage.setItem("srt_user", JSON.stringify(userInfo));
      setUser(userInfo);
      await refreshMe();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err) };
    }
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    localStorage.removeItem("srt_token");
    localStorage.removeItem("srt_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
