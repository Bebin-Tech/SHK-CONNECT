import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, X, CornerUpRight, Download, Users, Settings2, Link, Archive, MessageCircle, MoreVertical, ShieldCheck, Zap } from 'lucide-react';
import axios from 'axios';
import Message from './Message';
import ChannelProfileModal from './ChannelProfileModal';
import ConnectUsersModal from './ConnectUsersModal';

const ChatWindow = ({ group, user, messages, onSendMessage, onUploadFile, onLoadHistory, typingUser, canManage, onTyping }) => {
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() && !pendingFile) return;

    onSendMessage({
      content: input,
      parent_id: replyTo?.id,
      file_url: pendingFile?.url,
      file_type: pendingFile?.type,
      file_name: pendingFile?.name
    });

    setInput('');
    setReplyTo(null);
    setPendingFile(null);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploaded = await onUploadFile(file);
    if (uploaded) setPendingFile(uploaded);
  };

  if (!group) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
             style={{ backgroundImage: `radial-gradient(#0e1b42 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />

        <div className="relative z-10 animate-in fade-in zoom-in duration-700">
          <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center mb-8 mx-auto rotate-3 border border-slate-100">
            <MessageCircle size={48} className="text-blue-600 -rotate-3" strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Workspace Entry</h2>
          <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
            Select a secure channel from the left sidebar to start real-time synchronized discussions.
          </p>
          <div className="mt-10 flex items-center justify-center gap-2">
            <div className="px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Team workspace</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white relative">
      {/* Dynamic Header */}
      <header className="h-20 border-b border-slate-100 flex items-center justify-between gap-4 px-6 lg:px-8 bg-white/80 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative group cursor-pointer" onClick={() => canManage && setIsProfileModalOpen(true)}>
            <div className="w-12 h-12 rounded-2xl flex-shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center font-black text-blue-600 text-lg border-2 border-white shadow-md transition-transform group-hover:scale-105">
              {group.avatar_url ? (
                <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                group.name[0].toUpperCase()
              )}
            </div>
            {canManage && (
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                <Settings2 size={16} className="text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg text-slate-900 truncate leading-none">{group.name}</h3>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100">
                <Zap size={10} className="fill-blue-600" />
                <span className="text-[9px] font-black uppercase tracking-tighter">Live</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-bold truncate mt-1 tracking-tight">
              {group.description || 'Secure communication channel for the team.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 mr-2">
            <Users size={14} className="text-slate-400 mr-2" />
            <span className="text-xs font-black text-slate-600 uppercase tracking-wider">{group.member_count} Members</span>
          </div>

          {canManage && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                title="Connect Users"
              >
                <Link size={20} strokeWidth={2.5} />
              </button>
              <button
                onClick={async () => {
                  if(confirm('Are you sure you want to archive this channel? It will be moved to the History section.')) {
                    await axios.post(`/chat/archive_group/${group.id}`);
                  }
                }}
                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                title="Archive Channel"
              >
                <Archive size={20} strokeWidth={2.5} />
              </button>
              <div className="w-px h-6 bg-slate-100 mx-1" />
              <button onClick={() => setIsProfileModalOpen(true)} title="Channel settings" className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all">
                <MoreVertical size={20} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Message Stream */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 lg:px-10 py-8 space-y-8 custom-scrollbar bg-slate-50/30"
      >
        <div className="flex justify-center mb-10">
          <button
            onClick={onLoadHistory}
            className="group flex items-center gap-3 px-6 py-2.5 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-400 hover:text-blue-600 hover:border-blue-500/30 hover:shadow-lg transition-all duration-300 uppercase tracking-[0.2em]"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors" />
            Load Earlier Transcripts
          </button>
        </div>

        {messages.map((msg) => (
          <Message
            key={msg.id}
            message={msg}
            isMe={user && msg.username === user.username}
            onReply={() => setReplyTo(msg)}
          />
        ))}

        {typingUser && (
          <div className="flex items-center gap-3 animate-pulse px-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{typingUser} is composing...</p>
          </div>
        )}
      </div>

      {/* Synchronized Input */}
      <footer className="p-6 lg:p-8 bg-white border-t border-slate-100 relative">
        {/* Overlays (Reply & File) */}
        <div className="max-w-4xl mx-auto space-y-2">
          {replyTo && (
            <div className="mb-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-300 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0">
                  <CornerUpRight size={14} strokeWidth={3} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">Replying to</p>
                  <p className="text-sm font-bold text-slate-900 truncate mt-1">@{replyTo.username}</p>
                </div>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1.5 text-blue-400 hover:text-blue-600 transition-colors">
                <X size={18} strokeWidth={3} />
              </button>
            </div>
          )}

          {pendingFile && (
            <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-300 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg shadow-amber-500/20">
                  <Paperclip size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">Attached Ready</p>
                  <p className="text-sm font-bold text-slate-900 truncate mt-1">{pendingFile.name}</p>
                </div>
              </div>
              <button onClick={() => setPendingFile(null)} className="p-1.5 text-amber-400 hover:text-amber-600 transition-colors">
                <X size={18} strokeWidth={3} />
              </button>
            </div>
          )}

          {/* Main Input Form */}
          <form onSubmit={handleSend} className="relative group/input">
            <div className="flex items-end gap-2 bg-slate-50 border-2 border-slate-100 rounded-3xl p-2 transition-all duration-300 focus-within:bg-white focus-within:border-blue-600/20 focus-within:shadow-2xl focus-within:shadow-blue-600/5 focus-within:-translate-y-0.5">
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all shrink-0"
              >
                <Paperclip size={20} strokeWidth={2.5} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
              />
              <textarea
                value={input}
                onChange={(e) => { setInput(e.target.value); onTyping?.(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder="Synchronize a message..."
                className="flex-1 bg-transparent outline-none text-[15px] py-3.5 px-2 resize-none max-h-40 font-medium text-slate-800 placeholder:text-slate-300"
                rows="1"
              />
              <button
                type="submit"
                disabled={!input.trim() && !pendingFile}
                className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all shrink-0 shadow-lg active:scale-95 ${
                  (input.trim() || pendingFile)
                    ? 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send size={18} strokeWidth={3} className={(input.trim() || pendingFile) ? 'translate-x-0.5' : ''} />
              </button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">Enter</span> Send Sync
              </p>
              <div className="w-1 h-1 rounded-full bg-slate-200" />
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-sans tracking-normal">Shift + Enter</span> New Line
              </p>
            </div>
          </form>
        </div>
      </footer>

      {/* Modals */}
      <ChannelProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        group={group}
        onUpdate={() => window.location.reload()}
      />
      <ConnectUsersModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        groupId={group.id}
        currentMembers={group.members}
      />
    </main>
  );
};

export default ChatWindow;
