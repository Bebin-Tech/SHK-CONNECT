import React, { useState, useEffect } from 'react';
import { Users, Layers, TrendingUp, TrendingDown, Link, Archive, Trash2, Plus, X } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [copied, setCopied] = useState(null);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    setStats(data);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/groups/create_api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (data.success) {
      setShowCreate(false);
      setForm({ name: '', description: '' });
      fetchStats();
    }
  };

  const handleArchive = async (id) => {
    await fetch(`/api/admin/groups/${id}/archive_api`, { method: 'POST' });
    fetchStats();
  };

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this channel?')) return;
    await fetch(`/api/admin/groups/${id}/delete_api`, { method: 'DELETE' });
    fetchStats();
  };

  const copyLink = (code) => {
    navigator.clipboard.writeText(`${window.location.origin}/auth/invite/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#1A237E] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const statCards = [
    { label: 'System Users', value: stats.users, color: 'border-blue-500', textColor: 'text-gray-800', icon: <Users size={22} className="text-blue-500" /> },
    { label: 'Active Channels', value: stats.groups, color: 'border-purple-500', textColor: 'text-gray-800', icon: <Layers size={22} className="text-purple-500" /> },
    { label: 'Monthly Credit', value: `₹${stats.monthly_credit}`, color: 'border-green-500', textColor: 'text-green-600', icon: <TrendingUp size={22} className="text-green-500" /> },
    { label: 'Monthly Debit', value: `₹${stats.monthly_debit}`, color: 'border-red-500', textColor: 'text-red-600', icon: <TrendingDown size={22} className="text-red-500" /> },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5 lg:p-10 space-y-8 pb-24 lg:pb-10 font-['Outfit']">
      <header>
        <h2 className="text-2xl lg:text-3xl font-bold text-[#1A237E]">Admin Command Center</h2>
        <p className="text-gray-500 text-sm mt-1">Global system management and oversight</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {statCards.map((c, i) => (
          <div key={i} className={`bg-white p-5 rounded-3xl shadow-sm border-t-4 ${c.color}`}>
            <h4 className="text-gray-500 text-xs font-semibold mb-3">{c.label}</h4>
            <div className="flex items-center justify-between">
              <span className={`text-3xl font-bold ${c.textColor}`}>{c.value}</span>
              {c.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Active Channels */}
      <div className="bg-white rounded-3xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1A237E]">Active Channels</h3>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#1A237E] text-white text-xs font-black px-4 py-2.5 rounded-xl hover:bg-[#0D145A] transition"
          >
            <Plus size={16} /> New
          </button>
        </div>

        <div className="space-y-3">
          {stats.active_channels.length === 0 && (
            <p className="text-sm text-gray-400 font-bold text-center py-6">No active channels yet.</p>
          )}
          {stats.active_channels.map(g => (
            <div key={g.id} className="flex flex-col gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-100 transition">
              <div className="min-w-0">
                <p className="font-bold text-[#1A237E] text-sm truncate">{g.name}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">CODE: {g.invite_code}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => copyLink(g.invite_code)}
                  className={`p-2.5 rounded-xl flex items-center justify-center font-bold text-xs transition ${copied === g.invite_code ? 'bg-green-200 text-green-700' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                  title="Copy Invite Link"
                >
                  <Link size={16} />
                </button>
                <button
                  onClick={() => handleArchive(g.id)}
                  className="p-2.5 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition flex items-center justify-center"
                  title="Archive"
                >
                  <Archive size={16} />
                </button>
                <button
                  onClick={() => handleDelete(g.id)}
                  className="p-2.5 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition flex items-center justify-center"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Channel Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-[#1A237E]">Create New Channel</h3>
              <button onClick={() => setShowCreate(false)} className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Channel Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]"
                  placeholder="e.g. Sales Team"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E] h-24 resize-none"
                  placeholder="Group purpose..."
                />
              </div>
              <button type="submit" className="w-full bg-[#1A237E] text-white p-5 rounded-2xl font-black uppercase tracking-wider hover:bg-[#0D145A] transition shadow-lg shadow-blue-900/20">
                INITIALIZE CHANNEL
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
