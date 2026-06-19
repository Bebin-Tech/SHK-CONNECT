import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreditCard, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, MoreVertical, CheckCircle2, XCircle, Clock, Receipt } from 'lucide-react';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('/api/expenses').then(res => {
      setExpenses(res.data);
      setLoading(false);
    });
  }, []);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'approved': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'rejected': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const filteredExpenses = expenses.filter(e =>
    e.description?.toLowerCase().includes(search.toLowerCase()) ||
    e.category?.toLowerCase().includes(search.toLowerCase()) ||
    e.username?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 bg-slate-50 min-h-full overflow-y-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <CreditCard className="text-blue-600" /> Ledger & Expenses
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Audit transactions, manage reimbursements and financial logs.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 active:scale-95">
          <Plus size={18} /> Add Transaction
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Net Flow</p>
          <p className="text-3xl font-black text-slate-900">₹{expenses.reduce((acc, curr) => acc + (curr.type === 'credit' ? curr.amount : -curr.amount), 0).toLocaleString()}</p>
          <div className="mt-4 flex items-center gap-2 text-emerald-500">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Synchronized with bank</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Pending Approvals</p>
          <p className="text-3xl font-black text-amber-500">{expenses.filter(e => e.status === 'pending').length}</p>
          <div className="mt-4 flex items-center gap-2 text-slate-400">
            <Clock size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Awaiting audit review</span>
          </div>
        </div>
        <div className="bg-indigo-900 p-6 rounded-3xl shadow-xl shadow-indigo-900/20 relative overflow-hidden">
          <div className="relative z-10 text-white">
            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-4">Quick Audit</p>
            <p className="text-sm font-medium leading-relaxed">Download monthly financial reconciliation statement.</p>
            <button className="mt-4 text-xs font-black uppercase tracking-widest bg-white text-indigo-900 px-4 py-2 rounded-lg">Export Report</button>
          </div>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center gap-4 bg-slate-50/30">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Search description, category or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm"
            />
          </div>
          <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-sm">
            <Filter size={20} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${
                        e.type === 'credit' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'
                      }`}>
                        {e.type === 'credit' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-none">{e.description || 'No description'}</p>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">{e.bill_date}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-600">
                    @{e.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full border border-slate-200 uppercase tracking-wider">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-black ${e.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {e.type === 'credit' ? '+' : '-'}₹{e.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(e.status)}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View Receipt">
                        <Receipt size={16} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Expenses;
