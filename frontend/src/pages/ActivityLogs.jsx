import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Search, Filter, Terminal, Clock, User, Globe, Info } from 'lucide-react';

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('/api/activity_logs').then(res => {
      setLogs(res.data);
      setLoading(false);
    }).catch(() => { setError('Unable to load this page. Check your access and try again.'); setLoading(false); });
  }, []);

  const filteredLogs = logs.filter(l =>
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.username?.toLowerCase().includes(search.toLowerCase()) ||
    l.details?.toLowerCase().includes(search.toLowerCase())
  );

  if (error) return <div role="alert" className="p-8 text-red-600">{error}</div>;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 bg-slate-50 h-full min-h-0 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Terminal className="text-slate-700" /> Security & Audit Logs
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Real-time surveillance of user actions and system events.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center gap-4 bg-slate-50/30">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Filter logs by action or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-slate-900/30 focus:ring-4 focus:ring-slate-900/5 transition-all shadow-sm"
            />
          </div>
          <button disabled title="Advanced filters are not available yet" className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm">
            <Filter size={20} />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredLogs.map((l) => (
            <div key={l.id} className="p-5 hover:bg-slate-50/50 transition-colors group flex items-start gap-6">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300 border border-slate-200">
                <Clock size={18} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{l.action}</p>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{l.timestamp}</span>
                </div>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">{l.details}</p>

                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-slate-300" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User: <span className="text-slate-600">@{l.username}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe size={12} className="text-slate-300" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origin: <span className="text-slate-600">{l.ip_address}</span></span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 pt-1">
                <button className="p-2 text-slate-300 hover:text-slate-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm">
                  <Info size={16} />
                </button>
              </div>
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center px-6">
              <Terminal size={48} className="text-slate-100 mb-4" />
              <p className="text-sm font-black text-slate-300 uppercase tracking-[0.2em]">No logs synchronized</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;
