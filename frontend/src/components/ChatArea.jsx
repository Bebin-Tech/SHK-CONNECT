import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ChannelSidebar from './ChannelSidebar';
import { Hash, Settings2, Link, Archive, Paperclip, X, CornerUpRight, Send, MessageCircle, ChevronRight, Plus } from 'lucide-react';

export default function ChatArea() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  
  const [initData, setInitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  // Modals Forms
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/init${groupId ? '/' + groupId : ''}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          navigate('/chat');
          return;
        }
        setInitData(data);
        if (groupId && data.messages) {
          setMessages(data.messages);
        } else {
          setMessages([]);
        }
      })
      .finally(() => setLoading(false));
  }, [groupId, navigate]);

  useEffect(() => {
    if (!socket || !groupId) return;

    socket.emit('join', { group_id: groupId });

    const handleReceive = (msg) => {
      if (msg.parent_id) {
        setMessages(prev => prev.map(m => {
          if (m.id === msg.parent_id) {
            return { ...m, replies: [...(m.replies || []), msg] };
          }
          return m;
        }));
      } else {
        setMessages(prev => [...prev, msg]);
      }
    };

    const handleTyping = (data) => {
      setTypingUser(data.username);
      setTimeout(() => setTypingUser(null), 3000);
    };

    socket.on('receive_message', handleReceive);
    socket.on('user_typing', handleTyping);

    return () => {
      socket.off('receive_message', handleReceive);
      socket.off('user_typing', handleTyping);
    };
  }, [socket, groupId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView();
    }
  }, [messages]);

  const handleSend = () => {
    const content = input.trim();
    if (!content && !pendingFile) return;
    
    socket.emit('send_message', { 
      group_id: groupId, 
      content, 
      parent_id: replyTo?.id, 
      file_url: pendingFile?.url, 
      file_type: pendingFile?.type, 
      file_name: pendingFile?.name 
    });
    
    setInput('');
    setReplyTo(null);
    setPendingFile(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    socket?.emit('typing', { group_id: groupId });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/chat/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) {
        setPendingFile({ url: data.url, type: data.type, name: data.name, size: file.size });
      }
    } catch(err) {
      alert('Upload failed');
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    
    const fd = new FormData();
    fd.append('name', newChannelName);
    fd.append('description', newChannelDesc);
    
    const res = await fetch('/chat/create_group', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) {
      setCreateModalOpen(false);
      setNewChannelName('');
      setNewChannelDesc('');
      navigate(`/chat/${data.id}`);
    } else {
      alert(data.error);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>;

  const { groups, current_group, all_roles } = initData;
  const canManageChannel = current_group && (['Admin', 'Owner'].includes(user.role) || current_group.created_by === user.id);

  const getRoleBadge = (r) => {
    let cls = 'bg-gray-100 text-gray-500';
    if (r === 'Admin') cls = 'bg-blue-100 text-blue-600';
    if (r === 'Owner') cls = 'bg-purple-100 text-purple-600';
    if (r === 'ED') cls = 'bg-rose-100 text-rose-600';
    if (r === 'Manager') cls = 'bg-amber-100 text-amber-600';
    if (r === 'Accounts') cls = 'bg-indigo-100 text-indigo-600';
    if (r === 'Staff') cls = 'bg-emerald-100 text-emerald-600';
    return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>{r}</span>;
  };

  const getAvatarCls = (r) => {
    if (r === 'Admin') return 'bg-blue-100 text-blue-700';
    if (r === 'Owner') return 'bg-purple-100 text-purple-700';
    if (r === 'ED') return 'bg-rose-100 text-rose-700';
    if (r === 'Manager') return 'bg-amber-100 text-amber-700';
    if (r === 'Accounts') return 'bg-indigo-100 text-indigo-700';
    if (r === 'Staff') return 'bg-emerald-100 text-emerald-700';
    return 'bg-orange-100 text-orange-600';
  };

  return (
    <div className="chat-layout flex flex-1 min-h-0 -m-4 lg:-m-10 bg-white relative overflow-hidden">
      
      {mobileChannelsOpen && (
        <div onClick={() => setMobileChannelsOpen(false)} className="fixed top-16 bottom-20 left-0 right-0 z-30 bg-black/40 lg:hidden transition-opacity"></div>
      )}

      {/* Channel Sidebar is partially handled inside chat layout on mobile for nested feel */}
      <div className={`fixed lg:static top-16 bottom-20 left-0 z-40 lg:z-auto transition-transform duration-300 transform ${mobileChannelsOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 flex`}>
        <ChannelSidebar 
          groups={groups} 
          currentGroupId={groupId} 
          onMobileClose={() => setMobileChannelsOpen(false)} 
          onOpenCreateModal={() => setCreateModalOpen(true)}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
        {current_group ? (
          <>
            <header className="min-h-14 border-b flex items-center justify-between gap-2 px-3 lg:px-5 py-2 flex-shrink-0 bg-white z-10">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => setMobileChannelsOpen(!mobileChannelsOpen)} className="lg:hidden p-2 text-gray-400 hover:bg-gray-50 rounded-lg">
                  <Hash size={20} />
                </button>
                <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm bg-blue-100 text-[#1A237E]">
                  {current_group.avatar_url ? (
                    <img src={current_group.avatar_url} alt={current_group.name} className="w-full h-full object-cover" />
                  ) : current_group.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-[#1A237E] truncate">{current_group.name}</h3>
                  <p className="hidden sm:block text-[10px] text-gray-400 truncate">{current_group.description || 'Team Channel'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                {canManageChannel && (
                  <>
                    <button className="p-2 bg-blue-50 text-[#1A237E] rounded-xl hover:bg-blue-100 transition shadow-sm border border-blue-100 flex items-center gap-2" title="Edit Profile">
                      <Settings2 size={16} /><span className="hidden sm:inline text-xs font-bold">EDIT</span>
                    </button>
                    <button className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition shadow-sm border border-indigo-100 flex items-center gap-2" title="Connect Roles">
                      <Link size={16} /><span className="hidden sm:inline text-xs font-bold">CONNECT</span>
                    </button>
                  </>
                )}
                {['Admin', 'Owner'].includes(user.role) && (
                  <button className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition shadow-sm border border-rose-100" title="Archive">
                    <Archive size={16} />
                  </button>
                )}
              </div>
            </header>

            {pendingFile && (
              <div className="px-3 sm:px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
                <Paperclip size={16} className="text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{pendingFile.name}</p>
                  <p className="text-[10px] text-gray-400">{(pendingFile.size/1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => setPendingFile(null)} className="p-1 hover:bg-amber-100 rounded text-amber-500"><X size={16}/></button>
              </div>
            )}

            {replyTo && (
              <div className="px-3 sm:px-5 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <CornerUpRight size={14} className="text-blue-500" />
                  <span className="text-gray-500">Replying to <strong className="text-[#1A237E]">{replyTo.username}</strong>: <span className="italic text-gray-500 truncate max-w-[200px] inline-block align-bottom">{replyTo.content.substring(0,50)}...</span></span>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4 bg-gray-50/30">
              {messages.map(msg => {
                const isMe = msg.user_id === user.id;
                return (
                  <div key={msg.id} className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-xs ${getAvatarCls(msg.role)}`}>
                      {msg.username[0].toUpperCase()}
                    </div>
                    <div className="max-w-[85%] lg:max-w-[65%] min-w-0">
                      <div className={`flex items-center gap-1.5 mb-1 ${isMe ? 'justify-end' : ''}`}>
                        <span className="text-xs font-bold text-gray-800">{msg.username}</span>
                        {getRoleBadge(msg.role)}
                        <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
                      </div>
                      
                      {msg.file_url ? (
                        msg.file_type === 'image' ? (
                          <a href={msg.file_url} target="_blank" rel="noreferrer">
                            <img src={msg.file_url} className="max-w-full sm:max-w-xs rounded-2xl border shadow-sm hover:opacity-90 transition mt-1" alt="attachment" />
                          </a>
                        ) : (
                          <a href={msg.file_url} target="_blank" rel="noreferrer" download className="flex items-center gap-2 p-3 rounded-2xl border bg-white shadow-sm hover:shadow-md transition mt-1">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-[#1A237E]">FILE</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-800 truncate">{msg.content || msg.file_name}</p>
                            </div>
                          </a>
                        )
                      ) : (
                        <div className={`p-3 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-[#1A237E] text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border'}`}>
                          {msg.content}
                        </div>
                      )}
                      
                      <div className={`mt-1 ${isMe ? 'flex justify-end' : ''}`}>
                        <button onClick={() => setReplyTo(msg)} className="text-[10px] text-gray-400 hover:text-[#1A237E] font-semibold flex items-center gap-1">
                          <CornerUpRight size={12} /> Reply
                        </button>
                      </div>

                      {msg.replies && msg.replies.length > 0 && (
                        <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-100 space-y-3">
                          {msg.replies.map(rep => (
                            <div key={rep.id} className="flex items-start gap-2">
                              <div className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center font-bold text-[10px] ${getAvatarCls(rep.role)}`}>
                                {rep.username[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[11px] font-bold text-gray-700">{rep.username}</span>
                                  {getRoleBadge(rep.role)}
                                  <span className="text-[10px] text-gray-400">{rep.timestamp}</span>
                                </div>
                                <div className={`p-2 rounded-xl text-xs ${rep.user_id === user.id ? 'bg-[#1A237E] text-white' : 'bg-gray-100 text-gray-800'}`}>
                                  {rep.content}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {typingUser && <div className="px-5 py-1 text-[10px] italic text-gray-400 bg-white">{typingUser} is typing...</div>}
            
            <footer className="p-3 sm:p-4 bg-white border-t flex-shrink-0">
              <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-[#1A237E] transition">
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-gray-200 rounded-lg transition text-gray-400 hover:text-[#1A237E] flex-shrink-0">
                  <Paperclip size={16} />
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.mp4,.webm" onChange={handleFileChange} />
                <textarea 
                  value={input}
                  onChange={handleTyping}
                  onKeyDown={handleKeyDown}
                  rows={1} 
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent outline-none text-sm py-1 resize-none max-h-28"
                  style={{ minHeight: '28px' }}
                />
                <button onClick={handleSend} className="p-2.5 bg-[#1A237E] text-white rounded-xl hover:bg-[#3949AB] transition flex-shrink-0">
                  <Send size={16} />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-10 bg-gray-50">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <MessageCircle size={32} className="text-[#1A237E]" />
            </div>
            <h2 className="text-xl font-bold text-[#1A237E] mb-1">Select a Channel</h2>
            <p className="text-gray-400 text-sm font-medium">Choose a channel from the sidebar to start chatting.</p>
            <div className="mt-6 w-full max-w-sm lg:hidden">
              {groups && groups.length > 0 ? (
                <div className="space-y-2 text-left">
                  {groups.map(g => (
                    <div key={g.id} onClick={() => navigate(`/chat/${g.id}`)} className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm transition cursor-pointer">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1A237E] flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {g.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-[#1A237E] truncate">{g.name}</p>
                        <p className="text-[10px] text-gray-400">{g.member_count} members</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  ))}
                </div>
              ) : (
                <button onClick={() => setCreateModalOpen(true)} className="w-full py-3 bg-[#1A237E] text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  <Plus size={16} /> Create Channel
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#1A237E]">Create New Channel</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Channel Name</label>
                <input type="text" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="e.g. Sales Team" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#1A237E] text-sm font-semibold" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Description</label>
                <textarea value={newChannelDesc} onChange={e => setNewChannelDesc(e.target.value)} placeholder="What's this channel for?" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#1A237E] text-sm h-24 resize-none"></textarea>
              </div>
              <button type="submit" className="w-full py-3 bg-[#1A237E] text-white rounded-xl font-bold hover:bg-[#3949AB] transition shadow-lg mt-2 uppercase">Create Channel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
