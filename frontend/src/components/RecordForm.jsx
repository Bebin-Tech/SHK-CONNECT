import React, { useState } from 'react';

export default function RecordForm({ title, fields, onSubmit, onClose }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
    <form className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4" onSubmit={async e => {
      e.preventDefault();
      if (saving) return;
      const data = Object.fromEntries(new FormData(e.currentTarget));
      setSaving(true); setError('');
      try { await onSubmit(data); onClose(); }
      catch (err) { setError(err.response?.data?.error || 'Unable to save. Please try again.'); }
      finally { setSaving(false); }
    }}>
      <h2 className="text-xl font-bold">{title}</h2>
      {fields.map(field => <label className="block text-sm" key={field.name}>{field.label}
        {field.options ? <select name={field.name} className="block w-full border rounded-lg p-2" defaultValue={field.value}>
          {field.options.map(option => <option key={option} value={option}>{option}</option>)}
        </select> : <input className="block w-full border rounded-lg p-2" name={field.name} type={field.type || 'text'} required={field.required !== false} defaultValue={field.value} step={field.type === 'number' ? '0.01' : undefined} />}
      </label>)}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="flex justify-end gap-3"><button type="button" onClick={onClose}>Cancel</button><button disabled={saving} className="bg-blue-600 text-white rounded-lg px-4 py-2">{saving ? 'Saving…' : 'Save'}</button></div>
    </form>
  </div>;
}
