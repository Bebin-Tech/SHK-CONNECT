import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import axios from 'axios';

const ConnectUsersModal = ({ isOpen, onClose, groupId, currentMembers }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      axios.get('/api/users').then(res => setAllUsers(res.data));
      // In a real app, you'd fetch current members for this group specifically
      // or pass them in. For now, we'll assume currentMembers is an array of IDs or objects
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[#1A237E]">Connect Users</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-4 font-semibold uppercase tracking-wider">Select users allowed to access this channel</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-2">
            {allUsers.map(u => (
              <label key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="w-4 h-4 rounded text-[#1A237E] focus:ring-[#1A237E]"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-700">{u.first_name || u.username}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{u.role}</span>
                      <span className="text-[10px] text-gray-300">@{u.username}</span>
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xs text-shk-blue">
                  {(u.first_name?.[0] || u.username?.[0]).toUpperCase()}
                </div>
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#1A237E] text-white rounded-xl font-bold hover:bg-[#3949AB] transition shadow-lg mt-4 flex items-center justify-center gap-2 uppercase"
          >
            <Check size={16} /> {isSubmitting ? 'Saving...' : 'Done'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ConnectUsersModal;
