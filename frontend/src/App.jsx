import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { Menu, Search, MessageCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChannelSidebar from './components/ChannelSidebar';
import ChatWindow from './components/ChatWindow';

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

    return () => {
      socket.off('receive_message');
      socket.off('user_typing');
      socket.off('refresh_channels');
    };
  }, [currentGroup]);

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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 lg:h-20 bg-white border-b border-slate-100 flex items-center justify-between px-4 lg:px-10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition"
            >
              <Menu size={24} />
            </button>
            <div className="bg-slate-50 p-2 rounded-xl hidden sm:block">
              <Search size={20} className="text-slate-300" />
            </div>
            <input
              type="text"
              placeholder="Search messages..."
              className="hidden sm:block bg-transparent border-none outline-none text-sm w-64 px-2"
            />
          </div>

          <div className="flex items-center gap-6">
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
            onCreateChannel={() => alert("Create Channel modal not implemented yet")}
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
    </div>
  );
}

export default App;
