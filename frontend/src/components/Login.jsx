import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password, remember);
      navigate('/chat');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 p-4 font-['Outfit']">
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="w-20 h-20 bg-white shadow-xl rounded-[24px] overflow-hidden p-2 border border-gray-100 flex items-center justify-center">
           <img src="/static/img/shk_connect_logo.jpg" alt="SHK Logo" className="w-full h-full object-cover" />
        </div>
        <div className="flex items-baseline gap-2">
           <h1 className="text-3xl font-black text-[#1A237E] tracking-tighter">SHK</h1>
           <h1 className="text-3xl font-black text-[#D4AF37] tracking-tighter uppercase">Connect</h1>
        </div>
      </div>

      <div className="bg-white p-8 sm:p-12 rounded-[48px] shadow-[0_20px_60px_rgba(0,0,0,0.04)] w-full max-w-[500px] border border-gray-50">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-black text-[#1A237E] mb-2 uppercase tracking-tighter">Sign In</h2>
          <p className="text-gray-400 font-bold">Welcome back to SHK Industries</p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-3xl text-sm mb-8 border border-rose-100 text-center font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest mb-3 text-gray-400 ml-2">Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full p-5 border border-gray-100 rounded-3xl outline-none focus:ring-2 focus:ring-blue-100 bg-gray-50/30 transition-all text-[#1A237E] font-bold" 
              placeholder="name@shkindustries.com" 
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest mb-3 text-gray-400 ml-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full p-5 border border-gray-100 rounded-3xl outline-none focus:ring-2 focus:ring-blue-100 bg-gray-50/30 transition-all text-[#1A237E] font-bold" 
              placeholder="........" 
              required 
            />
          </div>
          
          <div className="flex items-center justify-between px-2">
            <label className="flex items-center gap-3 text-sm text-gray-500 font-bold cursor-pointer">
              <input 
                type="checkbox" 
                checked={remember} 
                onChange={e => setRemember(e.target.checked)} 
                className="w-5 h-5 rounded-lg border-gray-300 text-[#1A237E] focus:ring-[#1A237E]" 
              />
              <span>Remember me</span>
            </label>
            <button type="button" className="text-sm text-[#1A237E] font-black hover:underline">Forgot Password?</button>
          </div>

          <button type="submit" className="w-full bg-[#1A237E] text-white p-6 rounded-3xl font-black text-lg hover:scale-[1.02] transition shadow-2xl shadow-blue-900/20 duration-300 uppercase tracking-widest">
            SIGN IN
          </button>
        </form>

        <div className="mt-12 text-center">
          <p className="text-sm text-[#1A237E] font-black uppercase tracking-[0.2em]">
            version 2.0
          </p>
        </div>
      </div>
    </div>
  );
}
