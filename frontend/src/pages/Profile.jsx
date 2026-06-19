import React, { useState } from 'react';
import { User, Mail, Shield, Camera, Key, Bell, Globe, Save, ChevronRight, LogOut } from 'lucide-react';

const Profile = ({ user }) => {
  const [activeTab, setActiveTab] = useState('account');

  const tabs = [
    { id: 'account', label: 'Account Identity', icon: User },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'notifications', label: 'Preferences', icon: Bell },
  ];

  return (
    <div className="p-6 lg:p-10 bg-slate-50 min-h-full overflow-y-auto font-outfit">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Identity Workspace</h1>
          <p className="text-slate-500 font-medium mt-1">Manage your digital presence and security protocols.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Nav Sidebar */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon size={18} className={activeTab === tab.id ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span className="text-sm font-bold">{tab.label}</span>
                  <ChevronRight size={14} className={`ml-auto transition-transform ${activeTab === tab.id ? 'translate-x-0' : '-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                </button>
              ))}
              <div className="my-2 border-t border-slate-100" />
              <a href="/logout" className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all">
                <LogOut size={18} />
                <span className="text-sm font-bold">Terminate Session</span>
              </a>
            </div>

            <div className="mt-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-600/20 relative overflow-hidden group">
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-60">System Role</p>
                <h4 className="text-2xl font-black tracking-tight mb-2">{user?.role}</h4>
                <p className="text-blue-100/70 text-sm font-medium">Your account is synchronized with the SHK Global Identity network.</p>
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-8 pb-20">
            {activeTab === 'account' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                {/* Profile Header Card */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm p-8 lg:p-10 flex flex-col items-center sm:flex-row sm:items-start gap-8">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-[3rem] bg-slate-100 border-4 border-white shadow-xl flex items-center justify-center font-black text-4xl text-blue-600 rotate-3 transition-transform group-hover:rotate-0 duration-500">
                      {user?.username?.[0]?.toUpperCase()}
                    </div>
                    <button className="absolute -bottom-2 -right-2 p-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all border-4 border-white">
                      <Camera size={18} />
                    </button>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-2xl font-black text-slate-900">{user?.first_name || user?.username}</h2>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Global Identifier: @{user?.username}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-6">
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <Mail size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">{user?.email}</span>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                        <Globe size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase">Synchronized</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm p-8 lg:p-10">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" /> Core Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                      <input type="text" defaultValue={user?.first_name} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                      <input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all" />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Email</label>
                      <input type="email" defaultValue={user?.email} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all" />
                    </div>
                  </div>
                  <div className="mt-10 pt-8 border-t border-slate-100 flex justify-end">
                    <button className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                      <Save size={18} /> Update Artifacts
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm p-8 lg:p-10 animate-in fade-in slide-in-from-right-4 duration-500">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-600" /> Authentication Control
                </h3>
                <div className="space-y-8">
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div>
                      <p className="text-sm font-black text-slate-900">Change Password</p>
                      <p className="text-xs text-slate-400 font-medium mt-1">Rotate your access credentials regularly.</p>
                    </div>
                    <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                      Modify
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 opacity-60 grayscale cursor-not-allowed">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-slate-900">Multi-Factor Auth (MFA)</p>
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded-full uppercase tracking-tighter">Pro</span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium mt-1">Secure your login with hardware security keys.</p>
                    </div>
                    <button disabled className="px-5 py-2.5 bg-slate-200 text-slate-400 rounded-xl font-bold text-xs uppercase tracking-widest">
                      Disabled
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
