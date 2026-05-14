import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signup(username, email, password);
      navigate('/chat');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 relative min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top_right,_#FDFCFB_0%,_#E2D1C3_100%),radial-gradient(circle_at_bottom_left,_#E3F2FD,_#BBDEFB)]" style={{
      background: 'radial-gradient(circle at 20% 20%, rgba(26, 35, 126, 0.05), transparent), radial-gradient(circle at 80% 80%, rgba(212, 175, 55, 0.1), transparent), linear-gradient(135deg, #FFFFFF 0%, #F5F7FA 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <div className="mb-5 flex items-center justify-center gap-3 sm:absolute sm:top-6 sm:left-8 sm:mb-0 sm:gap-6 z-20">
        <div className="w-16 h-16 sm:w-24 sm:h-24 transform hover:scale-110 transition-all duration-500">
          <img src="/static/img/shk_logo_new.png" alt="Logo" className="w-full h-full object-contain filter drop-shadow-md" />
        </div>
        <h1 className="text-lg sm:text-xl font-black text-[#1A237E] tracking-tighter uppercase">
          SHK <span className="text-[#D4AF37]">CONNECT</span>
        </h1>
      </div>

      <div className="bg-white/95 backdrop-blur-md border border-white/20 p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-full relative z-10" style={{ maxWidth: '450px' }}>
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1A237E]">Create Account</h2>
          <p className="text-gray-400 text-sm mt-2 font-medium">Join SHK Connect to collaborate</p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-sm mb-4 border border-rose-100 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Full Name</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3.5 sm:p-4 border border-gray-200 rounded-xl outline-none focus:border-[#1A237E] focus:ring-1 focus:ring-[#1A237E] transition-all" placeholder="John Doe" required />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3.5 sm:p-4 border border-gray-200 rounded-xl outline-none focus:border-[#1A237E] focus:ring-1 focus:ring-[#1A237E] transition-all" placeholder="name@shkindustries.com" required />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3.5 sm:p-4 border border-gray-200 rounded-xl outline-none focus:border-[#1A237E] focus:ring-1 focus:ring-[#1A237E] transition-all" placeholder="********" required />
          </div>
          
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link to="/login" className="text-sm text-[#1A237E] font-semibold hover:underline whitespace-nowrap">Already have an account?</Link>
          </div>

          <button type="submit" className="w-full bg-[#1A237E] text-white p-4 rounded-xl font-bold hover:bg-[#3949AB] transition shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 active:translate-y-0">
            SIGN UP
          </button>
        </form>
      </div>
    </div>
  );
}
