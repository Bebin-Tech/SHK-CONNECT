import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, Shield, X, Save, Search, Users, Crown, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role_id: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/roles')
      ]);
      setUsers(await uRes.json());
      setRoles(await rRes.json());
      setLoading(false);
    } catch (err) { console.error(err); }
  };

  const handleToggle = async (userId) => {
    const res = await fetch(`/api/admin/users/${userId}/toggle`, { method: 'POST' });
    const data = await res.json();
    if (data.success) setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: data.is_active } : u));
  };

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const res = await fetch(`/api/admin/users/${userId}/delete`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) setUsers(prev => prev.filter(u => u.id !== userId));
    else alert(data.error);
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
    } else alert(data.error);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setFormData({ username: u.username, email: u.email, password: '', role_id: u.role_id || '' });
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ username: '', email: '', password: '', role_id: '' });
    setModalOpen(true);
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const adminCount = users.filter(u => u.role === 'Admin').length;
  const activeCount = users.filter(u => u.is_active).length;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#1A237E] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-10 space-y-6 pb-24 lg:pb-10 font-['Outfit']">
      <header>
        <h2 className="text-2xl lg:text-3xl font-bold text-[#1A237E]">User Directory</h2>
        <p className="text-gray-500 text-sm mt-1">Manage user accounts, roles and passwords</p>
      </header>

      {/* Create Button */}
      <button onClick={openCreate} className="w-full flex items-center justify-center gap-3 bg-orange-500 text-white py-4 px-6 rounded-2xl font-bold text-base shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition active:scale-95">
        <UserPlus size={22} />
        Create User
      </button>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'TOTAL USERS', value: users.length, color: 'text-blue-600' },
          { label: 'ADMINS', value: adminCount, color: 'text-blue-600' },
          { label: 'ACTIVE', value: activeCount, color: 'text-green-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-4 rounded-3xl shadow-sm text-center border border-gray-50">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Users List */}
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="font-bold text-[#1A237E] text-base mb-3">All Users</h3>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search user..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-2xl outline-none text-sm font-medium text-gray-600 border border-gray-100"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {filteredUsers.map(u => (
            <div key={u.id} className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0">
                  {u.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm truncate">{u.username}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-black px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md uppercase tracking-tighter">{u.role}</span>
                    <span className={`text-[10px] font-black ${u.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                      {u.is_active ? '● Active' : '○ Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => openEdit(u)}
                  className="flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-2xl font-bold text-xs hover:bg-blue-100 transition"
                >
                  <Edit2 size={15} /> Edit
                </button>
                {u.id === currentUser?.id ? (
                  <div className="flex items-center justify-center gap-2 py-3 bg-gray-50 text-gray-400 rounded-2xl font-bold text-xs">
                    <Shield size={15} /> Current User
                  </div>
                ) : (
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="flex items-center justify-center gap-2 py-3 bg-red-50 text-red-500 rounded-2xl font-bold text-xs hover:bg-red-100 transition"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-[40px] sm:rounded-[40px] shadow-2xl w-full sm:max-w-md p-8 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-[#1A237E]">{editingUser ? 'Edit User' : 'New User'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-3 bg-gray-50 rounded-2xl text-gray-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Username</label>
                <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]"
                  placeholder="e.g. john_doe" required />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]"
                  placeholder="john@shk.com" required />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Role</label>
                <select value={formData.role_id} onChange={e => setFormData({...formData, role_id: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]" required>
                  <option value="">Select Role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">{editingUser ? 'New Password (optional)' : 'Password'}</label>
                <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]"
                  placeholder="••••••••" required={!editingUser} />
              </div>
              <button type="submit" className="w-full bg-[#1A237E] text-white p-5 rounded-2xl font-black uppercase tracking-wider shadow-lg shadow-blue-900/20 hover:bg-[#0D145A] transition flex items-center justify-center gap-3">
                <Save size={20} /> {editingUser ? 'UPDATE' : 'CREATE ACCOUNT'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
