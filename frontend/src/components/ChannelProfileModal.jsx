import React, { useState, useEffect } from 'react';
import { X, Upload, Camera, Settings2, Trash2 } from 'lucide-react';
import axios from 'axios';

const ChannelProfileModal = ({ isOpen, onClose, group, onUpdate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && group) {
      setName(group.name || '');
      setDescription(group.description || '');
      setPreview(group.avatar_url || null);
    }
  }, [isOpen, group]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', description);
      if (avatar) fd.append('avatar', avatar);

      const res = await axios.post(`/chat/edit_group/${group.id}`, fd);
      onUpdate(res.data);
      onClose();
    } catch (err) {
      alert('Failed to update channel profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-tr from-slate-900 to-slate-800 p-8 text-white relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/20 transition-all">
            <X size={20} />
          </button>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg ring-4 ring-blue-600/20">
              <Settings2 size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">Channel Identity</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Configuration & Media</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div className="relative group/avatar cursor-pointer">
              <div className="w-28 h-28 rounded-[2rem] overflow-hidden bg-slate-100 border-4 border-white shadow-xl flex items-center justify-center group-hover/avatar:scale-105 transition-all duration-500">
                {preview ? (
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-blue-600">{name?.[0]?.toUpperCase()}</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={32} className="text-white" />
                </div>
              </div>
              <label className="absolute -bottom-2 -right-2 p-3 bg-blue-600 text-white rounded-2xl shadow-lg cursor-pointer hover:bg-blue-700 hover:scale-110 transition-all border-4 border-white">
                <Upload size={16} strokeWidth={3} />
                <input type="file" onChange={handleFileChange} accept="image/*" className="hidden" />
              </label>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-6">Square image recommended</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">About this channel</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 h-24 resize-none outline-none focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all"
              ></textarea>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70' : ''}`}
            >
              {isSubmitting ? 'Saving changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChannelProfileModal;
