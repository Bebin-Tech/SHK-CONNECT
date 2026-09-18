import React, { useState } from 'react';
import { Plus, Search, Hash, ChevronRight } from 'lucide-react';

const ChannelSidebar = ({ groups, currentGroup, onSelectGroup, user, onCreateChannel }) => {
  const [search, setSearch] = useState('');
  const canCreate = ['Admin', 'Owner', 'ED'].includes(user?.role);

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="w-72 border-r border-slate-200/60 bg-white flex flex-col flex-shrink-0 h-full shadow-[1px_0_0_0_rgba(0,0,0,0.02)]">
      {/* Search & Action Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">Channels</h3>
          {canCreate && (
            <button
              onClick={onCreateChannel}
              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all duration-200 shadow-sm shadow-blue-600/10"
              title="Create Channel"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="relative group">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search workspace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all"
          />
        </div>
      </div>

      {/* Channel List Container */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
        {filteredGroups.map(group => {
          const isActive = currentGroup?.id === group.id;
          return (
            <button
              key={group.id}
              onClick={() => onSelectGroup(group)}
              className={`w-full group flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 relative ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <div className="relative flex-shrink-0">
                {group.avatar_url ? (
                  <img src={group.avatar_url} alt={group.name} className="w-10 h-10 rounded-xl object-cover shadow-sm ring-2 ring-white" />
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-white border border-slate-100 text-blue-600 group-hover:bg-blue-50'
                  }`}>
                    {group.name[0].toUpperCase()}
                  </div>
                )}
                {isActive && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate leading-tight transition-colors ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>
                  {group.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-blue-400' : 'bg-slate-300'}`} />
                  <p className={`text-[10px] font-semibold tracking-wide uppercase transition-colors ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>
                    {group.member_count} Members
                  </p>
                </div>
              </div>

              <ChevronRight size={14} className={`transition-all ${isActive ? 'text-blue-400 translate-x-0' : 'text-slate-200 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
            </button>
          );
        })}
        {filteredGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
              <Hash size={20} className="text-slate-300" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No results</p>
          </div>
        )}
      </nav>

      {/* Footer Branding Overlay */}
      <div className="p-5 border-t border-slate-100 bg-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Workspace</p>
            <p className="text-[9px] font-bold text-blue-600/60 truncate">Connected workspace</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ChannelSidebar;
