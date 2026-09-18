import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, Calendar, MessageSquare, Download, FileText, Shield, Archive, Search } from 'lucide-react';
import Message from '../components/Message';

const HistoryDetail = () => {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setMessages([]);
    setSearch('');
    const fetchData = async () => {
      try {
        // We'll use the existing load_history endpoint for archived groups too
        const [groupRes, historyRes] = await Promise.all([
          axios.get('/admin/history_groups'), // We need a specific get group by ID api or just filter
          axios.get(`/chat/load_history/${groupId}?offset=0`)
        ]);

        // Find the group from the list (or we could add a dedicated API)
        const currentGroup = groupRes.data.find(g => g.id === parseInt(groupId)) || { name: 'Archived Channel' };
        if (!active) return;
        setGroup(currentGroup);
        const allMessages = [...historyRes.data];
        while (allMessages.length && allMessages.length % 50 === 0) {
          const page = await axios.get(`/chat/load_history/${groupId}?offset=${allMessages.length}`);
          if (!active) return;
          if (!page.data.length) break;
          allMessages.push(...page.data);
        }
        if (active) setMessages(allMessages.reverse());
      } catch (err) {
        if (active) setError('Unable to load this transcript. Check your access and try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [groupId]);

  const filteredMessages = messages.filter(m =>
    m.content?.toLowerCase().includes(search.toLowerCase()) ||
    m.username?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  if (error) return <div role="alert" className="p-8 text-red-700">{error} <Link to="/history">Back to history</Link></div>;

  return (
    <div className="history-transcript flex flex-col h-full bg-white font-outfit">
      {/* Header */}
      <header className="h-20 border-b border-slate-100 flex items-center justify-between px-6 lg:px-10 bg-white sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-6 min-w-0">
          <Link to="/history" className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all group">
            <ChevronLeft size={20} strokeWidth={3} className="group-hover:-translate-x-0.5 transition-transform" />
          </Link>
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-lg border-2 border-white shadow-md">
              {group?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-slate-900 truncate leading-none">{group?.name}</h3>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded-md border border-slate-200 uppercase tracking-tighter">Read Only</span>
              </div>
              <p className="text-xs text-slate-400 font-bold truncate mt-1">Archived session transcript</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => window.print()} className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-black transition shadow-lg uppercase tracking-widest active:scale-95">
            <Download size={16} /> Print / Save PDF
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-6 lg:px-10 py-4 bg-slate-50 border-b border-slate-100 shrink-0">
        <div className="max-w-xl relative group">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rose-500 transition-colors" />
          <input
            type="text"
            placeholder="Search transcript..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-rose-500/30 focus:ring-4 focus:ring-rose-500/5 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Transcript Stream */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-10 space-y-10 custom-scrollbar bg-slate-50/20">
        <div className="max-w-4xl mx-auto flex flex-col items-center mb-16">
          <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 border border-slate-100 rotate-6">
            <Archive size={32} className="text-rose-600 -rotate-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight text-center">Session Transcript</h2>
          <p className="text-slate-400 text-sm font-medium mt-2 text-center max-w-sm">
            This channel was archived for record-keeping. All messages and attachments are preserved in their original state.
          </p>
          <div className="h-10 w-px bg-slate-200 my-8" />
        </div>

        <div className="max-w-4xl mx-auto space-y-8 pb-20">
          {filteredMessages.map((msg) => (
            <Message
              key={msg.id}
              message={msg}
              isMe={false} // Disable "isMe" styling for archived views to keep it neutral
            />
          ))}

          {filteredMessages.length === 0 && (
            <div className="text-center py-20">
              <p className="text-sm font-bold text-slate-300 uppercase tracking-[0.2em]">End of Transcript</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <footer className="p-4 bg-white border-t border-slate-100 text-center shrink-0">
        <div className="flex items-center justify-center gap-2">
          <Shield size={14} className="text-emerald-500" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Verified Secure Artifact</p>
        </div>
      </footer>
    </div>
  );
};

export default HistoryDetail;
