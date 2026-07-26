import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api, apiErrorMessage } from "../../api/client";
import Modal from "../../components/Modal";

const EMOJIS = [
  "😀", "😂", "😊", "😍", "🤔", "😅", "😢", "😮", "🙏", "👍",
  "👎", "👏", "🙌", "💪", "🔥", "🎉", "✅", "❌", "⚠️", "📌",
  "📅", "⏰", "📎", "💡", "❤️", "😎", "🤝", "👋", "🚀", "💯",
];

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(iso) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString();
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function Avatar({ name, photo, online, large = false }) {
  const size = large ? "h-10 w-10" : "h-7 w-7";
  return (
    <div className={`relative flex-shrink-0 ${size}`}>
      {photo ? (
        <img src={photo} alt={name} className={`${size} rounded-full object-cover`} />
      ) : (
        <div className={`${size} rounded-full bg-navy-100 text-navy-700 text-[11px] font-semibold flex items-center justify-center select-none`}>
          {initials(name)}
        </div>
      )}
      {online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />}
    </div>
  );
}

function MessageBubble({ msg, isMine, isRead }) {
  return (
    <div className={`flex items-end gap-2 mb-2.5 ${isMine ? "justify-end" : "justify-start"}`}>
      {!isMine && <Avatar name={msg.sender_name} photo={msg.sender_photo} />}
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          isMine ? "bg-navy-900 text-white rounded-br-sm" : "bg-white border border-slate-200 text-navy-900 rounded-bl-sm"
        }`}
      >
        {!isMine && <p className="text-xs font-semibold text-gold-600 mb-0.5">{msg.sender_name}</p>}
        {msg.message_type === "image" && msg.attachment_path && (
          <a href={msg.attachment_path} target="_blank" rel="noreferrer">
            <img src={msg.attachment_path} alt={msg.attachment_name || "image"} className="max-w-full max-h-64 rounded-lg mb-1 object-contain" />
          </a>
        )}
        {msg.message_type === "document" && msg.attachment_path && (
          <a
            href={msg.attachment_path}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1 ${isMine ? "bg-white/10" : "bg-slate-50"} hover:underline`}
          >
            📎 <span className="truncate">{msg.attachment_name || "Document"}</span>
          </a>
        )}
        {msg.message_type === "voice" && msg.attachment_path && (
          <audio controls src={msg.attachment_path} className="max-w-full" style={{ height: 32 }} />
        )}
        {msg.message_type === "video" && msg.attachment_path && (
          <video controls src={msg.attachment_path} className="max-w-full max-h-64 rounded-lg" />
        )}
        {msg.body && <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>}
        <p className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${isMine ? "text-slate-300" : "text-slate-400"}`}>
          {fmtTime(msg.created_at)}
          {isMine && <span className={isRead ? "text-sky-300" : ""}>{isRead ? "✓✓" : "✓"}</span>}
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [readReceipts, setReadReceipts] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatTab, setNewChatTab] = useState("direct");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);

  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [addMemberId, setAddMemberId] = useState("");

  const [recording, setRecording] = useState(null); // "voice" | "video" | null
  const mediaRecorderRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const videoPreviewRef = useRef(null);

  const fileInputRef = useRef(null);
  const groupPhotoInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const activeIdRef = useRef(null);
  activeIdRef.current = activeId;
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const active = conversations.find((c) => c.id === activeId) || null;

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/chat/conversations");
      setConversations(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    try {
      const { data } = await api.get(`/chat/conversations/${conversationId}/messages`);
      if (activeIdRef.current === conversationId) {
        setMessages(data.messages);
        setReadReceipts(data.read_receipts);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    loadConversations();
    api.get("/chat/staff-directory").then((res) => setDirectory(res.data)).catch(() => {});
    const poll = setInterval(loadConversations, 10000);
    return () => clearInterval(poll);
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    lastMessageIdRef.current = null;
    setShowJumpToLatest(false);
    loadMessages(activeId);
    api.post(`/chat/conversations/${activeId}/read`).then(loadConversations).catch(() => {});
    const poll = setInterval(() => loadMessages(activeId), 2500);
    return () => clearInterval(poll);
  }, [activeId, loadMessages, loadConversations]);

  // Only auto-scroll when a genuinely new message arrives (not on every poll
  // tick), and only if the user is already near the bottom or it's their own
  // outgoing message — otherwise surface a "jump to latest" pill instead of
  // yanking someone back down while they're reading older messages.
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest.id === lastMessageIdRef.current) return;
    const isFirstLoad = lastMessageIdRef.current === null;
    lastMessageIdRef.current = latest.id;

    const container = messagesContainerRef.current;
    const nearBottom = container ? container.scrollHeight - container.scrollTop - container.clientHeight < 150 : true;
    const isMine = latest.sender_id === user.id;

    if (isFirstLoad || nearBottom || isMine) {
      messagesEndRef.current?.scrollIntoView({ behavior: isFirstLoad ? "auto" : "smooth" });
      setShowJumpToLatest(false);
    } else {
      setShowJumpToLatest(true);
    }
  }, [messages, user.id]);

  function jumpToLatest() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowJumpToLatest(false);
  }

  function openConversation(id) {
    setActiveId(id);
    setShowEmoji(false);
  }

  async function sendText(e) {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    const body = text;
    setText("");
    try {
      await api.post(`/chat/conversations/${activeId}/messages`, { body });
      await loadMessages(activeId);
      await loadConversations();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function insertEmoji(e) {
    setText((t) => t + e);
    setShowEmoji(false);
  }

  async function handleFilePick(e) {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: uploaded } = await api.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
      await api.post(`/chat/conversations/${activeId}/messages`, {
        message_type: isImage ? "image" : "document",
        attachment_path: uploaded.file_path,
        attachment_name: file.name,
      });
      await loadMessages(activeId);
      await loadConversations();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function startRecording(kind) {
    setError("");
    try {
      const constraints = kind === "video" ? { audio: true, video: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) mediaChunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(kind);
      if (kind === "video") {
        setTimeout(() => {
          if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
        }, 0);
      }
    } catch {
      setError("Could not access microphone/camera. Check browser permissions.");
    }
  }

  async function stopRecording() {
    const recorder = mediaRecorderRef.current;
    const kind = recording;
    if (!recorder) return;
    const blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(mediaChunksRef.current, { type: recorder.mimeType }));
      recorder.stop();
    });
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(null);

    if (!activeId) return;
    setUploading(true);
    try {
      const ext = kind === "video" ? "webm" : "webm";
      const file = new File([blob], `${kind}-${Date.now()}.${ext}`, { type: recorder.mimeType });
      const formData = new FormData();
      formData.append("file", file);
      const { data: uploaded } = await api.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await api.post(`/chat/conversations/${activeId}/messages`, {
        message_type: kind,
        attachment_path: uploaded.file_path,
        attachment_name: file.name,
      });
      await loadMessages(activeId);
      await loadConversations();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function cancelRecording() {
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(null);
  }

  async function startDirect(otherUserId) {
    setError("");
    try {
      const { data } = await api.post("/chat/conversations", { type: "direct", other_user_id: otherUserId });
      setNewChatOpen(false);
      await loadConversations();
      setActiveId(data.id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function createGroup(e) {
    e.preventDefault();
    if (!groupName.trim() || groupMembers.length === 0) return;
    try {
      const { data } = await api.post("/chat/conversations", { type: "group", name: groupName, member_ids: groupMembers });
      setNewChatOpen(false);
      setGroupName("");
      setGroupMembers([]);
      await loadConversations();
      setActiveId(data.id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function toggleGroupMember(id) {
    setGroupMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function addMemberToGroup() {
    if (!addMemberId || !activeId) return;
    try {
      await api.post(`/chat/conversations/${activeId}/participants`, { user_id: Number(addMemberId) });
      setAddMemberId("");
      await loadConversations();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleGroupPhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: uploaded } = await api.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await api.put(`/chat/conversations/${activeId}`, { image_path: uploaded.file_path });
      await loadConversations();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      if (groupPhotoInputRef.current) groupPhotoInputRef.current.value = "";
    }
  }

  async function removeMember(userId) {
    if (!activeId) return;
    try {
      await api.delete(`/chat/conversations/${activeId}/participants/${userId}`);
      await loadConversations();
      if (userId === user.id) setActiveId(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const myParticipant = active?.participants.find((p) => p.user_id === user.id);
  const availableForGroup = directory.filter((d) => !active?.participants.some((p) => p.user_id === d.id));

  // "Read" = every other participant has read up to (at least) this message.
  function isMessageRead(messageId) {
    if (readReceipts.length === 0) return false;
    return readReceipts.every((r) => r.last_read_message_id !== null && r.last_read_message_id >= messageId);
  }

  const otherParticipant = active?.type === "direct" ? active.participants.find((p) => p.user_id !== user.id) : null;

  let lastDay = null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0 gap-3">
        {/* Conversation list */}
        <div className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-72 min-h-0 flex-col card p-0 overflow-hidden`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 flex-shrink-0">
            <h2 className="font-semibold text-navy-900 text-sm">Chats</h2>
            <button className="btn-gold !py-1 !px-2 !text-xs" onClick={() => { setNewChatOpen(true); setNewChatTab("direct"); }}>+ New</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6 px-3">No conversations yet. Start one!</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={`w-full text-left px-3 py-2.5 border-l-[3px] transition-colors ${
                    activeId === c.id ? "border-gold-500 bg-slate-50" : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      name={c.display_name}
                      photo={c.display_photo}
                      online={c.type === "direct" && c.participants.find((p) => p.user_id !== user.id)?.is_online}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${c.unread_count > 0 ? "font-semibold text-navy-900" : "font-medium text-navy-800"}`}>
                          {c.type === "group" ? `👥 ${c.display_name}` : c.display_name}
                        </span>
                        {c.unread_count > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-red-600 text-white text-[10px] px-1.5 py-0.5 min-w-[18px] text-center">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${c.unread_count > 0 ? "text-slate-600" : "text-slate-400"}`}>
                        {c.last_message ? (c.last_message.body || `[${c.last_message.message_type}]`) : "No messages yet"}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={`${activeId ? "flex" : "hidden md:flex"} flex-1 min-h-0 flex-col card p-0 overflow-hidden`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a conversation to start chatting</div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button className="md:hidden text-slate-500" onClick={() => setActiveId(null)}>&larr;</button>
                  <Avatar name={active.display_name} photo={active.display_photo} online={otherParticipant?.is_online} />
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-900 text-sm truncate">
                      {active.type === "group" ? `👥 ${active.display_name}` : active.display_name}
                    </p>
                    {active.type === "direct" && (
                      <p className={`text-[11px] ${otherParticipant?.is_online ? "text-emerald-600" : "text-slate-400"}`}>
                        {otherParticipant?.is_online ? "Online" : "Offline"}
                      </p>
                    )}
                  </div>
                </div>
                {active.type === "group" && (
                  <button className="text-xs text-navy-700 hover:underline font-medium flex-shrink-0" onClick={() => setGroupInfoOpen(true)}>
                    Group Info
                  </button>
                )}
              </div>

              <div className="relative flex-1 min-h-0">
                <div ref={messagesContainerRef} className="h-full overflow-y-auto px-3 py-3">
                  {messages.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-6">No messages yet — say hello 👋</p>
                  ) : (
                    messages.map((m) => {
                      const showDay = fmtDay(m.created_at) !== lastDay;
                      lastDay = fmtDay(m.created_at);
                      return (
                        <div key={m.id}>
                          {showDay && <p className="text-center text-[11px] text-slate-400 my-2">{lastDay}</p>}
                          <MessageBubble msg={m} isMine={m.sender_id === user.id} isRead={isMessageRead(m.id)} />
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                {showJumpToLatest && (
                  <button
                    onClick={jumpToLatest}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-navy-900 text-white text-xs font-medium px-3 py-1.5 shadow-lg hover:bg-navy-800 transition-colors"
                  >
                    New messages ↓
                  </button>
                )}
              </div>

              {recording && (
                <div className="border-t border-slate-200 bg-slate-50 p-3 flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm text-red-600 font-medium animate-pulse">● Recording {recording}...</span>
                  {recording === "video" && <video ref={videoPreviewRef} autoPlay muted className="h-16 rounded" />}
                  <div className="ml-auto flex gap-2">
                    <button className="btn-secondary !py-1 !text-xs" onClick={cancelRecording}>Cancel</button>
                    <button className="btn-primary !py-1 !text-xs" onClick={stopRecording}>Stop & Send</button>
                  </div>
                </div>
              )}

              <form onSubmit={sendText} className="border-t border-slate-200 p-2.5 flex items-center gap-1.5 relative flex-shrink-0">
                {showEmoji && (
                  <div className="absolute bottom-14 left-2 card p-2 grid grid-cols-8 gap-1 z-10 shadow-lg">
                    {EMOJIS.map((e) => (
                      <button key={e} type="button" className="text-lg hover:bg-slate-100 rounded transition-colors" onClick={() => insertEmoji(e)}>{e}</button>
                    ))}
                  </div>
                )}
                <button type="button" className="text-xl px-1 hover:opacity-70 transition-opacity" title="Emoji" onClick={() => setShowEmoji((s) => !s)}>😊</button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilePick} />
                <button type="button" className="text-xl px-1 hover:opacity-70 transition-opacity" title="Attach file" onClick={() => fileInputRef.current?.click()} disabled={uploading}>📎</button>
                <button type="button" className="text-xl px-1 hover:opacity-70 transition-opacity" title="Record voice" onClick={() => startRecording("voice")} disabled={uploading || !!recording}>🎤</button>
                <button type="button" className="text-xl px-1 hover:opacity-70 transition-opacity" title="Record video" onClick={() => startRecording("video")} disabled={uploading || !!recording}>📹</button>
                <input
                  className="input flex-1 !rounded-full !py-2"
                  placeholder={uploading ? "Uploading..." : "Type a message"}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={uploading}
                />
                <button type="submit" className="btn-gold !rounded-full !py-2 !px-4" disabled={uploading || !text.trim()}>Send</button>
              </form>
            </>
          )}
        </div>
      </div>

      {error && <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Modal open={newChatOpen} title="New Chat" onClose={() => setNewChatOpen(false)} error={error}>
        <div className="flex gap-2 mb-3">
          <button className={newChatTab === "direct" ? "btn-primary !text-xs !py-1" : "btn-secondary !text-xs !py-1"} onClick={() => setNewChatTab("direct")}>Direct Message</button>
          <button className={newChatTab === "group" ? "btn-primary !text-xs !py-1" : "btn-secondary !text-xs !py-1"} onClick={() => setNewChatTab("group")}>New Group</button>
        </div>
        {newChatTab === "direct" ? (
          <div className="max-h-72 overflow-y-auto space-y-1">
            {directory.map((d) => (
              <button key={d.id} className="w-full text-left px-3 py-2 rounded hover:bg-slate-50 flex items-center gap-2.5" onClick={() => startDirect(d.id)}>
                <Avatar name={d.name} photo={d.profile_photo} online={d.is_online} />
                <span className="flex-1 truncate">{d.name}</span>
                <span className="badge bg-slate-100 text-slate-600 capitalize">{d.role}</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={createGroup} className="space-y-3">
            <div>
              <label className="label">Group Name</label>
              <input className="input" required value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>
            <div>
              <label className="label">Members</label>
              <div className="max-h-56 overflow-y-auto space-y-1 border border-slate-200 rounded p-2">
                {directory.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm px-1 py-1.5 hover:bg-slate-50 rounded">
                    <input type="checkbox" checked={groupMembers.includes(d.id)} onChange={() => toggleGroupMember(d.id)} />
                    <Avatar name={d.name} photo={d.profile_photo} online={d.is_online} />
                    {d.name} <span className="text-slate-400 text-xs capitalize">({d.role})</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setNewChatOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create Group</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={groupInfoOpen} title={`Group: ${active?.display_name || ""}`} onClose={() => setGroupInfoOpen(false)} error={error}>
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={active?.display_name} photo={active?.display_photo} large />
          {myParticipant?.is_admin && (
            <>
              <input ref={groupPhotoInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleGroupPhotoUpload} />
              <button type="button" className="btn-secondary !text-xs !py-1" onClick={() => groupPhotoInputRef.current?.click()}>
                Change Group Photo
              </button>
            </>
          )}
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Members</p>
        <div className="space-y-1 mb-4">
          {active?.participants.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1.5">
              <span className="flex items-center gap-2">
                <Avatar name={p.name} photo={p.profile_photo} online={p.is_online} />
                {p.name} {p.is_admin && <span className="badge bg-gold-100 text-gold-700 ml-1">admin</span>}
              </span>
              {(myParticipant?.is_admin || p.user_id === user.id) && (
                <button className="text-red-600 hover:underline text-xs" onClick={() => removeMember(p.user_id)}>
                  {p.user_id === user.id ? "Leave" : "Remove"}
                </button>
              )}
            </div>
          ))}
        </div>
        {availableForGroup.length > 0 && (
          <div className="flex gap-2">
            <select className="input flex-1" value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)}>
              <option value="">Add a member...</option>
              {availableForGroup.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
            <button className="btn-secondary" onClick={addMemberToGroup} disabled={!addMemberId}>Add</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
