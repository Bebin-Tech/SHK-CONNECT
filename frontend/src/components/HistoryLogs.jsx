import React, { useState, useEffect } from 'react';
import { Archive, Search, ArrowRight, Trash2, History, MessageSquare, Clock, ArrowLeft, Printer, FileText, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function HistoryLogs() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [search, setSearch] = useState('');

  const isAdmin = user?.role === 'Admin' || user?.role === 'Owner';

  useEffect(() => {
    fetchHistoryGroups();
  }, []);

  const fetchHistoryGroups = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/history_groups');
    const data = await res.json();
    setGroups(data);
    setLoading(false);
  };

  const fetchHistoryDetail = async (groupId) => {
    setLoading(true);
    const res = await fetch(`/api/admin/history_groups/${groupId}`);
    const data = await res.json();
    setSelectedGroup(data);
    setLoading(false);
  };

  const handleDelete = async (groupId) => {
    if (!window.confirm('Permanently delete this history log?')) return;
    const res = await fetch(`/api/admin/groups/${groupId}/delete`);
    if (res.ok) fetchHistoryGroups();
  };

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) || 
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && !selectedGroup) return <div className="p-10 text-gray-400 font-bold">Loading History...</div>;

  if (selectedGroup) {
    return (
      <div className="p-8 lg:p-12 space-y-6 animate-in fade-in duration-500 flex flex-col h-full">
        <header className="flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setSelectedGroup(null)}
              className="p-4 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#1A237E] shadow-sm transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-2xl font-black text-[#1A237E] uppercase tracking-tighter flex items-center gap-3">
                {selectedGroup.name}
                <span className="text-[10px] font-black bg-gray-100 text-gray-400 px-3 py-1 rounded-full tracking-widest">ARCHIVED</span>
              </h2>
              <p className="text-gray-400 font-bold text-sm">Archived Channel Message History</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                {selectedGroup.messages.length} Total Messages
             </span>
             <button onClick={() => window.print()} className="p-4 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#1A237E] shadow-sm transition-all flex items-center gap-2">
                <Printer size={18} />
                <span className="text-xs font-black uppercase">Print</span>
             </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 bg-white rounded-[40px] shadow-sm border border-gray-50 flex flex-col overflow-hidden">
          <div className="p-5 border-b bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-[#1A237E]" />
              <span className="text-xs font-black text-[#1A237E] uppercase tracking-widest">Transcript Log</span>
            </div>
            {isAdmin && (
               <button onClick={() => handleDelete(selectedGroup.id)} className="text-[10px] font-black text-rose-400 hover:text-rose-600 flex items-center gap-2 uppercase tracking-widest">
                  <Trash2 size={14} /> Delete Log
               </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-8 bg-gray-50/20">
            {selectedGroup.messages.map(msg => (
              <div key={msg.id} className="flex items-start gap-6">
                 <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-sm shadow-sm
                    ${msg.role === 'Admin' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                    {msg.username[0].toUpperCase()}
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                       <span className="text-sm font-black text-gray-800 uppercase tracking-tight">{msg.username}</span>
                       <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider
                          ${msg.role === 'Admin' ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-400'}`}>{msg.role}</span>
                       <span className="text-[10px] font-bold text-gray-300">{msg.timestamp}</span>
                    </div>

                    {msg.message_type === 'file' ? (
                       <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center gap-4 max-w-sm">
                          <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center"><FileText size={20}/></div>
                          <div className="min-w-0 flex-1">
                             <p className="text-xs font-black text-gray-800 truncate">{msg.content}</p>
                             <a href={msg.file_url} target="_blank" className="text-[10px] font-black text-blue-500 hover:underline uppercase tracking-widest">View Attachment</a>
                          </div>
                       </div>
                    ) : (
                       <div className="p-5 bg-white border border-gray-50 rounded-[24px] text-sm text-gray-600 shadow-sm leading-relaxed max-w-3xl">
                          {msg.content}
                       </div>
                    )}

                    {msg.replies && msg.replies.length > 0 && (
                      <div className="mt-6 ml-6 border-l-2 border-gray-100 pl-8 space-y-6">
                        {msg.replies.map(rep => (
                          <div key={rep.id} className="flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-[10px]
                               ${rep.role === 'Admin' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                               {rep.username[0].toUpperCase()}
                            </div>
                            <div>
                               <div className="flex items-center gap-3 mb-1">
                                  <span className="text-xs font-black text-gray-700 uppercase tracking-tight">{rep.username}</span>
                                  <span className="text-[9px] font-bold text-gray-300">{rep.timestamp}</span>
                               </div>
                               <div className="p-4 bg-gray-50 rounded-2xl text-xs text-gray-500 max-w-xl border border-gray-100/50">
                                  {rep.content}
                               </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
            ))}
            {selectedGroup.messages.length === 0 && (
              <div className="py-20 text-center opacity-30 flex flex-col items-center">
                 <History size={60} className="mb-4" />
                 <p className="font-black uppercase tracking-widest">No transcript data available</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50 border-t text-center flex items-center justify-center gap-2">
             <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
             <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.4em]">End of Transcript · SHK Connect History</p>
             <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-[#1A237E] tracking-tighter uppercase mb-2">History Module</h2>
          <p className="text-gray-400 font-bold">Archived projects and completed channel history</p>
        </div>
        <div className="relative">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
           <input 
             type="text" 
             placeholder="Search archives..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-100 text-sm font-bold text-[#1A237E] min-w-[300px]" 
           />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredGroups.map(g => (
          <div key={g.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-50 group hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-500 flex flex-col h-full">
            <div className="flex items-center gap-5 mb-6">
              <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-[#1A237E] transition-all duration-500 shadow-sm">
                <Archive size={28} />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-[#1A237E] text-lg truncate uppercase tracking-tight">{g.name}</h3>
                <p className="text-[10px] text-gray-300 font-black uppercase tracking-widest flex items-center gap-2">
                   <Clock size={12} /> Completed {g.created_at}
                </p>
              </div>
            </div>
            
            <p className="text-sm font-bold text-gray-400 mb-8 line-clamp-2 leading-relaxed flex-1">
               {g.description || "Project completed without specific documentation details."}
            </p>
            
            <div className="flex items-center justify-between pt-6 border-t border-gray-50">
              <span className="inline-flex items-center gap-2 bg-blue-50/50 text-[#1A237E] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                <MessageSquare size={12} /> {g.message_count} Messages
              </span>
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <button 
                    onClick={() => handleDelete(g.id)}
                    className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition shadow-sm border border-rose-100" 
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button 
                  onClick={() => fetchHistoryDetail(g.id)}
                  className="flex items-center gap-2 text-[#1A237E] font-black text-xs hover:gap-3 transition-all uppercase tracking-widest"
                >
                  VIEW LOGS <ArrowRight size={16} className="text-blue-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-[48px] border-2 border-dashed border-gray-100">
            <History size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-black uppercase tracking-widest text-sm">No archived channels found in history</p>
          </div>
        )}
      </div>
    </div>
  );
}
