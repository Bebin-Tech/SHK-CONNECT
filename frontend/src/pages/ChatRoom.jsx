import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import ChannelSidebar from '../components/ChannelSidebar';
import ChatWindow from '../components/ChatWindow';
import ChannelModal from '../components/ChannelModal';

const socket = io({
  transports: ['polling', 'websocket']
});

const ChatRoom = ({ user }) => {
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [messageOffset, setMessageOffset] = useState(50);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await axios.get('/api/channels');
      setGroups(res.data);
      if (res.data.length > 0 && !currentGroup) {
        selectGroup(res.data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch channels", err);
    }
  }, [currentGroup]);

  useEffect(() => {
    fetchChannels();
  }, []);

  const selectGroup = useCallback(async (group) => {
    setCurrentGroup(group);
    setMessages([]);
    setMessageOffset(50);
    socket.emit('join', { group_id: group.id });
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

    socket.on('refresh_channels', () => {
      fetchChannels();
    });

    return () => {
      socket.off('receive_message');
      socket.off('user_typing');
      socket.off('refresh_channels');
    };
  }, [currentGroup, fetchChannels]);

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

  const handleCreateChannel = async (data) => {
    try {
      const fd = new FormData();
      fd.append('name', data.name);
      fd.append('description', data.description);
      const res = await axios.post('/chat/create_group', fd);
      if (res.data.success) return true;
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create channel');
    }
    return false;
  };

  return (
    <div className="flex h-full overflow-hidden">
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
      <ChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        onCreate={handleCreateChannel}
      />
    </div>
  );
};

export default ChatRoom;
