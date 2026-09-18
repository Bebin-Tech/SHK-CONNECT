import axios from 'axios';
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, Search, Bell, BellOff, MessageCircle } from 'lucide-react';

const Layout = ({ user, children, activePath, notifications, setNotifications }) => {
  const [searchResults, setSearchResults] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  return (
    <div className="app-layout flex h-screen bg-slate-50 overflow-hidden font-outfit">
      <Sidebar
        user={user}
        activePath={activePath}
        isMobileOpen={isMobileMenuOpen}
        toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="app-content flex-1 flex flex-col min-w-0 overflow-hidden">
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
                placeholder="Search workspace..."
                onKeyDown={async e => { if (e.key === 'Enter') { try { const res = await axios.get('/chat/search', {params:{q:e.currentTarget.value}}); setSearchResults(res.data); } catch { setSearchResults([]); } } }}
                className="bg-slate-100/50 border border-transparent focus:border-blue-500/20 focus:bg-white focus:ring-4 focus:ring-blue-500/5 outline-none text-sm w-80 pl-10 pr-4 py-2 rounded-xl transition-all"
              />
              {searchResults && <div className="absolute top-full bg-white shadow-xl rounded-xl p-4 max-h-80 overflow-auto w-96 z-50"><button onClick={() => setSearchResults(null)} className="float-right">Close</button>{searchResults.length ? searchResults.map(result => <a className="block py-3 border-b" key={result.id} href={`/${result.is_archived ? 'history' : 'chat'}/${result.group_id}`}>{result.user}: {result.content}</a>) : <p>No results</p>}</div>}
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsNotificationOpen(!isNotificationOpen); }}
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
                        <div key={i} onClick={() => { window.location.href = n.group_id ? `/chat/${n.group_id}` : `/dm/${n.recipient_id}`; }} className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0 flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${n.type === 'message' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'}`}>
                            <MessageCircle size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">
                              {n.username} <span className="font-normal text-gray-500">{n.group_id ? 'sent a message in' : 'sent you a direct message'}</span> {n.group_id ? `#${n.group_name}` : ''}
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
              <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-bold ring-2 ring-white shadow-sm">
                {user?.username?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
