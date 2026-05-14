import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, Search } from 'lucide-react';

export default function ChannelSidebar({ groups, currentGroupId, onMobileClose, onOpenCreateModal }) {
  const [search, setSearch] = useState('');

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <aside className="w-80 border-r bg-white flex flex-col flex-shrink-0 h-full">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-[#1A237E]">Channels</h3>
          <button 
            onClick={onOpenCreateModal} 
            className="w-8 h-8 bg-blue-50 text-[#1A237E] rounded-full flex items-center justify-center hover:bg-[#1A237E] hover:text-white transition-all shadow-sm"
          >
            <Plus size={18} strokeWidth={3} />
          </button>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
          <input 
            type="text" 
            placeholder="Search..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#F4F7FE] rounded-2xl text-sm outline-none font-medium text-gray-600" 
          />
        </div>
      </div>
      
      <nav className="flex-1 overflow-y-auto px-4 space-y-2">
        {filteredGroups.length > 0 ? filteredGroups.map(g => {
          const isActive = parseInt(currentGroupId) === g.id;
          return (
            <NavLink 
              key={g.id}
              to={`/chat/${g.id}`} 
              onClick={onMobileClose}
              className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-[#1A237E] text-white shadow-lg shadow-blue-900/10' : 'hover:bg-gray-50 text-gray-700 font-bold'}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 ${isActive ? 'bg-white/10' : 'bg-[#F4F7FE] text-[#1A237E]'}`}>
                {g.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{g.name}</p>
                <p className={`text-[10px] font-bold ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>{g.member_count} members</p>
              </div>
            </NavLink>
          );
        }) : (
          <p className="text-center text-gray-400 text-xs py-10 font-bold uppercase tracking-widest">No channels</p>
        )}
      </nav>
    </aside>
  );
}
