import React from 'react';
import { CornerUpRight, FileText, Download } from 'lucide-react';

const Message = ({ message, isMe, onReply, isReply = false }) => {
  const role = message.role || 'Member';
  const displayName = message.full_name || message.username;
  const sz = isReply ? 'w-6 h-6 rounded-md text-[10px]' : 'w-8 h-8 rounded-lg text-xs';

  const roleColors = {
    Admin: 'bg-blue-50 text-blue-600',
    Owner: 'bg-purple-50 text-purple-600',
    ED: 'bg-rose-50 text-rose-600',
    Manager: 'bg-amber-50 text-amber-600',
    Accounts: 'bg-indigo-50 text-indigo-600',
    Staff: 'bg-emerald-50 text-emerald-600',
    Member: 'bg-slate-50 text-slate-400'
  };

  const avatarColors = {
    Admin: 'bg-blue-50 text-blue-600',
    Owner: 'bg-purple-50 text-purple-600',
    ED: 'bg-rose-50 text-rose-600',
    Manager: 'bg-amber-50 text-amber-600',
    Accounts: 'bg-indigo-50 text-indigo-600',
    Staff: 'bg-emerald-50 text-emerald-600',
    Member: 'bg-slate-100 text-slate-500'
  };

  const isImage = (url) => {
    if (!url) return false;
    return url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  };

  return (
    <div className={`msg-block ${isReply ? 'mt-3 ml-4 pl-4 border-l-2 border-slate-100' : ''}`}>
      <div className={`flex items-start gap-3 ${isMe && !isReply ? 'flex-row-reverse' : ''}`}>
        <div className={`${sz} flex-shrink-0 flex items-center justify-center font-bold ${avatarColors[role] || avatarColors.Member}`}>
          {displayName[0].toUpperCase()}
        </div>
        <div className={`${isReply ? 'flex-1' : 'max-w-[85%] lg:max-w-[65%] min-w-0'}`}>
          <div className={`flex items-center gap-1.5 mb-1 ${isMe && !isReply ? 'justify-end' : ''}`}>
            <span className="text-xs font-bold text-shk-navy">{displayName}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${roleColors[role] || roleColors.Member}`}>
              {role}
            </span>
            <span className="text-[10px] text-slate-400">{message.timestamp}</span>
          </div>

          {message.file_url ? (
            isImage(message.file_url) ? (
              <div className="mt-1">
                <img src={message.file_url} className="max-w-full sm:max-w-xs rounded-2xl border border-slate-100 shadow-sm" alt="attachment" />
              </div>
            ) : (
              <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition mt-1">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-shk-blue" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-shk-navy truncate">{message.content || 'File'}</p>
                  <p className="text-[10px] text-slate-400 uppercase">Click to download</p>
                </div>
                <Download size={16} className="text-slate-300" />
              </a>
            )
          ) : (
            <div className={`p-3 rounded-2xl text-sm shadow-sm ${
              isMe ? 'bg-shk-blue text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
            }`}>
              {message.content}
            </div>
          )}

          {!isReply && (
            <div className={`mt-1 ${isMe ? 'flex justify-end' : ''}`}>
              <button
                onClick={onReply}
                className="text-[10px] text-slate-400 hover:text-shk-blue font-semibold flex items-center gap-1"
              >
                <CornerUpRight size={12} /> Reply
              </button>
            </div>
          )}

          {message.replies && message.replies.length > 0 && (
            <div className="space-y-3 mt-3">
              {message.replies.map((reply, idx) => (
                <Message
                  key={idx}
                  message={reply}
                  isMe={reply.username === message.username}
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
