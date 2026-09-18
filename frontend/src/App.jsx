import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { socket } from './socket';
import Layout from './components/Layout';
import ChatRoom from './pages/ChatRoom';
import Dashboard from './pages/Dashboard';
import UserDirectory from './pages/UserDirectory';
import History from './pages/History';
import HistoryDetail from './pages/HistoryDetail';
import SupportTickets from './pages/SupportTickets';
import Expenses from './pages/Expenses';
import ActivityLogs from './pages/ActivityLogs';
import Profile from './pages/Profile';



function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get('/api/me');
        setUser(res.data);
        socket.connect();
      } catch (err) {
        if (err.response?.status === 401) {
          window.location.href = '/login';
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    socket.on('new_notification', (data) => {
      setNotifications(prev => [data, ...prev].slice(0, 20));
    });
    return () => socket.off('new_notification');
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 font-outfit">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">SHK CONNECT</p>
        </div>
      </div>
    );
  }

  if (!user) return <div role="alert">Unable to load your account. Please reload or sign in again.</div>;

  return (
    <BrowserRouter>
      <Layout
        user={user}
        activePath={window.location.pathname}
        notifications={notifications}
        setNotifications={setNotifications}
      >
        <Routes>
          <Route path="/dm/:recipientId" element={<ChatRoom user={user} />} />
          <Route path="/chat/:groupId?" element={<ChatRoom user={user} />} />
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/users" element={<UserDirectory />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:groupId" element={<HistoryDetail />} />
          <Route path="/tickets" element={<SupportTickets />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/logs" element={<ActivityLogs />} />
          <Route path="/profile" element={<Profile user={user} />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
          <Route path="/" element={<Navigate to="/chat" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
