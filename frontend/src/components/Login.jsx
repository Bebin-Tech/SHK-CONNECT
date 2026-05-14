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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-['Outfit']">
      <div className="bg-white p-8 sm:p-12 rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.03)] w-full max-w-[500px]">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-extrabold text-[#1A237E] mb-2">Sign In</h2>
          <p className="text-gray-400 font-medium">Welcome back to SHK Industries</p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-sm mb-6 border border-rose-100 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-bold mb-3 text-gray-700 px-1">Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full p-5 border border-gray-100 rounded-2xl outline-none focus:border-[#1A237E] bg-gray-50/30 transition-all text-gray-600 font-medium" 
              placeholder="name@shkindustries.com" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-3 text-gray-700 px-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full p-5 border border-gray-100 rounded-2xl outline-none focus:border-[#1A237E] bg-gray-50/30 transition-all text-gray-600 font-medium tracking-widest" 
              placeholder="........" 
              required 
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3 text-sm text-gray-500 font-medium cursor-pointer">
              <input 
                type="checkbox" 
                checked={remember} 
                onChange={e => setRemember(e.target.checked)} 
                className="w-5 h-5 rounded border-gray-300 text-[#1A237E] focus:ring-[#1A237E]" 
              />
              <span>Remember me</span>
            </label>
            <button type="button" className="text-sm text-[#1A237E] font-bold hover:underline">Forgot Password?</button>
          </div>

          <button type="submit" className="w-full bg-[#1A237E] text-white p-5 rounded-2xl font-black text-lg hover:bg-[#0D145A] transition shadow-[0_10px_20px_rgba(26,35,126,0.2)] transform hover:-translate-y-1 duration-300 uppercase tracking-wider">
            SIGN IN
          </button>
        </form>

        <div className="mt-12 space-y-4 text-center">
          <p className="text-sm text-gray-400 font-bold">
            Don't have an account? <span className="text-[#1A237E] cursor-pointer hover:underline">Contact Administrator</span>
          </p>
          <p className="text-sm text-gray-400 font-bold">
            Don't have an account? <span className="text-[#1A237E] font-black">V 1.0</span>
          </p>
        </div>
      </div>
    </div>
  );
}
