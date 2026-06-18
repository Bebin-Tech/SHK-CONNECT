import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { Menu, Search, MessageCircle, Bell, BellOff } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChannelSidebar from './components/ChannelSidebar';
import ChatWindow from './components/ChatWindow';
import ChannelModal from './components/ChannelModal';

const socket = io({
  transports: ['polling', 'websocket']
});

function App() {
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messageOffset, setMessageOffset] = useState(50);

  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meRes, channelsRes] = await Promise.all([
          axios.get('/api/me'),
          axios.get('/api/channels')
        ]);
        setUser(meRes.data);
        setGroups(channelsRes.data);

        // Auto-select first group if available
        if (channelsRes.data.length > 0) {
          selectGroup(channelsRes.data[0]);
        }
      } catch (err) {
        console.error("Failed to fetch initial data", err);
        // Redirect to login if unauthorized (ensure it hits the Flask port)
        if (err.response?.status === 401) {
          if (window.location.port === '5173') {
            window.location.href = 'http://localhost:5000/login';
          } else {
            window.location.href = '/login';
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const selectGroup = useCallback(async (group) => {
    setCurrentGroup(group);
    setMessages([]);
    setMessageOffset(50);

    // Join socket room
    socket.emit('join', { group_id: group.id });

    // Fetch initial messages for this group
    try {
      const res = await axios.get(`/chat/load_history/${group.id}?offset=0`);
      setMessages(res.data.reverse());
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  }, []);

  useEffect(() => {
    socket.on('receive_message', (data) => {
      if (currentGroup && data.group_id === currentGroup.id) {
        if (data.parent_id) {
          setMessages(prev => prev.map(msg =>
            msg.id === data.parent_id
              ? { ...msg, replies: [...(msg.replies || []), data] }
              : msg
          ));
        } else {
          setMessages(prev => [...prev, data]);
        }
      }
    });

    let typingTimeout;
    socket.on('user_typing', (data) => {
      if (currentGroup && data.group_id === currentGroup.id) {
        setTypingUser(data.username);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => setTypingUser(null), 3000);
      }
    });

    socket.on('presence_update', (data) => {
      setOnlineUsers(data.online || []);
    });

    socket.on('refresh_channels', () => {
      axios.get('/api/channels').then(res => setGroups(res.data));
    });

    socket.on('new_notification', (data) => {
      if (currentGroup && parseInt(data.group_id) === currentGroup.id) return;
      setNotifications(prev => [data, ...prev].slice(0, 20));
    });

    return () => {
      socket.off('receive_message');
      socket.off('user_typing');
      socket.off('presence_update');
      socket.off('refresh_channels');
      socket.off('new_notification');
    };
  }, [currentGroup]);

  const handleCreateChannel = async (data) => {
    try {
      const fd = new FormData();
      fd.append('name', data.name);
      fd.append('description', data.description);
      const res = await axios.post('/chat/create_group', fd);
      if (res.data.success) {
        // Refresh will be handled by socket 'refresh_channels'
        return true;
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create channel');
    }
    return false;
  };

  const handleSendMessage = (msgData) => {
    if (!currentGroup) return;
    socket.emit('send_message', {
      ...msgData,
      group_id: currentGroup.id
    });
  };

  const handleUploadFile = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post('/chat/upload', fd);
      return res.data;
    } catch (err) {
      alert("Upload failed");
      return null;
    }
  };

  const loadMoreHistory = async () => {
    if (!currentGroup) return;
    try {
      const res = await axios.get(`/chat/load_history/${currentGroup.id}?offset=${messageOffset}`);
      if (res.data.length > 0) {
        setMessages(prev => [...res.data.reverse(), ...prev]);
        setMessageOffset(prev => prev + res.data.length);
      }
    } catch (err) {
      console.error("Failed to load more history", err);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-shk-light">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-shk-blue"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-shk-light overflow-hidden">
      <Sidebar
        user={user}
        activePath={window.location.pathname}
        isMobileOpen={isMobileMenuOpen}
        toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        <header className="h-16 lg:h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-4 lg:px-10 flex-shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="relative group hidden sm:block">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search across messages..."
                className="bg-slate-100/50 border border-transparent focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 outline-none text-sm w-80 pl-10 pr-4 py-2 rounded-xl transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsNotificationOpen(!isNotificationOpen); setNotifications([]); }}
                className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                  isNotificationOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                }`}
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full ring-2 ring-white">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {isNotificationOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-sm font-bold text-shk-navy">Notifications</h3>
                    <button onClick={() => setNotifications([])} className="text-[10px] font-bold text-slate-400 hover:text-shk-red uppercase tracking-tighter transition-colors">Clear All</button>
                  </div>
                  <div className="max-h-96 overflow-y-auto py-2">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <BellOff size={24} className="text-slate-200" />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">No new notifications</p>
                      </div>
                    ) : (
                      notifications.map((n, i) => (
                        <div key={i} className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0 flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${n.type === 'message' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'}`}>
                            <MessageCircle size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">
                              {n.username} <span className="font-normal text-gray-500">{n.type === 'message' ? 'sent a message in' : 'joined'}</span> #{n.group_name}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1 italic">
                              {n.type === 'message' ? n.content : 'New member active'}
                            </p>
                            <p className="text-[9px] text-gray-300 mt-1 font-bold uppercase">{n.timestamp}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-3 pl-6 border-l border-slate-100">
              <div className="text-right">
                <p className="text-sm font-bold text-shk-navy">{user?.username}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{user?.role}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-bold">
                {user?.username?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <ChannelSidebar
            groups={groups}
            currentGroup={currentGroup}
            onSelectGroup={selectGroup}
            user={user}
            onCreateChannel={() => setIsChannelModalOpen(true)}
          />

          <ChatWindow
            group={currentGroup}
            user={user}
            messages={messages}
            onSendMessage={handleSendMessage}
            onUploadFile={handleUploadFile}
            onLoadHistory={loadMoreHistory}
            typingUser={typingUser}
            canManage={['Admin', 'Owner', 'ED'].includes(user?.role)}
          />
        </div>
      </div>

      <ChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        onCreate={handleCreateChannel}
      />
    </div>
  );
}

export default App;
