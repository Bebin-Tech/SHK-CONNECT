import React, { useState, useEffect } from 'react';
import { LifeBuoy, Plus, MessageSquare, Clock, AlertTriangle, CheckCircle2, ChevronRight, X, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SupportView() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ subject: '', description: '', priority: 'medium' });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    const res = await fetch('/api/admin/tickets');
    const data = await res.json();
    setTickets(data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/tickets/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (data.success) {
      setModalOpen(false);
      setFormData({ subject: '', description: '', priority: 'medium' });
      fetchTickets();
    }
  };

  if (loading) return <div className="p-10 text-gray-400 font-bold">Loading Support Portal...</div>;

  const isAdmin = user?.role === 'Admin';

  return (
    <div className="p-8 lg:p-12 space-y-10 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-[#1A237E] tracking-tighter uppercase mb-2">Help & Support</h2>
          <p className="text-gray-400 font-bold">{isAdmin ? 'Manage user requests and tickets' : 'Submit and track your assistance requests'}</p>
        </div>
        {!isAdmin && (
          <button 
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-3 bg-[#1A237E] text-white px-8 py-5 rounded-3xl font-black shadow-xl shadow-blue-900/20 hover:scale-105 transition-transform"
          >
            <Plus size={24} strokeWidth={3} />
            <span>NEW TICKET</span>
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
           <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-2">Recent Tickets</h3>
           {tickets.map(t => (
             <div key={t.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-50 flex items-center gap-6 hover:shadow-lg transition-all group cursor-pointer">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${t.status === 'closed' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                   {t.status === 'closed' ? <CheckCircle2 size={24} /> : <MessageSquare size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-3 mb-1">
                      <p className="text-sm font-black text-[#1A237E] truncate uppercase tracking-tight">{t.subject}</p>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${t.priority === 'high' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>{t.priority}</span>
                   </div>
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">
                      Opened {t.created_at} • Status: <span className={t.status === 'closed' ? 'text-emerald-500' : 'text-blue-500'}>{t.status.replace('_', ' ')}</span>
                   </p>
                </div>
                <ChevronRight size={20} className="text-gray-200 group-hover:text-[#1A237E] transition-colors" />
             </div>
           ))}
           {tickets.length === 0 && (
             <div className="p-20 bg-gray-50/50 rounded-[40px] text-center border-2 border-dashed border-gray-100">
                <LifeBuoy size={48} className="text-gray-200 mx-auto mb-4" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No active tickets</p>
             </div>
           )}
        </div>

        <div className="space-y-8">
           <div className="bg-[#1A237E] p-10 rounded-[40px] text-white shadow-2xl shadow-blue-900/40 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xl font-black uppercase mb-4 leading-tight">Need Urgent Help?</h3>
                <p className="text-blue-200 text-sm font-bold mb-8">Start a direct chat with our system engineers for immediate response.</p>
                <button className="w-full py-5 bg-white text-[#1A237E] rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-blue-50 transition-colors">
                   <Send size={18} />
                   <span>LIVE CHAT</span>
                </button>
              </div>
              <LifeBuoy size={140} className="absolute -bottom-10 -right-10 text-white/5" />
           </div>

           <div className="bg-white p-8 rounded-[40px] border border-gray-50 shadow-sm">
              <h3 className="text-sm font-black text-[#1A237E] uppercase mb-6 flex items-center gap-2">
                 <AlertTriangle size={18} className="text-amber-500" />
                 Important Links
              </h3>
              <div className="space-y-4">
                 {['Knowledge Base', 'Security Protocols', 'Terms of Use'].map(link => (
                   <button key={link} className="w-full p-4 bg-gray-50 rounded-2xl text-left text-xs font-black text-gray-500 hover:bg-gray-100 transition-all flex items-center justify-between">
                      {link}
                      <ChevronRight size={14} />
                   </button>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-blue-900/10 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-xl p-10 lg:p-12 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-2xl font-black text-[#1A237E] uppercase">New Ticket</h3>
                  <p className="text-gray-400 font-bold text-sm">Submit your request to our team</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="p-4 bg-gray-50 text-gray-400 rounded-3xl hover:bg-gray-100 transition-all"><X size={24}/></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Subject</label>
                  <input 
                    type="text" 
                    value={formData.subject} 
                    onChange={e => setFormData({...formData, subject: e.target.value})}
                    className="w-full p-5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]" 
                    placeholder="Short summary of the issue"
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Priority</label>
                    <select 
                      value={formData.priority}
                      onChange={e => setFormData({...formData, priority: e.target.value})}
                      className="w-full p-5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full p-5 bg-gray-50 border-none rounded-2xl h-32 resize-none outline-none focus:ring-2 focus:ring-blue-100 font-bold text-[#1A237E]" 
                    placeholder="Describe your issue in detail..."
                    required 
                  />
                </div>
                <button type="submit" className="w-full py-6 bg-[#1A237E] text-white rounded-3xl font-black shadow-xl shadow-blue-900/20 hover:scale-[1.02] transition-transform">
                  SUBMIT TICKET
                </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
