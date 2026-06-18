import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, X, CornerUpRight, Download, Users, Settings2, Link, Archive, MessageCircle } from 'lucide-react';
import axios from 'axios';
import Message from './Message';
import ChannelProfileModal from './ChannelProfileModal';
import ConnectUsersModal from './ConnectUsersModal';

const ChatWindow = ({ group, user, messages, onSendMessage, onUploadFile, onLoadHistory, typingUser, canManage }) => {
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
    if (uploaded) {
      setPendingFile(uploaded);
    }
  };

  if (!group) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-shk-light">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <MessageCircle size={32} className="text-shk-blue" />
        </div>
        <h2 className="text-xl font-bold text-shk-navy mb-1">Select a Channel</h2>
        <p className="text-slate-400 text-sm font-medium">Choose a channel from the sidebar to start chatting.</p>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      {/* Header */}
      <header className="min-h-14 border-b border-slate-100 flex items-center justify-between gap-2 px-5 py-2 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center font-bold text-shk-blue">
            {group.avatar_url ? (
              <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
            ) : (
              group.name[0].toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-shk-navy truncate">{group.name}</h3>
            <p className="hidden sm:block text-[10px] text-slate-400 truncate">{group.description || 'Team Channel'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:flex text-xs text-slate-400 font-semibold items-center gap-1">
            <Users size={14} /> {group.member_count} members
          </span>
          {canManage && (
            <>
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="p-2 bg-slate-50 text-shk-blue rounded-xl hover:bg-slate-100 transition border border-slate-100 flex items-center gap-2"
              >
                <Settings2 size={16} />
                <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Edit</span>
              </button>
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="p-2 bg-slate-50 text-shk-blue rounded-xl hover:bg-slate-100 transition border border-slate-100 flex items-center gap-2"
              >
                <Link size={16} />
                <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Connect</span>
              </button>
              <button
                onClick={async () => {
                  if(confirm('Archive this channel?')) {
                    await axios.post(`/chat/archive_group/${group.id}`);
                  }
                }}
                className="p-2 bg-rose-50 text-shk-red rounded-xl hover:bg-rose-100 transition border border-rose-100"
              >
                <Archive size={16} />
              </button>
            </>
          )}
        </div>
      </header>

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
        currentMembers={[]} // In a real app, you'd pass actual member objects
      />

      {/* Message Container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-slate-50/50"
      >
        <div className="flex justify-center pb-4">
          <button
            onClick={onLoadHistory}
            className="text-[10px] font-bold text-slate-400 hover:text-shk-blue uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm transition"
          >
            Load Earlier Messages
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
      </div>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-slate-100">
        {replyTo && (
          <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <CornerUpRight size={14} className="text-blue-500" />
              <span className="text-gray-500">Replying to <strong className="text-shk-navy">{replyTo.username}</strong></span>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        )}

        {pendingFile && (
          <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3">
            <Paperclip size={16} className="text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate">{pendingFile.name}</p>
            </div>
            <button onClick={() => setPendingFile(null)} className="p-1 hover:bg-amber-100 rounded text-amber-500">
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-shk-blue focus-within:bg-white transition-all shadow-sm">
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition text-slate-400 hover:text-shk-blue flex-shrink-0"
          >
            <Paperclip size={18} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Type your message..."
            className="flex-1 bg-transparent outline-none text-sm py-1 resize-none max-h-28 text-slate-700 placeholder:text-slate-400"
            rows="1"
          />
          <button
            type="submit"
            className="p-2.5 bg-shk-blue text-white rounded-xl hover:bg-shk-navy transition-all flex-shrink-0 shadow-md active:scale-95"
          >
            <Send size={18} />
          </button>
        </form>
        {typingUser && (
          <p className="mt-1 text-[10px] italic text-slate-400 px-1">{typingUser} is typing...</p>
        )}
      </footer>
    </main>
  );
};

export default ChatWindow;
