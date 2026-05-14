import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, Shield, MoreHorizontal, X, Save } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role_id: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/roles')
      ]);
      const [uData, rData] = await Promise.all([uRes.json(), rRes.json()]);
      setUsers(uData);
      setRoles(rData);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (userId) => {
    const res = await fetch(`/api/admin/users/${userId}/toggle`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: data.is_active } : u));
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const res = await fetch(`/api/admin/users/${userId}/delete`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      setUsers(prev => prev.filter(u => u.id !== userId));
    } else {
      alert(data.error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingUser ? `/api/admin/users/${editingUser.id}/edit` : '/api/admin/users/create';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (data.success) {
      setModalOpen(false);
      setEditingUser(null);
      setFormData({ username: '', email: '', password: '', role_id: '' });
      fetchData();
    } else {
      alert(data.error);
    }
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setFormData({ username: u.username, email: u.email, password: '', role_id: u.role_id });
    setModalOpen(true);
  };

  if (loading) return <div className="p-10 text-gray-400 font-bold">Loading User Directory...</div>;

  return (
    <div className="p-8 lg:p-12 space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-[#1A237E] tracking-tighter uppercase mb-2">User Directory</h2>
          <p className="text-gray-400 font-bold">Manage system access and permissions</p>
        </div>
        <button 
          onClick={() => { setEditingUser(null); setFormData({ username: '', email: '', password: '', role_id: '' }); setModalOpen(true); }}
          className="flex items-center gap-3 bg-[#1A237E] text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-blue-900/20 hover:scale-105 transition-transform"
        >
          <UserPlus size={20} />
          <span>CREATE USER</span>
        </button>
      </header>

      <div className="bg-white rounded-[40px] shadow-sm border border-gray-50 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Created</th>
              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50/30 transition-colors">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-[#1A237E]">{u.username}</p>
                      <p className="text-xs font-bold text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                   <span className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                     <Shield size={12} /> {u.role}
                   </span>
                </td>
                <td className="px-8 py-6">
                  <button 
                    onClick={() => handleToggle(u.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${u.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-600' : 'bg-gray-400'}`}></div>
                    {u.is_active ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="px-8 py-6 text-xs font-bold text-gray-400">{u.created_at}</td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(u)} className="p-2 text-gray-400 hover:text-[#1A237E] hover:bg-white transition-all rounded-xl border border-transparent hover:border-gray-100 shadow-sm"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(u.id)} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all rounded-xl"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-blue-900/10 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-xl p-10 lg:p-12 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-2xl font-black text-[#1A237E] uppercase">{editingUser ? 'Edit User' : 'New User'}</h3>
                  <p className="text-gray-400 font-bold text-sm">Configure account credentials</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="p-4 bg-gray-50 text-gray-400 rounded-3xl hover:bg-gray-100 transition-all"><X size={24}/></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Username</label>
                    <input 
                      type="text" 
                      value={formData.username} 
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      className="w-full p-5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]" 
                      placeholder="e.g. john_doe"
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Role</label>
                    <select 
                      value={formData.role_id}
                      onChange={e => setFormData({...formData, role_id: e.target.value})}
                      className="w-full p-5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]"
                      required
                    >
                      <option value="">Select Role</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Email Address</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full p-5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]" 
                    placeholder="john@shkconnect.com"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">{editingUser ? 'New Password (Optional)' : 'Password'}</label>
                  <input 
                    type="password" 
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full p-5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]" 
                    placeholder="••••••••"
                    required={!editingUser} 
                  />
                </div>
                <button type="submit" className="w-full py-6 bg-[#1A237E] text-white rounded-3xl font-black shadow-xl shadow-blue-900/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3">
                  <Save size={20} />
                  <span>{editingUser ? 'UPDATE ACCOUNT' : 'CREATE ACCOUNT'}</span>
                </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
