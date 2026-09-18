import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, X } from 'lucide-react';

export default function WorkspaceComposer({ label, connected, onSend, onUpload, onTyping }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy || uploading || !connected || (!text.trim() && !file)) return;
    setBusy(true); setError('');
    try {
      await onSend({ content: text, file_url: file?.url, file_type: file?.type, file_name: file?.name });
      if (mounted.current) { setText(''); setFile(null); }
    } catch (err) { if (mounted.current) setError(err.message || 'Unable to send. Your draft is still here.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <form className="ws-composer" onSubmit={submit}>
    {file && <div className="ws-file-pending"><Paperclip size={14} />{file.name}<button type="button" aria-label="Remove attachment" onClick={() => setFile(null)}><X size={14} /></button></div>}
    <textarea aria-label={label} placeholder={label} value={text} maxLength={10000} disabled={busy}
      onChange={event => { setText(event.target.value); onTyping(); }}
      onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event); }} />
    <div className="ws-composer-tools">
      <input ref={input} type="file" hidden onChange={async event => {
        const selected = event.target.files[0]; event.target.value = '';
        if (!selected) return;
        setUploading(true); setError('');
        try { const uploaded = await onUpload(selected); if (mounted.current) setFile(uploaded); }
        catch (err) { if (mounted.current) setError(err.response?.data?.error || 'Upload failed'); }
        finally { if (mounted.current) setUploading(false); }
      }} />
      <button type="button" title="Attach a file" aria-label="Attach a file" disabled={uploading || busy} onClick={() => input.current?.click()}><Paperclip size={18} /></button>
      <span>{uploading ? 'Uploading…' : 'Enter to send · Shift + Enter for a new line'}</span>
      <button className="ws-send" type="submit" aria-label="Send message" disabled={busy || uploading || !connected || (!text.trim() && !file)}><Send size={16} />{busy ? 'Sending…' : 'Send'}</button>
    </div>
    {error && <p role="alert" className="ws-error">{error}</p>}
  </form>;
}
