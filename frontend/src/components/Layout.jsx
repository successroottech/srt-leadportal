import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { api, apiErrorMessage } from "../api/client";
import SrtLogo from "../assets/SrtLogo";
import { NAV_BY_ROLE } from "./nav";

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

const ROLE_LABELS = {
  admin: "Administrator",
  hr: "HR",
  telecaller: "Telecaller",
  trainer: "Trainer",
  student: "Student",
};

export default function Layout() {
  const { user, logout, refreshMe } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  const items = NAV_BY_ROLE[user?.role] || [];
  const hasChat = user?.role !== "student";

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data } = await api.get("/notifications/unread-count");
        if (active) setUnread(data.count);
      } catch {
        /* ignore */
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!hasChat) return;
    let active = true;
    async function load() {
      try {
        const { data } = await api.get("/chat/unread-count");
        if (active) setChatUnread(data.count);
      } catch {
        /* ignore */
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [hasChat]);

  useEffect(() => {
    if (!hasChat) return;
    let active = true;
    async function beat() {
      try {
        await api.post("/chat/presence/heartbeat");
      } catch {
        /* ignore */
      }
    }
    beat();
    const interval = setInterval(() => active && beat(), 45000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [hasChat]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: uploaded } = await api.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await api.post("/auth/me/photo", { file_path: uploaded.file_path });
      await refreshMe();
    } catch (err) {
      alert(apiErrorMessage(err));
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto bg-navy-950 text-white transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
          {settings.logo_path ? (
            <img src={settings.logo_path} alt={settings.portal_name} className="h-9 w-9 rounded-md object-contain bg-white/5" />
          ) : (
            <SrtLogo size={36} />
          )}
          <div>
            <p className="text-sm font-bold leading-tight">{settings.portal_name}</p>
            <p className="text-[11px] text-gold-400">{ROLE_LABELS[user?.role] || ""}</p>
          </div>
        </div>
        <nav className="mt-3 flex flex-col gap-0.5 px-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split("/").length === 2}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-gold-500 text-navy-950" : "text-slate-200 hover:bg-white/10"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 flex-shrink-0">
          <button className="lg:hidden btn-secondary !px-2 !py-1" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-4">
            {hasChat && (
              <NavLink to={`/${user?.role}/chat`} className="relative text-slate-500 hover:text-navy-900" title="Chat">
                💬
                {chatUnread > 0 && (
                  <span className="absolute -top-1 -right-2 rounded-full bg-red-600 px-1.5 text-[10px] text-white">
                    {chatUnread}
                  </span>
                )}
              </NavLink>
            )}
            <NavLink
              to={`/${user?.role}/notifications`}
              className="relative text-slate-500 hover:text-navy-900"
              title="Notifications"
            >
              🔔
              {unread > 0 && (
                <span className="absolute -top-1 -right-2 rounded-full bg-red-600 px-1.5 text-[10px] text-white">
                  {unread}
                </span>
              )}
            </NavLink>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-navy-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[user?.role]}</p>
            </div>
            <input ref={photoInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handlePhotoUpload} />
            <button
              type="button"
              title="Change my photo"
              className="relative h-8 w-8 flex-shrink-0 rounded-full overflow-hidden hover:opacity-80 transition-opacity"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {user?.profile_photo ? (
                <img src={user.profile_photo} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <span className="h-full w-full flex items-center justify-center bg-navy-100 text-navy-700 text-xs font-semibold">
                  {initials(user?.name)}
                </span>
              )}
            </button>
            <button className="btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
