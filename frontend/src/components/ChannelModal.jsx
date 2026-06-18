import React, { useState } from 'react';
import { X } from 'lucide-react';

const ChannelModal = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Name is required');

    setIsSubmitting(true);
    const success = await onCreate({ name, description });
    setIsSubmitting(false);

    if (success) {
      setName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[#1A237E]">Create New Channel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Channel Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales Team"
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#1A237E] text-sm font-semibold"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel for?"
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#1A237E] text-sm h-24 resize-none"
            ></textarea>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 bg-[#1A237E] text-white rounded-xl font-bold hover:bg-[#3949AB] transition shadow-lg mt-2 uppercase ${isSubmitting ? 'opacity-50' : ''}`}
          >
            {isSubmitting ? 'Creating...' : 'Create Channel'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChannelModal;
