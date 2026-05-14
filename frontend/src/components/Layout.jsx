import React, { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, Search, Bell, BellOff, MessageCircle, LayoutDashboard, Archive, Users, LogOut, X } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = []; // Mock notifications for now

  const roleName = user?.role || 'Member';

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <div className="app-shell flex overflow-hidden relative w-full bg-[#F8F9FA]">
      
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div onClick={toggleMobileMenu} className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"></div>
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl flex flex-col transition-transform duration-300`}>
        <div className="px-6 pt-8 pb-6 flex items-center justify-between border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10">
              <img src="/static/img/shk_logo_new.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xs font-black text-[#1A237E] uppercase tracking-tighter">SHK CONNECT</h1>
          </div>
          <button onClick={toggleMobileMenu} className="p-2 text-gray-400"><X size={20} /></button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto">
          <nav className="space-y-4">
            <NavLink to="/chat" onClick={toggleMobileMenu} className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl font-bold ${isActive ? 'bg-blue-50 text-[#1A237E]' : 'text-gray-700'}`}>
              <MessageCircle size={20} /> Team Chat
            </NavLink>
            {['Admin', 'Owner'].includes(roleName) && (
              <NavLink to="/admin" onClick={toggleMobileMenu} className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl font-bold ${isActive ? 'bg-blue-50 text-[#1A237E]' : 'text-gray-700'}`}>
                <LayoutDashboard size={20} /> Admin Center
              </NavLink>
            )}
            <NavLink to="/admin/history" onClick={toggleMobileMenu} className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl font-bold ${isActive ? 'bg-blue-50 text-[#1A237E]' : 'text-gray-700'}`}>
              <Archive size={20} /> History
            </NavLink>
            {roleName === 'Admin' && (
              <NavLink to="/admin/users" onClick={toggleMobileMenu} className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl font-bold ${isActive ? 'bg-blue-50 text-[#1A237E]' : 'text-gray-700'}`}>
                <Users size={20} /> User Directory
              </NavLink>
            )}
          </nav>
        </div>
        <div className="p-6 border-t">
          <button onClick={logout} className="flex items-center gap-3 text-rose-500 font-bold w-full text-left">
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="w-72 bg-white border-r hidden lg:flex flex-col shadow-sm z-10 flex-shrink-0">
        <div className="px-6 pt-8 pb-6 flex items-center gap-3">
          <div className="w-12 h-12 flex-shrink-0">
            <img src="/static/img/shk_logo_new.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-[14px] font-black text-[#1A237E] uppercase tracking-tighter leading-tight">
              SHK <br /><span className="text-[#D4AF37]">CONNECT</span>
            </h1>
          </div>
        </div>

        <div className="px-8 pb-4 flex justify-center">
          <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
            {roleName}
          </span>
        </div>

        <div className="px-6 flex-1 overflow-y-auto">
          <nav className="space-y-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Navigation</p>
            <NavLink to="/chat" className={({isActive}) => `nav-link flex items-center gap-3 p-4 rounded-2xl transition ${isActive ? 'active' : ''}`}>
              <MessageCircle size={20} /> <span className="font-semibold">Team Chat</span>
            </NavLink>
            <NavLink to="/admin/history" className={({isActive}) => `nav-link flex items-center gap-3 p-4 rounded-2xl transition ${isActive ? 'active' : ''}`}>
              <Archive size={20} /> <span className="font-semibold">History</span>
            </NavLink>
            {roleName === 'Admin' && (
              <div className="pt-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">Management</p>
                <NavLink to="/admin/users" className={({isActive}) => `nav-link flex items-center gap-3 p-4 rounded-2xl transition ${isActive ? 'active' : ''}`}>
                  <Users size={20} /> <span className="font-semibold">User Directory</span>
                </NavLink>
              </div>
            )}
          </nav>
        </div>

        <div className="p-8 border-t">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
              {user?.username ? user.username[0].toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-800 truncate">{user?.username}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-3 text-rose-500 hover:text-rose-700 transition font-semibold text-sm w-full text-left">
            <LogOut size={16} /> <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 lg:h-20 bg-white border-b flex items-center justify-between px-4 lg:px-10 flex-shrink-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={toggleMobileMenu} className="lg:hidden p-2 text-gray-400 hover:bg-gray-50 rounded-xl transition">
              <Menu size={20} />
            </button>
            <div className="bg-gray-100 p-2 rounded-xl hidden sm:block">
              <Search size={20} className="text-gray-400" />
            </div>
            <input type="text" placeholder="Search..." className="hidden sm:block bg-transparent border-none outline-none text-sm w-32 sm:w-64" />
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="relative p-2 text-gray-400 hover:text-[#1A237E] transition-colors">
                <Bell size={24} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                    {notifications.length}
                  </span>
                )}
              </button>
              
              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
                    <h3 className="text-sm font-bold text-[#1A237E]">Notifications</h3>
                    <button className="text-[10px] font-bold text-gray-400 hover:text-rose-500 uppercase tracking-tighter transition-colors">Clear All</button>
                  </div>
                  <div className="max-h-96 overflow-y-auto py-2">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <BellOff size={24} className="text-gray-300" />
                        </div>
                        <p className="text-xs text-gray-400 font-medium">No new notifications</p>
                      </div>
                    ) : (
                      notifications.map((n, i) => <div key={i}>Notification</div>)
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-3 pl-6 border-l">
              <div className="text-right">
                <p className="text-sm font-bold text-[#1A237E]">{user?.username}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{roleName}</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-bold">
                {user?.username ? user.username[0].toUpperCase() : 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 lg:p-10 pb-24 lg:pb-10 bg-[#F8F9FA]">
          <Outlet />
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t min-h-20 px-6 flex items-center justify-between mobile-bottom-nav safe-bottom z-30">
          <NavLink to="/chat" className={({isActive}) => `flex flex-col items-center gap-1 ${isActive ? 'text-[#1A237E]' : 'text-gray-400'}`}>
            <MessageCircle size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Chat</span>
          </NavLink>
          {['Admin', 'Owner'].includes(roleName) && (
            <NavLink to="/admin" end className={({isActive}) => `flex flex-col items-center gap-1 ${isActive ? 'text-[#1A237E]' : 'text-gray-400'}`}>
              <LayoutDashboard size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Admin</span>
            </NavLink>
          )}
          {roleName === 'Admin' && (
            <NavLink to="/admin/users" className={({isActive}) => `flex flex-col items-center gap-1 ${isActive ? 'text-[#1A237E]' : 'text-gray-400'}`}>
              <Users size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Users</span>
            </NavLink>
          )}
          <NavLink to="/admin/history" className={({isActive}) => `flex flex-col items-center gap-1 ${isActive ? 'text-[#1A237E]' : 'text-gray-400'}`}>
            <Archive size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
          </NavLink>
          <button onClick={logout} className="flex flex-col items-center gap-1 text-rose-400">
            <LogOut size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Exit</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
