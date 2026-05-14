import React, { useState, useEffect } from 'react';
import { Users, Hash, CheckCircle, Clock, TrendingUp, AlertCircle } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mocking stats for now based on previous admin_routes logic
    // In a real app, you'd fetch from /api/admin/stats
    setTimeout(() => {
      setStats({
        users: 12,
        groups: 5,
        active_tickets: 3,
        system_uptime: '99.9%',
        recent_activity: 154
      });
      setLoading(false);
    }, 500);
  }, []);

  if (loading) return <div className="p-10 text-gray-400 font-bold">Loading Stats...</div>;

  const cards = [
    { label: 'Total Users', value: stats.users, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Channels', value: stats.groups, icon: Hash, color: 'bg-purple-50 text-purple-600' },
    { label: 'Support Tickets', value: stats.active_tickets, icon: AlertCircle, color: 'bg-rose-50 text-rose-600' },
    { label: 'System Uptime', value: stats.system_uptime, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="p-8 lg:p-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h2 className="text-3xl font-black text-[#1A237E] tracking-tighter uppercase mb-2">Admin Dashboard</h2>
        <p className="text-gray-400 font-bold">Enterprise Analytics & System Overview</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((c, i) => (
          <div key={i} className="bg-white p-8 rounded-[32px] shadow-[0_10px_40px_rgba(0,0,0,0.02)] border border-gray-50 group hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-500">
            <div className={`w-14 h-14 ${c.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
              <c.icon size={28} />
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">{c.label}</p>
            <p className="text-4xl font-black text-[#1A237E]">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-lg font-black text-[#1A237E] uppercase">System Health</h3>
             <TrendingUp size={20} className="text-emerald-500" />
          </div>
          <div className="space-y-6">
             {[
               { name: 'API Server', status: 'Healthy', val: 95 },
               { name: 'Database', status: 'Optimal', val: 100 },
               { name: 'Socket.io Cluster', status: 'Busy', val: 78 }
             ].map((s, i) => (
               <div key={i}>
                 <div className="flex justify-between text-xs font-bold mb-2">
                   <span className="text-gray-600 uppercase tracking-widest">{s.name}</span>
                   <span className={s.val > 90 ? 'text-emerald-500' : 'text-amber-500'}>{s.status}</span>
                 </div>
                 <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                    <div className={`h-full ${s.val > 90 ? 'bg-emerald-500' : 'bg-amber-500'} transition-all duration-1000`} style={{ width: `${s.val}%` }}></div>
                 </div>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-50">
           <h3 className="text-lg font-black text-[#1A237E] uppercase mb-8">Quick Actions</h3>
           <div className="grid grid-cols-2 gap-4">
              <button className="p-6 bg-gray-50 rounded-3xl hover:bg-[#1A237E] hover:text-white transition-all group">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-blue-200">Broadcast</p>
                <p className="text-sm font-bold">System Alert</p>
              </button>
              <button className="p-6 bg-gray-50 rounded-3xl hover:bg-[#1A237E] hover:text-white transition-all group">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-blue-200">Maintenance</p>
                <p className="text-sm font-bold">Flush Cache</p>
              </button>
              <button className="p-6 bg-gray-50 rounded-3xl hover:bg-[#1A237E] hover:text-white transition-all group">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-blue-200">Reports</p>
                <p className="text-sm font-bold">Download PDF</p>
              </button>
              <button className="p-6 bg-gray-50 rounded-3xl hover:bg-rose-500 hover:text-white transition-all group">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-rose-200">Security</p>
                <p className="text-sm font-bold">Audit Lock</p>
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
