import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Hash, Plus, Search, X, Users, Settings, MessageSquare, Menu, Lock, Archive } from 'lucide-react';
import { socket } from '../socket';
import WorkspaceComposer from '../components/WorkspaceComposer';
import WorkspaceMessage from '../components/WorkspaceMessage';
import ChannelModal from '../components/ChannelModal';
import ChannelProfileModal from '../components/ChannelProfileModal';
import ConnectUsersModal from '../components/ConnectUsersModal';
import './workspace.css';
import { mergeMessages as merge, mergeTimeline } from '../workspaceState';

const messageKey = (message, userId) => message.group_id ? `group:${message.group_id}` : `dm:${message.user_id === userId ? message.recipient_id : message.user_id}`;

export default function ChatRoom({ user }) {
  const { groupId, recipientId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState({ channels: [], people: [] });
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [typing, setTyping] = useState('');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [thread, setThread] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [members, setMembers] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeKey = recipientId ? `dm:${recipientId}` : groupId ? `group:${groupId}` : null;
  const active = [...workspace.channels, ...workspace.people].find(item => item.key === activeKey);
  const current = useRef(null);
  current.current = active;
  const threadRef = useRef(null);
  threadRef.current = thread;
  const newest = useRef(0);
  const liveEvents = useRef(new Map());
  const list = useRef(null);
  const bottom = useRef(null);
  const typingTimer = useRef(null);
  const lastTyping = useRef(0);
  const lastRead = useRef(new Map());
  const requestVersion = useRef(0);
  const workspaceVersion = useRef(0);
  const searchVersion = useRef(0);
  const threadVersion = useRef(0);
  const canCreate = ['Admin', 'Owner', 'ED'].includes(user?.role);
  const canManage = active?.kind === 'group' && (canCreate || active.created_by === user.id);

  const refresh = useCallback(async () => {
    const version = ++workspaceVersion.current;
    try {
      const response = await axios.get('/api/workspace');
      if (version === workspaceVersion.current) { setWorkspace(response.data); setLoaded(true); }
    } catch (err) { setError(err.response?.data?.error || 'Unable to load workspace.'); }
  }, []);

  const markRead = useCallback(async (conversation, lastId) => {
    if (!conversation || !lastId || document.visibilityState !== 'visible' || !document.hasFocus()) return;
    if ((lastRead.current.get(conversation.key) || 0) >= lastId) return;
    lastRead.current.set(conversation.key, lastId);
    try {
      await axios.post(`/api/conversations/${conversation.kind}/${conversation.id}/read`, { last_message_id: lastId });
    } catch { lastRead.current.delete(conversation.key); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!activeKey && loaded && workspace.channels.length) navigate(`/chat/${workspace.channels[0].id}`, { replace: true });
  }, [activeKey, loaded, workspace.channels, navigate]);

  useEffect(() => {
    const version = ++requestVersion.current;
    ++threadVersion.current; ++searchVersion.current;
    liveEvents.current.clear(); setEditing(false); setMembers(false);
    setMessages([]); setThread(null); setResults(null); setSearch(''); setTyping(''); setError('');
    setHasMore(false); setLoadingMore(false); newest.current = 0;
    if (!active) { setLoading(false); return; }
    setLoading(true);
    if (active.kind === 'group') socket.emit('join', { group_id: active.id });
    axios.get(`/api/conversations/${active.kind}/${active.id}/messages`).then(response => {
      if (version !== requestVersion.current) return;
      setMessages(prev => mergeTimeline(response.data.messages, prev, [...liveEvents.current.values()]));
      setHasMore(response.data.has_more); newest.current = Math.max(newest.current, response.data.latest_id);
      markRead(active, newest.current);
      requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: 'end' }));
    }).catch(err => { if (version === requestVersion.current) setError(err.response?.data?.error || 'Unable to load messages.'); })
      .finally(() => { if (version === requestVersion.current) setLoading(false); });
    return () => { ++requestVersion.current; };
  }, [activeKey, Boolean(active), markRead]);

  useEffect(() => {
    const receive = message => {
      refresh();
      if (messageKey(message, user.id) !== current.current?.key) return;
      liveEvents.current.set(message.id, message);
      newest.current = Math.max(newest.current, message.id);
      if (message.parent_id) {
        setMessages(prev => prev.map(root => root.id === message.parent_id ? { ...root, replies: merge(root.replies || [], [message]) } : root));
        setThread(prev => prev?.id === message.parent_id ? { ...prev, replies: merge(prev.replies || [], [message]) } : prev);
      } else {
        setMessages(prev => merge(prev, [message]));
      }
      const nearBottom = !list.current || list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 160;
      if (nearBottom || message.user_id === user.id) {
        markRead(current.current, newest.current);
        if (!message.parent_id) requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }));
      }
    };
    const onConnect = async () => {
      setConnected(true); refresh();
      const conversation = current.current;
      if (!conversation) return;
      if (conversation.kind === 'group') socket.emit('join', { group_id: conversation.id });
      try {
        const { data } = await axios.get(`/api/conversations/${conversation.kind}/${conversation.id}/messages`);
        if (current.current?.key !== conversation.key) return;
        setMessages(prev => mergeTimeline(data.messages, prev, [...liveEvents.current.values()]));
        newest.current = Math.max(newest.current, data.latest_id);
        markRead(conversation, newest.current);
        if (threadRef.current) {
          const rootId = threadRef.current.id;
          const response = await axios.get(`/api/threads/${rootId}`);
          setThread(prev => prev?.id === rootId ? response.data : prev);
        }
      } catch { setError('Could not refresh messages. Please reload.'); }
    };
    const onDisconnect = () => setConnected(false);
    const onTyping = data => {
      if (messageKey(data, user.id) !== current.current?.key || data.user_id === user.id) return;
      setTyping(data.username); clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(''), 2500);
    };
    const onFocus = () => markRead(current.current, newest.current);
    socket.on('receive_message', receive); socket.on('connect', onConnect); socket.on('disconnect', onDisconnect);
    socket.on('user_typing', onTyping); socket.on('refresh_channels', refresh); socket.on('presence_update', refresh); socket.on('read_update', refresh);
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus);
    return () => {
      socket.off('receive_message', receive); socket.off('connect', onConnect); socket.off('disconnect', onDisconnect);
      socket.off('user_typing', onTyping); socket.off('refresh_channels', refresh); socket.off('presence_update', refresh); socket.off('read_update', refresh);
      window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); clearTimeout(typingTimer.current);
    };
  }, [refresh, markRead, user.id]);

  function choose(item) { navigate(item.kind === 'dm' ? `/dm/${item.id}` : `/chat/${item.id}`); setSidebarOpen(false); }
  async function upload(file) { const form = new FormData(); form.append('file', file); return (await axios.post('/chat/upload', form)).data; }
  function send(data, parentId = null) {
    const conversation = current.current;
    return new Promise((resolve, reject) => {
      if (!conversation || !socket.connected) return reject(new Error('You are offline. Reconnect to send your draft.'));
      const target = conversation.kind === 'group' ? { group_id: conversation.id } : { recipient_id: conversation.id };
      socket.timeout(15000).emit('send_message', { ...data, ...target, parent_id: parentId }, (err, response) => {
        if (err) return reject(new Error('Delivery could not be confirmed. Check the conversation before retrying.'));
        if (!response?.ok) return reject(new Error(response?.error || 'Message could not be saved.'));
        resolve(response.message);
      });
    });
  }
  function emitTyping() {
    if (!active || Date.now() - lastTyping.current < 1500) return;
    lastTyping.current = Date.now();
    socket.emit('typing', active.kind === 'group' ? { group_id: active.id } : { recipient_id: active.id });
  }
  async function openThread(message) {
    const key = activeKey, version = ++threadVersion.current;
    try {
      const { data } = await axios.get(`/api/threads/${message.parent_id || message.id}`);
      if (current.current?.key === key && version === threadVersion.current) setThread(mergeTimeline([data], [], [...liveEvents.current.values()]).find(root => root.id === data.id));
    } catch (err) { setError(err.response?.data?.error || 'Unable to open thread.'); }
  }
  async function older() {
    if (!active || !messages.length || loadingMore) return;
    const key = active.key;
    setLoadingMore(true);
    const height = list.current?.scrollHeight || 0;
    const top = list.current?.scrollTop || 0;
    try {
      const { data } = await axios.get(`/api/conversations/${active.kind}/${active.id}/messages`, { params: { before: messages[0].id } });
      if (current.current?.key !== key) return;
      setMessages(prev => merge(data.messages, prev)); setHasMore(data.has_more);
      requestAnimationFrame(() => { if (list.current) list.current.scrollTop = top + list.current.scrollHeight - height; });
    } catch { setError('Unable to load earlier messages.'); }
    finally { if (current.current?.key === key) setLoadingMore(false); }
  }
  async function searchMessages(event) {
    event.preventDefault();
    if (!active) return;
    const key = active.key, version = ++searchVersion.current;
    try {
      const { data } = await axios.get(`/api/conversations/${active.kind}/${active.id}/search`, { params: { q: search } });
      if (current.current?.key === key && version === searchVersion.current) setResults(data);
    } catch { setError('Search failed. Try again.'); }
  }
  async function createChannel(data) {
    try {
      const form = new FormData(); form.append('name', data.name); form.append('description', data.description);
      const response = await axios.post('/chat/create_group', form);
      await refresh(); navigate(`/chat/${response.data.id}`); return true;
    } catch (err) { setError(err.response?.data?.error || 'Unable to create channel.'); return false; }
  }
  const filtered = items => items.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()));
  const totalUnread = [...workspace.channels, ...workspace.people].reduce((sum, item) => sum + item.unread, 0);

  return <div className="ws-shell">
    <aside className={`ws-sidebar ${sidebarOpen ? 'ws-sidebar-open' : ''}`}>
      <div className="ws-workspace-title"><div><strong>SHK workspace</strong><span><i className={connected ? 'ws-online' : 'ws-offline'} />{connected ? 'Connected' : 'Reconnecting…'}</span></div><button className="ws-mobile-close" aria-label="Close conversations" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
      <label className="ws-filter"><Search size={15} /><input aria-label="Find a channel or teammate" placeholder="Find a conversation" value={filter} onChange={event => setFilter(event.target.value)} /></label>
      <div className="ws-unread-summary"><MessageSquare size={16} />{totalUnread ? `${totalUnread} unread ${totalUnread === 1 ? 'message' : 'messages'}` : 'You’re all caught up'}</div>
      <div className="ws-conversation-list">
        <div className="ws-section-title"><span>Channels</span>{canCreate && <button title="Create channel" aria-label="Create channel" onClick={() => setCreating(true)}><Plus size={17} /></button>}</div>
        {filtered(workspace.channels).map(item => <button key={item.key} className={`ws-conversation ${item.key === activeKey ? 'ws-selected' : ''} ${item.unread ? 'ws-unread' : ''}`} onClick={() => choose(item)}><Hash size={17} /><span>{item.name}</span>{item.unread > 0 && <b>{item.unread}</b>}</button>)}
        {!workspace.channels.length && <p className="ws-sidebar-note">{canCreate ? 'Create your first channel to get started.' : 'A manager can add you to team channels.'}</p>}
        <div className="ws-section-title"><span>Direct messages</span><Users size={15} /></div>
        {filtered(workspace.people).map(item => <button key={item.key} className={`ws-conversation ${item.key === activeKey ? 'ws-selected' : ''} ${item.unread ? 'ws-unread' : ''}`} onClick={() => choose(item)}><i className={item.online ? 'ws-online' : 'ws-offline'} /><span>{item.name}</span>{item.unread > 0 && <b>{item.unread}</b>}</button>)}
        {!workspace.people.length && <p className="ws-sidebar-note">Teammates appear here once they have an account.</p>}
      </div>
      <div className="ws-sidebar-footer">A space for your team to work together.</div>
    </aside>
    <section className="ws-main">
      <header className="ws-header"><button className="ws-mobile-toggle" aria-label="Open conversations" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div className="ws-heading">{active?.kind === 'dm' ? <Lock size={20} /> : <Hash size={23} />}<div><h1>{active?.name || 'Your workspace'}</h1><p>{active?.kind === 'dm' ? (active.online ? 'Online · Direct message' : 'Direct message') : active?.description || 'Channels, conversations, and your team — together.'}</p></div></div>
        {canManage && <div className="ws-header-actions"><button title="Manage members" aria-label="Manage members" onClick={() => setMembers(true)}><Users size={18} /><span>{active.member_count}</span></button><button title="Channel settings" aria-label="Channel settings" onClick={() => setEditing(true)}><Settings size={18} /></button>{canCreate && <button title="Archive channel" aria-label="Archive channel" onClick={async () => { if (!confirm('Archive this channel? Its messages will remain in History.')) return; try { await axios.post(`/chat/archive_group/${active.id}`); await refresh(); navigate('/chat'); } catch { setError('Unable to archive channel.'); } }}><Archive size={18} /></button>}</div>}
      </header>
      {!connected && <div className="ws-status" role="status">Connection lost. Your draft is safe; messages will sync when you reconnect.</div>}
      {error && <div className="ws-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
      {active ? <>
        <form className="ws-search" onSubmit={searchMessages}><Search size={15} /><input aria-label="Search this conversation" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this conversation…" /><button type="submit">Search</button>{results && <button type="button" aria-label="Close search" onClick={() => { ++searchVersion.current; setResults(null); setSearch(''); }}><X size={16} /></button>}</form>
        <div className="ws-message-list" ref={list} onScroll={() => { if (list.current && list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 80) markRead(active, newest.current); }}>
          {loading ? <p className="ws-empty">Loading conversation…</p> : results ? <><p className="ws-search-count">{results.length} search results · Open a thread for context</p>{results.map(message => <WorkspaceMessage key={message.id} message={message} currentUser={user} onThread={openThread} />)}</> : <>
            {hasMore && <button className="ws-load-more" disabled={loadingMore} onClick={older}>{loadingMore ? 'Loading…' : 'Load earlier messages'}</button>}
            {!hasMore && <div className="ws-conversation-intro"><div>{active.kind === 'dm' ? <MessageSquare size={30} /> : <Hash size={30} />}</div><h2>{active.kind === 'dm' ? active.name : `Welcome to #${active.name}`}</h2><p>{active.kind === 'dm' ? active.description : 'Share updates, ask questions, and keep the conversation moving.'}</p></div>}
            {messages.map(message => <WorkspaceMessage key={message.id} message={message} currentUser={user} onThread={openThread} />)}
            <div ref={bottom} />
          </>}
        </div>
        <div className="ws-compose-area"><div className="ws-typing" aria-live="polite">{typing ? `${typing} is typing…` : ''}</div><WorkspaceComposer key={active.key} label={active.kind === 'dm' ? `Message ${active.name}` : `Message #${active.name}`} connected={connected} onSend={send} onUpload={upload} onTyping={emitTyping} /></div>
      </> : <div className="ws-empty-state"><MessageSquare size={44} /><h2>{loaded ? 'Let’s start a conversation' : 'Loading workspace…'}</h2><p>{!loaded ? 'Connecting to your conversations.' : activeKey ? 'This conversation is unavailable or you no longer have access.' : 'Choose a channel or a teammate from the sidebar.'}</p><button className="ws-mobile-toggle" onClick={() => setSidebarOpen(true)}>Browse conversations</button></div>}
    </section>
    {thread && active && <aside className="ws-thread-panel"><header><h2>Thread <span>{active.kind === 'group' ? `#${active.name}` : active.name}</span></h2><button aria-label="Close thread" onClick={() => { ++threadVersion.current; setThread(null); }}><X size={19} /></button></header><div className="ws-thread-messages"><WorkspaceMessage message={thread} currentUser={user} /><div className="ws-reply-count">{thread.replies?.length || 0} {thread.replies?.length === 1 ? 'reply' : 'replies'}</div>{thread.replies?.map(reply => <WorkspaceMessage key={reply.id} message={reply} currentUser={user} />)}</div><div className="ws-thread-compose"><WorkspaceComposer key={`${active.key}:${thread.id}`} label="Reply in thread" connected={connected} onSend={data => send(data, thread.id)} onUpload={upload} onTyping={emitTyping} /></div></aside>}
    <ChannelModal isOpen={creating} onClose={() => setCreating(false)} onCreate={createChannel} />
    {active?.kind === 'group' && <><ChannelProfileModal isOpen={editing} onClose={() => setEditing(false)} group={active} onUpdate={refresh} /><ConnectUsersModal isOpen={members} onClose={() => { setMembers(false); refresh(); }} groupId={active.id} currentMembers={active.members} /></>}
  </div>;
}
