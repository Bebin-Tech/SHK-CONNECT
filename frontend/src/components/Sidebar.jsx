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
    <div className="flex flex-col h-full">
      {/* Logo & Brand */}
      <div className="px-6 pt-8 pb-6 flex items-center gap-3">
        <div className="w-12 h-12 flex-shrink-0">
          <img src="/static/img/shk_logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="text-[14px] font-black text-shk-navy uppercase tracking-tighter leading-tight">
            SHK <br /><span className="text-shk-gold">CONNECT</span>
          </h1>
        </div>
        {isMobileOpen && (
          <button onClick={toggleMobileMenu} className="lg:hidden ml-auto p-2 text-slate-400">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Role Badge */}
      <div className="px-8 pb-4 flex justify-center">
        <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
          role === 'Admin' ? 'bg-blue-50 text-blue-600' :
          role === 'Owner' ? 'bg-purple-50 text-purple-600' :
          role === 'ED' ? 'bg-rose-50 text-rose-600' :
          role === 'Manager' ? 'bg-amber-50 text-amber-600' :
          role === 'Accounts' ? 'bg-indigo-50 text-indigo-600' :
          role === 'Staff' ? 'bg-emerald-50 text-emerald-600' :
          'bg-slate-100 text-slate-500'
        }`}>
          {role === 'Admin' ? '🛡 Admin' :
           role === 'Owner' ? '👑 Owner' :
           role === 'ED' ? '👔 ED' :
           role === 'Manager' ? '💼 Manager' :
           role === 'Accounts' ? '🧾 Accounts' :
           role === 'Staff' ? '🛠 Staff' : '👤 Member'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="px-6 flex-1 space-y-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Navigation</p>
        {filteredNav.map((item) => (
          <a
            key={item.path}
            href={item.path}
            className={`flex items-center gap-3 p-4 rounded-2xl transition font-semibold text-sm ${
              activePath.startsWith(item.path) ? 'bg-shk-blue text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 hover:text-shk-blue'
            }`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      {/* Profile & Logout */}
      <div className="p-6 border-t border-slate-100">
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-shk-blue text-white rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-shk-navy truncate">{user?.username}</p>
              <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest font-bold">{role}</p>
            </div>
          </div>
          <a href="/logout" className="p-2 text-slate-400 hover:text-shk-red hover:bg-rose-50 rounded-lg transition-all">
            <LogOut size={16} />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-100 hidden lg:flex flex-col z-10 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <div className={`fixed inset-0 bg-slate-900/40 z-40 lg:hidden transition-opacity duration-300 ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={toggleMobileMenu} />
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden transform transition-transform duration-300 flex flex-col ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
