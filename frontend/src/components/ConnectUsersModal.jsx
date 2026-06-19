import React, { useState, useEffect } from 'react';
import { X, Check, Users, Search, UserCheck } from 'lucide-react';
import axios from 'axios';

const ConnectUsersModal = ({ isOpen, onClose, groupId, currentMembers }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      axios.get('/api/users').then(res => setAllUsers(res.data));
      setSelectedIds(currentMembers?.map(m => m.id) || []);
    }
  }, [isOpen, currentMembers]);

  if (!isOpen) return null;

  const toggleUser = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      selectedIds.forEach(id => fd.append('user_ids', id));
      await axios.post(`/chat/connect_users/${groupId}`, fd);
      onClose();
    } catch (err) {
      alert('Failed to connect users');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = allUsers.filter(u =>
    (u.first_name || u.username).toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 p-8 text-white shrink-0">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/20 transition-all">
            <X size={20} />
          </button>
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/40 mb-4 ring-4 ring-indigo-600/20">
            <UserCheck size={28} className="text-white" />
          </div>
          <h3 className="text-2xl font-black tracking-tight">Channel Permissions</h3>
          <p className="text-slate-400 text-sm font-medium mt-1">Select users who should have access to this secure channel.</p>
        </div>

        <div className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
          {filteredUsers.map(u => {
            const isSelected = selectedIds.includes(u.id);
            return (
              <label
                key={u.id}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 cursor-pointer group ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                    : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUser(u.id)}
                      className="hidden"
                    />
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
                      isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200 group-hover:border-slate-400'
                    }`}>
                      {isSelected && <Check size={14} strokeWidth={4} className="text-white" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                      isSelected ? 'bg-white text-indigo-600 ring-2 ring-indigo-100' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {(u.first_name?.[0] || u.username?.[0]).toUpperCase()}
                    </div>
                    <div>
                      <span className={`text-sm font-black transition-colors ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {u.first_name || u.username}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                          isSelected ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          {u.role}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">@{u.username}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-6">
            <div className="text-left">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Selected</p>
              <p className="text-sm font-black text-indigo-600">{selectedIds.length} Users</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all active:scale-95 shadow-sm">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/25 active:scale-95 flex items-center gap-2"
              >
                {isSubmitting ? 'Syncing Access...' : 'Sync Access'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectUsersModal;
