import React, { useState } from 'react';
import { Plus, Search, Hash } from 'lucide-react';

const ChannelSidebar = ({ groups, currentGroup, onSelectGroup, user, onCreateChannel }) => {
  const [search, setSearch] = useState('');
  const canCreate = ['Admin', 'Owner', 'ED'].includes(user?.role);

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="w-64 border-r bg-white flex flex-col flex-shrink-0 h-full">
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-shk-navy">Channels</h3>
          {canCreate && (
            <button
              onClick={onCreateChannel}
              className="p-1.5 bg-slate-50 text-shk-blue rounded-lg hover:bg-slate-100 transition"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-300" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-slate-50 rounded-xl text-xs outline-none border border-transparent focus:border-slate-200"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredGroups.map(group => (
          <button
            key={group.id}
            onClick={() => onSelectGroup(group)}
            className={`w-full flex items-center gap-2 p-3 rounded-xl transition text-left ${
              currentGroup?.id === group.id ? 'bg-shk-blue text-white shadow-sm' : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            {group.avatar_url ? (
              <img src={group.avatar_url} alt={group.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                currentGroup?.id === group.id ? 'bg-white/20' : 'bg-slate-100 text-shk-blue'
              }`}>
                {group.name[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{group.name}</p>
              <p className={`text-[10px] ${currentGroup?.id === group.id ? 'text-white/70' : 'text-slate-400'}`}>
                {group.member_count} members
              </p>
            </div>
          </button>
        ))}
        {filteredGroups.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-6">No channels found</p>
        )}
      </nav>

      <div className="p-3 border-t bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center font-bold text-sm">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">{user?.username}</p>
            <p className="text-[10px] text-gray-400">{user?.role || 'Member'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ChannelSidebar;
