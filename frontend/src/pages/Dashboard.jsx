import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Hash, TrendingUp, TrendingDown, LayoutDashboard, Plus, ArrowUpRight, Clock } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/admin/stats').then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch(() => { setError('Unable to load this page. Check your access and try again.'); setLoading(false); });
  }, []);

  if (error) return <div role="alert" className="p-8 text-red-600">{error}</div>;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  const statCards = [
    { label: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Channels', value: stats.groups, icon: Hash, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Monthly Credit', value: `₹${stats.monthly_credit}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Monthly Debit', value: `₹${stats.monthly_debit}`, icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="p-6 lg:p-10 bg-slate-50 h-full min-h-0 overflow-y-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutDashboard className="text-blue-600" /> Admin Command Center
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Monitor workspace performance and financial summaries.</p>
        </div>
        <button onClick={() => { window.location.href = '/chat'; }} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 active:scale-95">
          <Plus size={18} /> New Channel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex items-start justify-between mb-4">
              <div className={`${card.bg} ${card.color} p-3 rounded-2xl`}>
                <card.icon size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 group-hover:text-blue-500 transition-colors">
                Live <Clock size={10} className="animate-pulse" />
              </span>
            </div>
            <p className="text-3xl font-black text-slate-900 tracking-tighter mb-1">{card.value}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Active Channels</h3>
            <button onClick={() => { window.location.href = '/chat'; }} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.active_channels?.map((ch) => (
              <div key={ch.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-blue-600">
                    {ch.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{ch.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{ch.invite_code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100">ACTIVE</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="text-lg font-black tracking-tight mb-2">SHK Connect Pro</h3>
            <p className="text-slate-400 text-sm font-medium mb-6">Manage roles, set channel permissions, and audit logs from one dashboard.</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <p className="text-xs font-bold tracking-wide">Workspace overview</p>
              </div>
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                <p className="text-xs font-bold tracking-wide">Manage your team</p>
              </div>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-all duration-500" />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
