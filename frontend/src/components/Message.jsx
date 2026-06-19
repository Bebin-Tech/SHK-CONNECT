import React from 'react';
import { CornerUpRight, FileText, Download } from 'lucide-react';

const Message = ({ message, isMe, onReply, isReply = false }) => {
  const role = message.role || 'Member';
  const displayName = message.full_name || message.username;
  const sz = isReply ? 'w-8 h-8 rounded-lg text-[10px]' : 'w-10 h-10 rounded-xl text-xs';

  const roleColors = {
    Admin: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    Owner: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    ED: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    Manager: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    Accounts: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    Staff: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    Member: 'bg-slate-500/10 text-slate-500 border-slate-500/20'
  };

  const avatarColors = {
    Admin: 'bg-blue-600 text-white shadow-blue-600/20',
    Owner: 'bg-purple-600 text-white shadow-purple-600/20',
    ED: 'bg-rose-600 text-white shadow-rose-600/20',
    Manager: 'bg-amber-500 text-white shadow-amber-500/20',
    Accounts: 'bg-indigo-600 text-white shadow-indigo-600/20',
    Staff: 'bg-emerald-600 text-white shadow-emerald-600/20',
    Member: 'bg-slate-200 text-slate-600 shadow-slate-200/20'
  };

  const isImage = (url) => {
    if (!url) return false;
    return url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  };

  return (
    <div className={`group transition-all duration-300 ${isReply ? 'mt-4 ml-6 pl-5 border-l-2 border-slate-100' : 'animate-in fade-in slide-in-from-bottom-2'}`}>
      <div className={`flex items-start gap-4 ${isMe && !isReply ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`${sz} flex-shrink-0 flex items-center justify-center font-bold shadow-lg border-2 border-white overflow-hidden transition-transform group-hover:scale-110 ${avatarColors[role] || avatarColors.Member}`}>
          {displayName[0].toUpperCase()}
        </div>

        {/* Content Block */}
        <div className={`${isReply ? 'flex-1' : 'max-w-[85%] lg:max-w-[70%] min-w-0'}`}>
          <div className={`flex items-center gap-2 mb-1.5 ${isMe && !isReply ? 'justify-end' : ''}`}>
            <span className="text-sm font-black text-slate-900 tracking-tight">{displayName}</span>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest ${roleColors[role] || roleColors.Member}`}>
              {role}
            </span>
            <span className="text-[10px] font-bold text-slate-400">{message.timestamp}</span>
          </div>

          {message.file_url ? (
            isImage(message.file_url) ? (
              <div className="mt-2 group/img relative inline-block">
                <img src={message.file_url} className="max-w-full sm:max-w-md rounded-2xl border-4 border-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-zoom-in" alt="attachment" />
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-2xl" />
              </div>
            ) : (
              <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 mt-2 max-w-sm">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{message.content || 'Secure File'}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Encrypted Download</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-blue-600 transition-colors">
                  <Download size={18} />
                </div>
              </a>
            )
          ) : (
            <div className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm font-medium transition-all duration-300 ${
              isMe && !isReply
                ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/10'
                : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/60'
            }`}>
              {message.content}
            </div>
          )}

          {/* Action Footer */}
          {!isReply && (
            <div className={`mt-2 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-200 ${isMe ? 'justify-end translate-x-2 group-hover:translate-x-0' : '-translate-x-2 group-hover:translate-x-0'}`}>
              <button
                onClick={onReply}
                className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-[0.1em] flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-blue-50 transition-all"
              >
                <CornerUpRight size={12} strokeWidth={3} /> Reply
              </button>
            </div>
          )}

          {/* Nested Replies */}
          {message.replies && message.replies.length > 0 && (
            <div className="space-y-4 mt-2">
              {message.replies.map((reply, idx) => (
                <Message
                  key={idx}
                  message={reply}
                  isMe={reply.username === (isMe ? message.username : '')}
                  isReply={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;
