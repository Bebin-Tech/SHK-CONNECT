import React, { useState, useEffect } from 'react';
import { Clock, Search, Filter, ShieldCheck, User, Globe } from 'lucide-react';

export default function HistoryLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/history_logs')
      .then(res => res.json())
      .then(data => {
        setLogs(data);
        setLoading(false);
      });
  }, []);

  const filteredLogs = logs.filter(l => 
    l.username.toLowerCase().includes(search.toLowerCase()) || 
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.details?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="p-10 text-gray-400 font-bold">Loading Audit Logs...</div>;

  return (
    <div className="p-8 lg:p-12 space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-[#1A237E] tracking-tighter uppercase mb-2">Audit History</h2>
          <p className="text-gray-400 font-bold">Comprehensive activity and security tracking</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search logs..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-100 text-sm font-bold text-[#1A237E]" 
              />
           </div>
           <button className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm text-gray-400 hover:text-[#1A237E] transition-all"><Filter size={20}/></button>
        </div>
      </header>

      <div className="space-y-4">
        {filteredLogs.map(l => (
          <div key={l.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 flex items-center gap-6 group hover:shadow-md transition-all">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <ShieldCheck size={24} />
             </div>
             <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                   <span className="text-sm font-black text-[#1A237E] uppercase">{l.action}</span>
                   <span className="text-[10px] font-black text-gray-300 uppercase px-2 py-0.5 bg-gray-50 rounded-md">ID #{l.id}</span>
                </div>
                <p className="text-xs font-bold text-gray-500 truncate">{l.details || 'No additional details provided.'}</p>
             </div>
             <div className="flex items-center gap-8 flex-shrink-0 text-right">
                <div className="hidden sm:block">
                   <div className="flex items-center gap-2 justify-end text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">
                      <User size={12} /> {l.username}
                   </div>
                   <div className="flex items-center gap-2 justify-end text-[10px] font-black text-gray-300 uppercase tracking-tighter">
                      <Globe size={12} /> {l.ip}
                   </div>
                </div>
                <div className="flex flex-col items-end">
                   <div className="flex items-center gap-1.5 text-xs font-black text-[#1A237E]">
                      <Clock size={14} className="text-blue-500" />
                      {l.timestamp.split(' ')[1]}
                   </div>
                   <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                      {l.timestamp.split(' ')[0]}
                   </div>
                </div>
             </div>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="p-20 text-center text-gray-400 font-bold">No activity logs found.</div>
        )}
      </div>
    </div>
  );
}
