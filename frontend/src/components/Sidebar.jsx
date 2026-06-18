import React from 'react';
import { MessageCircle, LayoutDashboard, Archive, Users, LogOut, X } from 'lucide-react';

const Sidebar = ({ user, activePath, toggleMobileMenu, isMobileOpen }) => {
  const role = user?.role || 'Member';

  const navItems = [
    { icon: MessageCircle, label: 'Team Chat', path: '/chat', roles: ['Admin', 'Owner', 'ED', 'Manager', 'Accounts', 'Staff', 'Member'] },
    { icon: Archive, label: 'History', path: '/history', roles: ['Admin', 'Owner', 'ED', 'Manager', 'Accounts', 'Staff', 'Member'] },
    { icon: Users, label: 'User Directory', path: '/users', roles: ['Admin'] },
    { icon: LayoutDashboard, label: 'Admin Center', path: '/admin', roles: ['Admin', 'Owner', 'ED'] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(role));

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Logo & Brand Header */}
      <div className="px-6 py-7 flex items-center gap-3 border-b border-slate-800/60">
        <div className="w-10 h-10 bg-white/10 rounded-xl p-2 flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10">
          <img src="/static/img/shk_logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-black tracking-tight text-white uppercase leading-none">
            SHK <span className="text-amber-400 font-medium">CONNECT</span>
          </h1>
          <p className="text-[10px] text-slate-400 mt-0.5 tracking-wider uppercase font-semibold">Workspace</p>
        </div>
        {isMobileOpen && (
          <button onClick={toggleMobileMenu} className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Layer */}
      <div className="flex-1 px-4 py-6 overflow-y-auto space-y-7">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-3">Navigation</p>
          <nav className="space-y-1">
            {filteredNav.map((item) => {
              const isActive = activePath.startsWith(item.path);
              return (
                <a
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-sm transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/10 border border-blue-500/20'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <item.icon size={18} className={`transition-transform duration-200 ${isActive ? 'scale-105' : 'group-hover:scale-105 text-slate-500 group-hover:text-slate-300'}`} />
                  <span>{item.label}</span>
                  {isActive && <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                </a>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Profile Footer Footer */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-500 to-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-white/10 flex-shrink-0">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate leading-snug">{user?.username}</p>
              <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wider mt-0.5 px-1.5 py-0.5 rounded-md ${
                role === 'Admin' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                role === 'Owner' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                role === 'ED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                'bg-slate-700/50 text-slate-400 border border-slate-700'
              }`}>
                {role}
              </span>
            </div>
          </div>
          <a href="/logout" className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-200" title="Sign Out">
            <LogOut size={16} />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-900 hidden lg:flex flex-col z-10 h-screen sticky top-0 border-r border-slate-800/40">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Slider */}
      <div className={`fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={toggleMobileMenu} />
      <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900 z-50 lg:hidden transform transition-transform duration-300 shadow-2xl flex flex-col ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
