import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ChannelSidebar from './ChannelSidebar';
import { Hash, Settings2, Link as LinkIcon, Archive, Paperclip, X, CornerUpRight, Send, MessageCircle, ChevronRight, Plus } from 'lucide-react';

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
    fetch(`/api/chat/init${groupId ? '/' + groupId : ''}`)
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

  const handleTypingLocal = (e) => {
    setInput(e.target.value);
    socket?.emit('typing', { group_id: groupId });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/chat/upload', { method: 'POST', body: fd });
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
    
    const res = await fetch('/api/chat/create_group', { method: 'POST', body: fd });
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

  const { groups, current_group } = initData;

  const getRoleBadge = (r) => {
    return <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-blue-50 text-blue-500`}>{r}</span>;
  };

  const getAvatarCls = (r) => {
    if (r === 'Admin') return 'bg-blue-50 text-blue-500';
    if (r === 'Owner') return 'bg-purple-50 text-purple-500';
    if (r === 'HR') return 'bg-emerald-50 text-emerald-500';
    return 'bg-orange-50 text-orange-500';
  };

  return (
    <div className="flex flex-1 min-h-0 bg-white">
      
      <ChannelSidebar 
        groups={groups} 
        currentGroupId={groupId} 
        onMobileClose={() => setMobileChannelsOpen(false)} 
        onOpenCreateModal={() => setCreateModalOpen(true)}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-[#F4F7FE]/30">
        {current_group ? (
          <>
            <header className="h-20 border-b flex items-center justify-between px-8 bg-white flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#F4F7FE] text-[#1A237E] rounded-xl flex items-center justify-center font-black">
                  <Hash size={20} />
                </div>
                <div>
                  <h3 className="font-black text-[#1A237E] flex items-center gap-2">
                    {current_group.name}
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  </h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{current_group.description || 'CODING'}</p>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {messages.map(msg => (
                <div key={msg.id} className="flex items-start gap-4 group">
                  <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-xs ${getAvatarCls(msg.role)}`}>
                    {msg.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-black text-[#1A237E] uppercase">{msg.username}</span>
                      {getRoleBadge(msg.role)}
                      <span className="text-[10px] font-bold text-gray-300">{msg.timestamp}</span>
                    </div>
                    
                    <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.02)] inline-block min-w-[120px]">
                      {msg.file_url ? (
                        <div className="flex items-center gap-4 border border-gray-50 bg-[#F4F7FE]/50 p-3 rounded-xl">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <Archive size={20} className="text-blue-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[11px] font-black text-[#1A237E] uppercase tracking-tighter">{msg.file_name}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">FILE • CLICK TO DOWNLOAD</p>
                          </div>
                          <a href={msg.file_url} download className="text-gray-400 hover:text-[#1A237E]">
                            <Plus size={18} className="rotate-45" />
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-gray-600 leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                    <div className="mt-2">
                      <button onClick={() => setReplyTo(msg)} className="text-[10px] font-black text-gray-400 hover:text-[#1A237E] uppercase tracking-tighter">
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <footer className="p-8 bg-white border-t flex-shrink-0">
              <div className="relative group">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300">
                  <Paperclip size={20} />
                </div>
                <input 
                  type="text"
                  value={input}
                  onChange={handleTypingLocal}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${current_group.name}...`}
                  className="w-full bg-[#F4F7FE] border-none rounded-2xl py-5 pl-16 pr-20 outline-none focus:ring-2 focus:ring-blue-100 text-sm font-medium"
                />
                <button 
                  onClick={handleSend}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#1A237E] text-white rounded-xl flex items-center justify-center hover:bg-[#0D145A] transition-all shadow-lg shadow-blue-900/20"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="mt-3 text-[9px] font-bold text-gray-300 uppercase text-center tracking-widest">Enter to send • Shift+Enter for new line • Max 20MB</p>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
             <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-6">
                <MessageCircle size={40} className="text-[#1A237E]" />
             </div>
             <h2 className="text-2xl font-black text-[#1A237E] mb-2 uppercase tracking-tighter">Select a Channel</h2>
             <p className="text-gray-400 font-bold max-w-xs mx-auto">Choose a channel from the sidebar to start collaborating with your team.</p>
          </div>
        )}
      </main>

      {createModalOpen && (
        <div className="fixed inset-0 bg-blue-900/10 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md p-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-[#1A237E]">Create Channel</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>
            <form onSubmit={handleCreateChannel} className="space-y-6">
              <input type="text" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="Channel Name" className="w-full p-5 bg-gray-50 border-none rounded-2xl outline-none" required />
              <textarea value={newChannelDesc} onChange={e => setNewChannelDesc(e.target.value)} placeholder="Description" className="w-full p-5 bg-gray-50 border-none rounded-2xl h-24 resize-none outline-none" />
              <button type="submit" className="w-full py-5 bg-[#1A237E] text-white rounded-2xl font-black shadow-lg">CREATE</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
