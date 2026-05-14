import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, Search } from 'lucide-react';

export default function ChannelSidebar({ groups, currentGroupId, onMobileClose, onOpenCreateModal }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <aside id="channel-sidebar" className="fixed top-16 bottom-20 left-0 z-40 w-[82vw] max-w-72 border-r bg-gray-50 flex flex-col flex-shrink-0 lg:static lg:inset-auto lg:w-64 lg:max-w-none transition-transform duration-300 transform lg:translate-x-0">
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#1A237E]">Channels</h3>
          <button onClick={onOpenCreateModal} className="p-1.5 bg-blue-50 text-[#1A237E] rounded-lg hover:bg-blue-100 transition shadow-sm" title="Create Channel">
            <Plus size={16} />
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-gray-100 rounded-xl text-xs outline-none" 
          />
        </div>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredGroups.length > 0 ? filteredGroups.map(g => {
          const isActive = parseInt(currentGroupId) === g.id;
          return (
            <NavLink 
              key={g.id}
              to={`/chat/${g.id}`} 
              onClick={onMobileClose}
              className={`flex items-center gap-2 p-3 rounded-xl transition ${isActive ? 'bg-[#1A237E] text-white' : 'hover:bg-white text-gray-700'}`}
            >
              {g.avatar_url ? (
                <img src={g.avatar_url} alt={g.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${isActive ? 'bg-white/20' : 'bg-blue-100 text-[#1A237E]'}`}>
                  {g.name[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{g.name}</p>
                <p className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>{g.member_count} members</p>
              </div>
            </NavLink>
          );
        }) : (
          <p className="text-center text-gray-400 text-sm py-6">No channels yet</p>
        )}
      </nav>
      
      <div className="p-3 border-t bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center font-bold text-sm">
            {user?.username ? user.username[0].toUpperCase() : 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">{user?.username}</p>
            <p className="text-[10px] text-gray-400">{user?.role || 'Member'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
