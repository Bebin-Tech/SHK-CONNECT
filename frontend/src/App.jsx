import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import Layout from './components/Layout';
import ChatArea from './components/ChatArea';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/chat" replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/chat" replace /> : <Signup />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat" element={<ChatArea />} />
          <Route path="chat/:groupId" element={<ChatArea />} />
          <Route path="admin" element={<div className="p-10">Admin area coming soon</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
