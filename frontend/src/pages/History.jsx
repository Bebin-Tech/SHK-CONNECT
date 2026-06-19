import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Archive, Search, Calendar, MessageSquare, ChevronRight, FileText, Download } from 'lucide-react';

const History = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('/admin/history_groups').then(res => {
      setGroups(res.data);
      setLoading(false);
    });
  }, []);

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 bg-slate-50 min-h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Archive className="text-rose-600" /> Archived History
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Review finalized discussions and previous project artifacts.</p>
      </div>

      <div className="mb-6 relative max-w-md">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          type="text"
          placeholder="Filter archived channels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-rose-500/30 focus:ring-4 focus:ring-rose-500/5 shadow-sm transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGroups.map((g) => (
          <div key={g.id} className="bg-white rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center font-bold text-lg group-hover:bg-rose-600 group-hover:text-white transition-colors shadow-sm">
                  {g.name[0].toUpperCase()}
                </div>
                <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-black rounded-full border border-slate-200">ARCHIVED</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1 group-hover:text-rose-600 transition-colors">{g.name}</h3>
              <p className="text-xs text-slate-400 font-medium line-clamp-2 min-h-[32px]">{g.description || 'No description provided for this archived channel.'}</p>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-slate-500">
                  <Calendar size={14} className="text-slate-300" />
                  <span className="text-xs font-bold tracking-tight">Archived on {g.created_at}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <MessageSquare size={14} className="text-slate-300" />
                  <span className="text-xs font-bold tracking-tight">{g.message_count} total messages</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-600 transition-colors">
                <FileText size={14} /> Download Log
              </button>
              <button className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:translate-x-1 transition-transform">
                Read Detailed <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Archive size={40} className="text-slate-200" />
            </div>
            <h3 className="text-lg font-black text-slate-800">No Archives Found</h3>
            <p className="text-sm text-slate-400 font-medium max-w-xs mt-2">Could not find any archived channels matching your current filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
