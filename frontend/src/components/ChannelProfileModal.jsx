import React, { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-[#1A237E]">Channel Profile</h3>
            <p className="text-xs text-gray-400 font-semibold">Edit photo and details</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-3xl overflow-hidden bg-blue-50 text-[#1A237E] flex items-center justify-center font-bold text-3xl border border-blue-100">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <span>{name?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <label className="px-4 py-2 bg-gray-50 text-[#1A237E] rounded-xl font-bold text-xs cursor-pointer border hover:bg-blue-50 flex items-center gap-2">
              <Upload size={14} /> Upload Picture
              <input type="file" onChange={handleFileChange} accept="image/*" className="hidden" />
            </label>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Channel Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#1A237E] text-sm font-semibold"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Details</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#1A237E] text-sm h-24 resize-none"
            ></textarea>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#1A237E] text-white rounded-xl font-bold hover:bg-[#3949AB] transition shadow-lg uppercase"
          >
            {isSubmitting ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChannelProfileModal;
