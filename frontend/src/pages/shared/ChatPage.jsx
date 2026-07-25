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

function MessageBubble({ msg, isMine }) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2`}>
      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${isMine ? "bg-navy-900 text-white" : "bg-slate-100 text-navy-900"}`}>
        {!isMine && <p className="text-xs font-semibold text-gold-600 mb-0.5">{msg.sender_name}</p>}
        {msg.message_type === "image" && msg.attachment_path && (
          <a href={msg.attachment_path} target="_blank" rel="noreferrer">
            <img src={msg.attachment_path} alt={msg.attachment_name || "image"} className="max-w-full max-h-64 rounded mb-1 object-contain" />
          </a>
        )}
        {msg.message_type === "document" && msg.attachment_path && (
          <a href={msg.attachment_path} target="_blank" rel="noreferrer" className={`flex items-center gap-2 underline ${isMine ? "text-white" : "text-navy-800"}`}>
            📎 {msg.attachment_name || "Document"}
          </a>
        )}
        {msg.message_type === "voice" && msg.attachment_path && (
          <audio controls src={msg.attachment_path} className="max-w-full" />
        )}
        {msg.message_type === "video" && msg.attachment_path && (
          <video controls src={msg.attachment_path} className="max-w-full max-h-64 rounded" />
        )}
        {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
        <p className={`text-[10px] mt-1 ${isMine ? "text-slate-300" : "text-slate-400"}`}>{fmtTime(msg.created_at)}</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
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
  const messagesEndRef = useRef(null);
  const activeIdRef = useRef(null);
  activeIdRef.current = activeId;

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
      if (activeIdRef.current === conversationId) setMessages(data);
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
    loadMessages(activeId);
    api.post(`/chat/conversations/${activeId}/read`).then(loadConversations).catch(() => {});
    const poll = setInterval(() => loadMessages(activeId), 2500);
    return () => clearInterval(poll);
  }, [activeId, loadMessages, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  let lastDay = null;

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex flex-1 min-h-0 gap-3">
        {/* Conversation list */}
        <div className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-72 flex-col card p-0 overflow-hidden`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
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
                  className={`w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50 ${activeId === c.id ? "bg-slate-100" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-navy-900 truncate">
                      {c.type === "group" ? `👥 ${c.display_name}` : c.display_name}
                    </span>
                    {c.unread_count > 0 && (
                      <span className="flex-shrink-0 rounded-full bg-red-600 text-white text-[10px] px-1.5 py-0.5 min-w-[18px] text-center">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {c.last_message ? (c.last_message.body || `[${c.last_message.message_type}]`) : "No messages yet"}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col card p-0 overflow-hidden`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a conversation to start chatting</div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <button className="md:hidden text-slate-500" onClick={() => setActiveId(null)}>&larr;</button>
                  <span className="font-semibold text-navy-900 text-sm truncate">
                    {active.type === "group" ? `👥 ${active.display_name}` : active.display_name}
                  </span>
                </div>
                {active.type === "group" && (
                  <button className="text-xs text-navy-700 hover:underline font-medium flex-shrink-0" onClick={() => setGroupInfoOpen(true)}>
                    Group Info
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                {messages.map((m) => {
                  const showDay = fmtDay(m.created_at) !== lastDay;
                  lastDay = fmtDay(m.created_at);
                  return (
                    <div key={m.id}>
                      {showDay && <p className="text-center text-[11px] text-slate-400 my-2">{lastDay}</p>}
                      <MessageBubble msg={m} isMine={m.sender_id === user.id} />
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {recording && (
                <div className="border-t border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                  <span className="text-sm text-red-600 font-medium animate-pulse">● Recording {recording}...</span>
                  {recording === "video" && <video ref={videoPreviewRef} autoPlay muted className="h-16 rounded" />}
                  <div className="ml-auto flex gap-2">
                    <button className="btn-secondary !py-1 !text-xs" onClick={cancelRecording}>Cancel</button>
                    <button className="btn-primary !py-1 !text-xs" onClick={stopRecording}>Stop & Send</button>
                  </div>
                </div>
              )}

              <form onSubmit={sendText} className="border-t border-slate-200 p-2 flex items-center gap-1 relative">
                {showEmoji && (
                  <div className="absolute bottom-12 left-2 card p-2 grid grid-cols-8 gap-1 z-10 shadow-lg">
                    {EMOJIS.map((e) => (
                      <button key={e} type="button" className="text-lg hover:bg-slate-100 rounded" onClick={() => insertEmoji(e)}>{e}</button>
                    ))}
                  </div>
                )}
                <button type="button" className="text-xl px-1" title="Emoji" onClick={() => setShowEmoji((s) => !s)}>😊</button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilePick} />
                <button type="button" className="text-xl px-1" title="Attach file" onClick={() => fileInputRef.current?.click()} disabled={uploading}>📎</button>
                <button type="button" className="text-xl px-1" title="Record voice" onClick={() => startRecording("voice")} disabled={uploading || !!recording}>🎤</button>
                <button type="button" className="text-xl px-1" title="Record video" onClick={() => startRecording("video")} disabled={uploading || !!recording}>📹</button>
                <input
                  className="input flex-1 !py-1.5"
                  placeholder={uploading ? "Uploading..." : "Type a message"}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={uploading}
                />
                <button type="submit" className="btn-gold !py-1.5" disabled={uploading || !text.trim()}>Send</button>
              </form>
            </>
          )}
        </div>
      </div>

      {error && <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Modal open={newChatOpen} title="New Chat" onClose={() => setNewChatOpen(false)}>
        <div className="flex gap-2 mb-3">
          <button className={newChatTab === "direct" ? "btn-primary !text-xs !py-1" : "btn-secondary !text-xs !py-1"} onClick={() => setNewChatTab("direct")}>Direct Message</button>
          <button className={newChatTab === "group" ? "btn-primary !text-xs !py-1" : "btn-secondary !text-xs !py-1"} onClick={() => setNewChatTab("group")}>New Group</button>
        </div>
        {newChatTab === "direct" ? (
          <div className="max-h-72 overflow-y-auto space-y-1">
            {directory.map((d) => (
              <button key={d.id} className="w-full text-left px-3 py-2 rounded hover:bg-slate-50 flex items-center justify-between" onClick={() => startDirect(d.id)}>
                <span>{d.name}</span>
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
                  <label key={d.id} className="flex items-center gap-2 text-sm px-1 py-1 hover:bg-slate-50 rounded">
                    <input type="checkbox" checked={groupMembers.includes(d.id)} onChange={() => toggleGroupMember(d.id)} />
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

      <Modal open={groupInfoOpen} title={`Group: ${active?.display_name || ""}`} onClose={() => setGroupInfoOpen(false)}>
        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Members</p>
        <div className="space-y-1 mb-4">
          {active?.participants.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1.5">
              <span>{p.name} {p.is_admin && <span className="badge bg-gold-100 text-gold-700 ml-1">admin</span>}</span>
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
