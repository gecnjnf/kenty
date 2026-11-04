import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Room, RoomEvent, Track } from 'livekit-client';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const VOICE_ROOMS = [
  { id: 'lobby', label: 'Общая', description: 'Для разговоров обо всём', icon: '◉' },
  { id: 'gaming', label: 'Игровая', description: 'Собираемся поиграть', icon: '🎮' },
  { id: 'chill', label: 'Тихая', description: 'Спокойное общение', icon: '☾' }
];

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('friends');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState(VOICE_ROOMS[0]);
  const [voiceName, setVoiceName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [voiceError, setVoiceError] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Голосовые комнаты готовы к подключению');
  const roomRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    loadProfile();
    loadSocial();
  }, [session?.user?.id]);

  async function loadProfile() {
    const { data, error: err } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (err) setError(err.message);
    else { setProfile(data); setVoiceName(data.display_name || data.username); }
  }

  async function loadSocial() {
    const { data: fs, error: fe } = await supabase.from('friendships')
      .select('id,requester_id,addressee_id,status,created_at')
      .or('requester_id.eq.' + session.user.id + ',addressee_id.eq.' + session.user.id)
      .order('created_at', { ascending: false });
    if (fe) { setError(fe.message); return; }
    const ids = [...new Set((fs || []).flatMap(x => [x.requester_id, x.addressee_id]).filter(x => x !== session.user.id))];
    let people = [];
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids);
      people = data || [];
    }
    setFriendships((fs || []).map(f => ({ ...f, person: people.find(p => p.id === (f.requester_id === session.user.id ? f.addressee_id : f.requester_id)) })));
    const { data: convs } = await supabase.from('conversations').select('id,title,conversation_type,created_at').order('created_at', { ascending: false });
    const { data: memberships } = await supabase.from('conversation_members').select('conversation_id,user_id');
    const myIds = new Set((memberships || []).filter(m => m.user_id === session.user.id).map(m => m.conversation_id));
    const mine = (convs || []).filter(c => myIds.has(c.id));
    const allUserIds = [...new Set((memberships || []).filter(m => myIds.has(m.conversation_id) && m.user_id !== session.user.id).map(m => m.user_id))];
    let memberProfiles = [];
    if (allUserIds.length) {
      const { data } = await supabase.from('profiles').select('id,username,display_name').in('id', allUserIds);
      memberProfiles = data || [];
    }
    setConversations(mine.map(c => {
      const otherId = (memberships || []).find(m => m.conversation_id === c.id && m.user_id !== session.user.id)?.user_id;
      return { ...c, person: memberProfiles.find(p => p.id === otherId) };
    }));
  }

  async function submitAuth(e) {
    e.preventDefault(); setError(''); setNotice(''); setAuthBusy(true);
    try {
      if (authMode === 'signup') {
        const clean = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(clean)) throw new Error('Ник: 3–24 символа, только латиница, цифры и _.');
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { username: clean, display_name: username.trim() } }
        });
        if (err) throw err;
        setNotice('Аккаунт создан. Если включено подтверждение почты, проверь входящие письма.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
      }
    } catch (e2) { setError(e2.message || 'Не удалось выполнить вход.'); }
    finally { setAuthBusy(false); }
  }

  async function logout() { await leaveVoiceRoom(); await supabase.auth.signOut(); setProfile(null); }

  async function searchUsers(e) {
    e.preventDefault(); setError('');
    const q = search.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    const { data, error: err } = await supabase.from('profiles')
      .select('id,username,display_name,avatar_url').neq('id', session.user.id)
      .or('username.ilike.%' + q + '%,display_name.ilike.%' + q + '%').limit(12);
    if (err) setError(err.message);
    else setSearchResults(data || []);
  }

  async function sendRequest(userId) {
    setError('');
    const { error: err } = await supabase.from('friendships').insert({ requester_id: session.user.id, addressee_id: userId, status: 'pending' });
    if (err) setError(err.code === '23505' ? 'Заявка этому пользователю уже отправлена.' : err.message);
    else { setNotice('Заявка отправлена!'); loadSocial(); }
  }

  async function respondRequest(id, status) {
    const { error: err } = await supabase.from('friendships').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) setError(err.message); else loadSocial();
  }

  async function openChat(person) {
    setError(''); setBusy(true);
    try {
      const existing = conversations.find(c => c.person?.id === person.id);
      let conversationId = existing?.id;
      if (!conversationId) {
        const { data: created, error: ce } = await supabase.from('conversations')
          .insert({ conversation_type: 'direct', created_by: session.user.id }).select('id').single();
        if (ce) throw ce;
        conversationId = created.id;
        const { error: me } = await supabase.from('conversation_members').insert([
          { conversation_id: conversationId, user_id: session.user.id },
          { conversation_id: conversationId, user_id: person.id }
        ]);
        if (me) throw me;
        await loadSocial();
      }
      setSelectedConversation({ id: conversationId, person });
      setTab('chat');
      await loadMessages(conversationId);
    } catch (e) { setError(e.message || 'Не удалось открыть переписку.'); }
    finally { setBusy(false); }
  }

  async function loadMessages(id) {
    const { data, error: err } = await supabase.from('messages').select('id,sender_id,content,created_at')
      .eq('conversation_id', id).order('created_at', { ascending: true }).limit(100);
    if (err) setError(err.message); else setMessages(data || []);
  }

  async function sendMessage(e) {
    e.preventDefault();
    const text = message.trim();
    if (!text || !selectedConversation) return;
    const { error: err } = await supabase.from('messages').insert({
      conversation_id: selectedConversation.id, sender_id: session.user.id, content: text
    });
    if (err) setError(err.message);
    else { setMessage(''); loadMessages(selectedConversation.id); }
  }

  function personForFriendship(f) { return f.person || { username: 'Пользователь', display_name: 'Пользователь' }; }
  const incoming = friendships.filter(f => f.status === 'pending' && f.addressee_id === session?.user?.id);
  const outgoing = friendships.filter(f => f.status === 'pending' && f.requester_id === session?.user?.id);
  const friends = friendships.filter(f => f.status === 'accepted');

  async function refreshParticipants(room) {
    if (!room) return;
    const people = [room.localParticipant, ...room.remoteParticipants.values()];
    setParticipants(people.map(p => ({ id: p.identity, name: p.name || p.identity, muted: !p.isMicrophoneEnabled, speaking: p.isSpeaking, local: p === room.localParticipant })));
  }

  async function joinVoiceRoom(e) {
    e.preventDefault(); setVoiceError('');
    if (!voiceName.trim() || !accessCode.trim()) { setVoiceError('Введи имя и код доступа.'); return; }
    setJoining(true); setVoiceStatus('Подключаемся к комнате…');
    let room;
    try {
      const response = await fetch('/api/token', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: selectedRoom.id, displayName: voiceName.trim(), accessCode }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось получить доступ к комнате.');
      room = new Room({ adaptiveStream: true, dynacast: true }); roomRef.current = room;
      const sync = () => refreshParticipants(room);
      [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ActiveSpeakersChanged,
       RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished].forEach(ev => room.on(ev, sync));
      room.on(RoomEvent.TrackSubscribed, track => {
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          const el = track.attach(); el.autoplay = true; el.playsInline = true; audioRef.current.appendChild(el);
        } sync();
      });
      room.on(RoomEvent.TrackUnsubscribed, track => { track.detach().forEach(el => el.remove()); sync(); });
      room.on(RoomEvent.Disconnected, () => { setConnected(false); setParticipants([]); setVoiceStatus('Соединение завершено'); });
      await room.connect(data.serverUrl, data.participantToken);
      await room.localParticipant.setMicrophoneEnabled(true);
      setConnected(true); setMicEnabled(true); setVoiceStatus('Ты в комнате «' + selectedRoom.label + '»'); sync();
    } catch (e2) {
      if (room) { try { await room.disconnect(); } catch {} }
      roomRef.current = null; setConnected(false); setVoiceError(e2.message || 'Не удалось подключиться.');
      setVoiceStatus('Не удалось подключиться');
    } finally { setJoining(false); }
  }

  async function leaveVoiceRoom() {
    const room = roomRef.current; roomRef.current = null;
    if (room) { try { await room.disconnect(); } catch {} }
    setConnected(false); setMicEnabled(false); setParticipants([]);
    if (audioRef.current) audioRef.current.innerHTML = '';
  }

  async function toggleMic() {
    const room = roomRef.current; if (!room) return;
    const next = !micEnabled;
    try { await room.localParticipant.setMicrophoneEnabled(next); setMicEnabled(next); refreshParticipants(room); }
    catch { setVoiceError('Проверь разрешение браузера на микрофон.'); }
  }

  useEffect(() => () => { if (roomRef.current) roomRef.current.disconnect(); }, []);

  if (!session) return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submitAuth}>
        <div className="brand-name auth-logo">KENTY</div>
        <div className="eyebrow">YOUR SPACE. YOUR PEOPLE.</div>
        <h1>{authMode === 'login' ? 'С возвращением' : 'Создай аккаунт'}</h1>
        <p className="auth-subtitle">Общайся с друзьями, переписывайся и заходи в голосовые комнаты.</p>
        {authMode === 'signup' && <label className="auth-label">НИКНЕЙМ<input value={username} onChange={e => setUsername(e.target.value)} placeholder="например, alex_01" maxLength={24} required /></label>}
        <label className="auth-label">EMAIL<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label className="auth-label">ПАРОЛЬ<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} placeholder="Минимум 6 символов" required /></label>
        {error && <div className="error-box">{error}</div>}
        {notice && <div className="notice-box">{notice}</div>}
        <button className="primary-button auth-submit" disabled={authBusy}>{authBusy ? 'Подожди…' : authMode === 'login' ? 'Войти в KENTY →' : 'Создать аккаунт →'}</button>
        <button type="button" className="text-button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(''); setNotice(''); }}>
          {authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </form>
    </main>
  );

  return (
    <main className="app-shell">
      <aside className="server-rail"><div className="brand-mark">K</div><div className="rail-divider" /><div className="server-icon selected">K</div></aside>
      <aside className="sidebar">
        <div className="brand-row"><div className="brand-name">KENTY</div><span className="beta-tag">ALPHA</span></div>
        <div className="sidebar-label">ПРОСТРАНСТВО</div>
        <button className={'nav-item ' + (tab === 'friends' ? 'selected' : '')} onClick={() => setTab('friends')}>♧ Друзья</button>
        <button className={'nav-item ' + (tab === 'chat' ? 'selected' : '')} onClick={() => setTab('chat')}># Сообщения</button>
        <button className={'nav-item ' + (tab === 'voice' ? 'selected' : '')} onClick={() => setTab('voice')}>◖ Голосовые комнаты</button>
        <div className="sidebar-label">ПЕРЕПИСКИ</div>
        <div className="conversation-list">
          {conversations.map(c => <button className={'conversation-link ' + (selectedConversation?.id === c.id ? 'selected' : '')} key={c.id} onClick={() => { setSelectedConversation(c); setTab('chat'); loadMessages(c.id); }}>
            <span className="mini-avatar">{(c.person?.display_name || c.person?.username || '?')[0].toUpperCase()}</span>{c.person?.display_name || c.person?.username || 'Личный чат'}
          </button>)}
          {!conversations.length && <small className="sidebar-empty">Пока нет переписок</small>}
        </div>
        <div className="profile-card">
          <div className="profile-avatar">{(profile?.display_name || profile?.username || 'K')[0].toUpperCase()}</div>
          <div className="profile-meta"><b>{profile?.display_name || profile?.username || 'KENTY'}</b><small>@{profile?.username || 'user'}</small></div>
          <button className="logout-button" title="Выйти" onClick={logout}>↪</button>
        </div>
      </aside>
      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-title"><span className="hash">{tab === 'chat' ? '#' : '◖'}</span><b>{tab === 'friends' ? 'друзья' : tab === 'chat' ? (selectedConversation?.person?.display_name || selectedConversation?.person?.username || 'сообщения') : 'голосовые-комнаты'}</b></div>
          <div className="topbar-right"><span className={'connection-pill ' + (connected ? 'connected' : '')}><i />{connected ? 'В голосовой комнате' : 'KENTY · пространство для своих'}</span></div>
        </header>

        {error && <div className="global-error">{error}<button onClick={() => setError('')}>×</button></div>}
        {notice && <div className="global-notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        {tab === 'friends' && <div className="social-content">
          <div className="voice-heading"><div><div className="eyebrow">YOUR PEOPLE</div><h1>Друзья</h1><p>Находи знакомых и начинай общаться.</p></div></div>
          <form className="search-panel" onSubmit={searchUsers}><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти по нику или имени…" /><button className="primary-button">Найти</button></form>
          {!!searchResults.length && <section className="social-section"><h2>Результаты поиска</h2>{searchResults.map(p => <div className="person-row" key={p.id}><div className="participant-avatar">{(p.display_name || p.username)[0].toUpperCase()}</div><div className="participant-name"><b>{p.display_name || p.username}</b><small>@{p.username}</small></div><button className="small-action" onClick={() => sendRequest(p.id)}>Добавить</button></div>)}</section>}
          {incoming.length > 0 && <section className="social-section"><h2>Входящие заявки <span>{incoming.length}</span></h2>{incoming.map(f => <div className="person-row" key={f.id}><div className="participant-avatar">{(personForFriendship(f).display_name || '?')[0].toUpperCase()}</div><div className="participant-name"><b>{personForFriendship(f).display_name}</b><small>@{personForFriendship(f).username}</small></div><button className="small-action" onClick={() => respondRequest(f.id, 'accepted')}>Принять</button><button className="subtle-action" onClick={() => respondRequest(f.id, 'rejected')}>Отклонить</button></div>)}</section>}
          <section className="social-section"><h2>Мои друзья <span>{friends.length}</span></h2>
            {friends.map(f => <div className="person-row" key={f.id}><div className="participant-avatar">{(personForFriendship(f).display_name || '?')[0].toUpperCase()}</div><div className="participant-name"><b>{personForFriendship(f).display_name}</b><small>@{personForFriendship(f).username}</small></div><button className="small-action" disabled={busy} onClick={() => openChat(personForFriendship(f))}>Написать</button></div>)}
            {!friends.length && <p className="empty-state">Пока нет друзей. Найди человека по нику выше.</p>}
          </section>
          {outgoing.length > 0 && <section className="social-section"><h2>Отправленные заявки</h2>{outgoing.map(f => <div className="person-row" key={f.id}><div className="participant-name"><b>{personForFriendship(f).display_name}</b><small>@{personForFriendship(f).username} · Ожидает ответа</small></div></div>)}</section>}
        </div>}

        {tab === 'chat' && <div className="chat-content">
          {!selectedConversation ? <div className="empty-state chat-empty"><h2>Твои сообщения</h2><p>Добавь друга и нажми «Написать», чтобы начать личную переписку.</p></div> : <>
            <div className="chat-welcome"><div className="chat-welcome-icon">#</div><h1>{selectedConversation.person?.display_name || selectedConversation.person?.username}</h1><p>Личная переписка KENTY</p></div>
            <div className="chat-messages">{messages.map(m => <article className="chat-message" key={m.id}><div className="message-avatar">{m.sender_id === session.user.id ? (profile?.username || 'Я')[0].toUpperCase() : (selectedConversation.person?.username || 'Д')[0].toUpperCase()}</div><div><b>{m.sender_id === session.user.id ? 'Ты' : selectedConversation.person?.display_name || selectedConversation.person?.username}</b><p>{m.content}</p></div></article>)}</div>
            <form className="chat-composer" onSubmit={sendMessage}><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Написать сообщение…" /><button type="submit">Отправить</button></form>
          </>}
        </div>}

        {tab === 'voice' && <div className="voice-content">
          <div className="voice-heading"><div><div className="eyebrow">REAL-TIME VOICE</div><h1>Голосовые комнаты</h1><p>Заходи к друзьям, общайся и оставайся на связи.</p></div><div className="voice-orb">♫</div></div>
          {!connected && <div className="room-picker">{VOICE_ROOMS.map(r => <button key={r.id} className={'room-card ' + (selectedRoom.id === r.id ? 'active' : '')} onClick={() => setSelectedRoom(r)}><span className="room-card-icon">{r.icon}</span><span className="room-card-title">{r.label}</span><span className="room-card-description">{r.description}</span></button>)}</div>}
          {!connected ? <form className="join-panel" onSubmit={joinVoiceRoom}><div className="panel-heading"><div><span className="eyebrow">ПОДКЛЮЧЕНИЕ</span><h2>Войти в «{selectedRoom.label}»</h2></div></div><div className="form-grid"><label><span>ТВОЁ ИМЯ</span><input value={voiceName} onChange={e => setVoiceName(e.target.value)} placeholder="Твоё имя" /></label><label><span>КОД ДОСТУПА</span><input value={accessCode} onChange={e => setAccessCode(e.target.value)} type="password" placeholder="Общий код доступа" /></label></div>{voiceError && <div className="error-box">{voiceError}</div>}<div className="join-bottom"><div className="join-hint">Для голосовой альфа-версии пока нужен общий код.</div><button className="primary-button" disabled={joining}>{joining ? 'Подключаем…' : 'Войти в комнату →'}</button></div></form> : <section className="live-panel"><div className="panel-heading"><div><span className="eyebrow">ТЫ В КОМНАТЕ</span><h2>{selectedRoom.label}</h2></div><span className="live-badge"><i /> В ЭФИРЕ</span></div><div className="participant-heading">УЧАСТНИКИ · {participants.length}</div><div className="participant-list">{participants.map(p => <div className="participant" key={p.id}><div className="participant-avatar">{p.name[0]?.toUpperCase()}</div><div className="participant-name"><b>{p.name}{p.local ? ' (ты)' : ''}</b><small>{p.speaking ? 'Говорит' : 'На связи'}</small></div><span className="mic-state">{p.muted ? 'Микрофон выкл.' : 'Микрофон вкл.'}</span></div>)}</div><div className="voice-controls"><button className="control-button" onClick={toggleMic}>{micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}</button><button className="leave-button" onClick={leaveVoiceRoom}>Выйти из комнаты</button></div></section>}
          <div className="status-line">{voiceStatus}</div><div className="alpha-note">Голосовые комнаты пока используют общий код доступа. Аккаунты KENTY уже работают отдельно.</div><div className="audio-bin" ref={audioRef} />
        </div>}
      </section>
    </main>
  );
}
