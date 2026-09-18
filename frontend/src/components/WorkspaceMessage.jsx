import React from 'react';
import { MessageSquare, Paperclip } from 'lucide-react';

export default function WorkspaceMessage({ message, onThread, currentUser }) {
  const name = message.full_name || message.username || 'Deleted user';
  const image = message.file_url && (message.file_url.startsWith('data:image/') || /\.(png|jpe?g|gif|webp)$/i.test(message.file_url));
  return <article className="ws-message" id={`message-${message.id}`}>
    <div className={`ws-avatar ${message.user_id === currentUser?.id ? 'ws-avatar-own' : ''}`}>{name.slice(0, 1).toUpperCase()}</div>
    <div className="ws-message-body">
      <div className="ws-message-meta"><strong>{name}</strong><time dateTime={message.created_at}>{message.timestamp}</time>{message.user_id === currentUser?.id && <span>you</span>}</div>
      {message.content && <div className="ws-message-text">{message.content.split(/(@[\w.-]+)/g).map((part, i) => part.startsWith('@') ? <mark key={i}>{part}</mark> : part)}</div>}
      {message.file_url && (image ? <a href={message.file_url} target="_blank" rel="noreferrer"><img className="ws-attachment-image" src={message.file_url} alt={message.content || 'Shared image'} /></a> : <a className="ws-attachment" href={message.file_url} target="_blank" rel="noreferrer"><Paperclip size={16} />{message.file_name || 'Open attachment'}</a>)}
      {onThread && <button className="ws-thread-link" onClick={() => onThread(message)}><MessageSquare size={14} />{message.replies?.length ? `${message.replies.length} ${message.replies.length === 1 ? 'reply' : 'replies'}` : 'Reply in thread'}</button>}
    </div>
  </article>;
}
