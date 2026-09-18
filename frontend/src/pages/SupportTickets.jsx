import RecordForm from '../components/RecordForm';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LifeBuoy, Plus, Search, Filter, AlertCircle, CheckCircle2, Clock, MoreHorizontal, MessageSquare, ChevronRight } from 'lucide-react';

const SupportTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('/admin/tickets').then(res => {
      setTickets(res.data);
      setLoading(false);
    }).catch(() => { setError('Unable to load this page. Check your access and try again.'); setLoading(false); });
  }, []);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'open': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'in_progress': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'closed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'high': return 'text-rose-500';
      case 'medium': return 'text-amber-500';
      case 'low': return 'text-emerald-500';
      default: return 'text-slate-400';
    }
  };

  const filteredTickets = tickets.filter(t =>
    t.priority.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.username.toLowerCase().includes(search.toLowerCase())
  );

  if (error) return <div role="alert" className="p-8 text-red-600">{error}</div>;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 bg-slate-50 h-full min-h-0 overflow-y-auto">
      {creating && <RecordForm title="New Ticket" fields={[{name:'subject',label:'Subject'},{name:'description',label:'Description'},{name:'priority',label:'Priority',options:['medium','low','high']}]} onClose={() => setCreating(false)} onSubmit={async data => { await axios.post('/admin/tickets', data); const res = await axios.get('/admin/tickets'); setTickets(res.data); }} />}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <LifeBuoy className="text-indigo-600" /> Support Desk
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Track and resolve user requests and platform issues.</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-lg active:scale-95">
          <Plus size={18} /> New Ticket
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Ticket List */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="Search by subject or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
              />
            </div>
            <button disabled title="Advanced filters are not available yet" className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm">
              <Filter size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredTickets.map((t) => (
              <div key={t.id} className="bg-white p-5 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all duration-300 group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(t.status)}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${getPriorityStyle(t.priority)}`}>
                        {t.priority} Priority
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{t.subject}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1 line-clamp-1 italic">"{t.description}"</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-slate-900">@{t.username}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{t.created_at}</p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">{t.username[0]}</div>
                      <div className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white uppercase">A</div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Support request</span>
                  </div>
                  <button disabled={t.status === 'closed'} onClick={async () => { try { await axios.post(`/admin/tickets/${t.id}/resolve`); setTickets(prev => prev.map(item => item.id === t.id ? {...item,status:'closed'} : item)); } catch { alert('Unable to resolve ticket'); } }} className="flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:translate-x-1 transition-transform">
                    {t.status === 'closed' ? 'Resolved' : 'Resolve'} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}

            {filteredTickets.length === 0 && (
              <div className="py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center px-6">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare size={40} className="text-slate-200" />
                </div>
                <h3 className="text-lg font-black text-slate-800">Inbox Clean</h3>
                <p className="text-sm text-slate-400 font-medium max-w-xs mt-2">No active support requests matching your search.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Stats */}
        <div className="w-full lg:w-80 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Efficiency Pulse</h4>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Avg. Response Time</span>
                  <span className="text-xs font-black text-indigo-600">Not measured</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full w-[85%]" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Resolution Rate</span>
                  <span className="text-xs font-black text-emerald-600">{tickets.length ? Math.round(tickets.filter(t => t.status === 'closed').length / tickets.length * 100) : 0}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-[98%]" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-900/20 relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                <AlertCircle size={20} className="text-white" />
              </div>
              <h4 className="text-lg font-black tracking-tight mb-2">High Priority Alerts</h4>
              <p className="text-indigo-300 text-sm font-medium mb-4">There are currently {tickets.filter(t => t.priority === 'high' && t.status !== 'closed').length} open high-priority tickets.</p>
              <button onClick={() => setSearch('high')} className="w-full py-3 bg-white text-indigo-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-colors">
                Audit Critical
              </button>
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportTickets;
