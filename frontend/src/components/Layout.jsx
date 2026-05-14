import React, { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, Search, Bell, MessageCircle, LayoutDashboard, Archive, Users, LogOut, LifeBuoy } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const roleName = user?.role || 'Member';

  return (
    <div className="flex h-screen w-full bg-[#F4F7FE] overflow-hidden font-['Outfit']">
      
      {/* 1. Navigation Sidebar (Left) */}
      <aside className="w-64 bg-white border-r flex flex-col flex-shrink-0 hidden lg:flex">
        <div className="p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white shadow-sm rounded-xl overflow-hidden p-1 border border-gray-100">
              <img src="/static/img/shk_connect_logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-sm font-black text-[#1A237E] leading-tight">SHK</h1>
              <h1 className="text-xs font-bold text-gray-400 tracking-tighter uppercase">Connect</h1>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-[#E7F3EF] text-[#2D9E78] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
            <div className="w-1.5 h-1.5 bg-[#2D9E78] rounded-full"></div>
            {roleName}
          </div>
        </div>

        <div className="flex-1 px-4 space-y-1">
          <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Navigation</p>
          <NavLink to="/chat" className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-[#1A237E] text-white shadow-lg shadow-blue-900/20' : 'text-gray-500 hover:bg-gray-50 font-bold'}`}>
            <MessageCircle size={20} />
            <span className="text-sm">Team Chat</span>
          </NavLink>
          <NavLink to="/history" className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-[#1A237E] text-white shadow-lg shadow-blue-900/20' : 'text-gray-500 hover:bg-gray-50 font-bold'}`}>
            <Archive size={20} />
            <span className="text-sm">History</span>
          </NavLink>
          <NavLink to="/support" className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-[#1A237E] text-white shadow-lg shadow-blue-900/20' : 'text-gray-500 hover:bg-gray-50 font-bold'}`}>
            <LifeBuoy size={20} />
            <span className="text-sm">Support</span>
          </NavLink>

          {roleName === 'Admin' && (
            <div className="pt-6">
              <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Administration</p>
              <NavLink to="/admin" end className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-[#1A237E] text-white shadow-lg shadow-blue-900/20' : 'text-gray-500 hover:bg-gray-50 font-bold'}`}>
                <LayoutDashboard size={20} />
                <span className="text-sm">Admin Dashboard</span>
              </NavLink>
              <NavLink to="/admin/users" className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-[#1A237E] text-white shadow-lg shadow-blue-900/20' : 'text-gray-500 hover:bg-gray-50 font-bold'}`}>
                <Users size={20} />
                <span className="text-sm">User Management</span>
              </NavLink>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50/50">
          <div className="flex items-center gap-3 mb-6 p-2">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-black shadow-sm">
              {user?.username ? user.username[0].toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-[#1A237E] truncate">{user?.username}</p>
              <p className="text-[10px] font-bold text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-4 px-4 py-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-black text-xs w-full">
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area (Includes Channel Sidebar and Chat) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b px-5 lg:px-8 flex items-center justify-between flex-shrink-0 z-20">
          <div className="hidden lg:flex items-center gap-6 w-full max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search workflow..." 
                className="w-full bg-[#F4F7FE] border-none rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-100 text-sm font-medium" 
              />
            </div>
          </div>
          {/* Mobile: show page title */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-8 h-8 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              <img src="/static/img/shk_connect_logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-black text-[#1A237E] uppercase tracking-wider">SHK Connect</span>
          </div>

          <div className="flex items-center gap-6">
            <button className="p-2.5 text-gray-400 hover:text-[#1A237E] bg-gray-50 rounded-xl transition-all">
              <Bell size={20} />
            </button>
            <div className="h-10 w-[1px] bg-gray-100"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-[#1A237E]">{user?.role === 'Admin' ? 'HR' : user?.role || 'STAFF'}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">STAFF</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-black">
                {user?.username ? user.username[0].toUpperCase() : 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Nav Bar - matches screenshots: CHAT | ADMIN | USERS | HISTORY | EXIT */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex items-center justify-around z-50 py-2 safe-bottom">
          <NavLink to="/chat" className={({isActive}) => `flex flex-col items-center gap-1 px-3 py-2 rounded-2xl ${isActive ? 'text-[#1A237E]' : 'text-gray-400'}`}>
            <MessageCircle size={22} />
            <span className="text-[9px] font-black uppercase tracking-widest">Chat</span>
          </NavLink>
          {roleName === 'Admin' && (
            <NavLink to="/admin" end className={({isActive}) => `flex flex-col items-center gap-1 px-3 py-2 rounded-2xl ${isActive ? 'text-[#1A237E]' : 'text-gray-400'}`}>
              <LayoutDashboard size={22} />
              <span className="text-[9px] font-black uppercase tracking-widest">Admin</span>
            </NavLink>
          )}
          {roleName === 'Admin' && (
            <NavLink to="/admin/users" className={({isActive}) => `flex flex-col items-center gap-1 px-3 py-2 rounded-2xl ${isActive ? 'text-[#1A237E]' : 'text-gray-400'}`}>
              <Users size={22} />
              <span className="text-[9px] font-black uppercase tracking-widest">Users</span>
            </NavLink>
          )}
          <NavLink to="/history" className={({isActive}) => `flex flex-col items-center gap-1 px-3 py-2 rounded-2xl ${isActive ? 'text-[#1A237E]' : 'text-gray-400'}`}>
            <Archive size={22} />
            <span className="text-[9px] font-black uppercase tracking-widest">History</span>
          </NavLink>
          <button onClick={logout} className="flex flex-col items-center gap-1 px-3 py-2 text-rose-500">
            <LogOut size={22} />
            <span className="text-[9px] font-black uppercase tracking-widest">Exit</span>
          </button>
      </nav>
    </div>
  );
}
