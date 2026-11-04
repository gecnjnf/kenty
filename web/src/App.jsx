import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

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
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('friends');
  const [theme, setTheme] = useState(() => localStorage.getItem('kenty-theme') || 'dark');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const onlineChannelRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState(VOICE_ROOMS[0]);
  const [selectedVoiceOwnerId, setSelectedVoiceOwnerId] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const micEnabledRef = useRef(true);
  const [noiseSuppression, setNoiseSuppression] = useState(() => localStorage.getItem('kenty-noise-suppression') !== 'false');
  const noiseSuppressionRef = useRef(localStorage.getItem('kenty-noise-suppression') !== 'false');
  const [participants, setParticipants] = useState([]);
  const [voiceError, setVoiceError] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Голосовые комнаты готовы к подключению');
  const voiceChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const offeredToRef = useRef(new Set());
  const pendingCandidatesRef = useRef(new Map());
  const audioElementsRef = useRef(new Map());
  const audioRef = useRef(null);
  const participantNamesRef = useRef(new Map());

  useEffect(() => {
    const onInstallAvailable = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const onInstalled = () => { setIsInstalled(true); setInstallPrompt(null); setNotice('KENTY установлено на устройство!'); };
    window.addEventListener('beforeinstallprompt', onInstallAvailable);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallAvailable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function installApp() {
    // Native browser install prompt: this must run directly from the user's click.
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setNotice('Подтверди установку KENTY в окне браузера.');
        } else {
          setNotice('Установка отменена. Нажми «Установить KENTY», когда будешь готов.');
        }
      } catch {
        setNotice('Браузер не открыл окно установки. Используй инструкцию ниже для своего устройства.');
      } finally {
        setInstallPrompt(null);
      }
      return;
    }

    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isDesktop = !isIOS && !isAndroid;

    if (isIOS) {
      setNotice('На iPhone/iPad: нажми «Поделиться» в Safari → «На экран Домой» → «Добавить». iOS не позволяет сайтам открывать установку автоматически.');
    } else if (isAndroid) {
      setNotice('Если окно установки не появилось, открой KENTY в Chrome и выбери ⋮ → «Установить приложение» или «Добавить на главный экран».');
    } else if (isDesktop) {
      setNotice('Если окно установки не появилось, открой меню Chrome, Edge или Яндекс Браузера и выбери «Установить KENTY» / «Установить страницу как приложение».');
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('kenty-theme', theme);
  }, [theme]);

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

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setOnlineUserIds(new Set());
      return;
    }

    let active = true;
    let channel;
    const syncOnline = () => {
      if (!active || !channel) return;
      const state = channel.presenceState();
      const ids = new Set(
        Object.values(state).flat().map((presence) => presence.userId).filter(Boolean)
      );
      setOnlineUserIds(ids);
    };

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token || !active) return;
        await supabase.realtime.setAuth(token);
        channel = supabase.channel('kenty:online', {
          config: { private: true, presence: { key: userId } }
        });
        onlineChannelRef.current = channel;
        channel.on('presence', { event: 'sync' }, syncOnline);
        channel.subscribe(async (status) => {
          if (!active || status !== 'SUBSCRIBED') return;
          const { error: trackError } = await channel.track({
            userId,
            online_at: new Date().toISOString()
          });
          if (trackError) console.error('KENTY online presence error:', trackError);
          syncOnline();
        });
      } catch (presenceError) {
        console.error('KENTY online status connection error:', presenceError);
      }
    })();

    return () => {
      active = false;
      if (onlineChannelRef.current === channel) onlineChannelRef.current = null;
      if (channel) supabase.removeChannel(channel);
      setOnlineUserIds(new Set());
    };
  }, [session?.user?.id]);

  async function loadProfile() {
    const { data, error: err } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (err) setError(err.message);
    else { setProfile(data); setVoiceName(data.display_name || data.username); }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !session?.user?.id) return;
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) { setError('Выбери JPG, PNG, WEBP или GIF.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Изображение должно быть не больше 5 МБ.'); return; }
    setAvatarBusy(true); setError('');
    try {
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
      const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: true, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', session.user.id);
      if (updateError) throw updateError;
      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
      setNotice('Аватар успешно обновлён!');
      loadSocial();
    } catch (uploadError) { setError(uploadError.message || 'Не удалось загрузить аватар.'); }
    finally { setAvatarBusy(false); }
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
      const { data } = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', allUserIds);
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
      const clean = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(clean)) throw new Error('Ник: 3–24 символа, только латиница, цифры и _.');
      if (password.length < 8) throw new Error('Пароль должен содержать минимум 8 символов.');
      const { data, error: err } = await supabase.functions.invoke('username-auth', {
        body: { action: authMode, username: clean, password }
      });
      if (err) throw err;
      if (!data?.session?.access_token || !data?.session?.refresh_token) throw new Error(data?.error || 'Не удалось выполнить вход. Попробуй ещё раз.');
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });
      if (sessionError) throw sessionError;
      setNotice(authMode === 'signup' ? 'Аккаунт KENTY создан. Добро пожаловать!' : 'С возвращением в KENTY!');
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
  const voiceOwners = [{ id: session?.user?.id, label: 'Моя комната' }, ...friends.map(f => ({ id: f.person?.id, label: f.person?.display_name || f.person?.username || 'Друг' })).filter(x => x.id)];
  const activeVoiceOwner = voiceOwners.find(x => x.id === selectedVoiceOwnerId) || voiceOwners[0];

  function updateVoiceParticipants() {
    const channel = voiceChannelRef.current;
    const state = channel?.presenceState?.() || {};
    const peers = Object.values(state).flat().filter(p => p.userId && p.userId !== session?.user?.id);
    const unique = new Map(peers.map(p => [p.userId, p]));
    setParticipants([
      { id: session.user.id, name: voiceName || profile?.display_name || profile?.username || 'Ты', muted: !micEnabledRef.current, speaking: false, local: true },
      ...[...unique.values()].map(p => ({ id: p.userId, name: p.name || 'Участник', muted: Boolean(p.muted), speaking: false, local: false }))
    ]);
  }

  async function sendVoiceSignal(to, signal) {
    const channel = voiceChannelRef.current;
    if (!channel) return;
    await channel.send({ type: 'broadcast', event: 'signal', payload: { from: session.user.id, to, ...signal } });
  }

  function closePeerConnection(remoteId) {
    const pc = peerConnectionsRef.current.get(remoteId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peerConnectionsRef.current.delete(remoteId);
    }
    const audio = audioElementsRef.current.get(remoteId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      audioElementsRef.current.delete(remoteId);
    }
    offeredToRef.current.delete(remoteId);
    pendingCandidatesRef.current.delete(remoteId);
    participantNamesRef.current.delete(remoteId);
  }

  function createPeerConnection(remoteId, remoteName = 'Участник') {
    const existing = peerConnectionsRef.current.get(remoteId);
    if (existing && existing.connectionState !== 'closed') return existing;
    if (existing) closePeerConnection(remoteId);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ]
    });
    const stream = localStreamRef.current;
    stream?.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = event => {
      if (event.candidate) sendVoiceSignal(remoteId, { kind: 'candidate', candidate: event.candidate.toJSON() }).catch(() => {});
    };
    pc.ontrack = event => {
      let audio = audioElementsRef.current.get(remoteId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.setAttribute('data-voice-peer', remoteId);
        audioRef.current?.appendChild(audio);
        audioElementsRef.current.set(remoteId, audio);
      }
      audio.srcObject = event.streams[0] || new MediaStream([event.track]);
      audio.play().catch(() => setVoiceError('Нажми на экран, чтобы разрешить воспроизведение звука.'));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') setVoiceError('Не удалось соединиться с одним из участников. Возможно, сети нужен TURN-сервер.');
      if (pc.connectionState === 'connected') setVoiceError('');
    };
    peerConnectionsRef.current.set(remoteId, pc);
    participantNamesRef.current.set(remoteId, remoteName);
    return pc;
  }

  async function handleVoiceSignal(payload) {
    if (!payload || payload.to !== session.user.id || !payload.from) return;
    const pc = createPeerConnection(payload.from, participantNamesRef.current.get(payload.from) || 'Участник');
    try {
      if (payload.kind === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
        const queued = pendingCandidatesRef.current.get(payload.from) || [];
        for (const candidate of queued) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        pendingCandidatesRef.current.delete(payload.from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendVoiceSignal(payload.from, { kind: 'answer', description: pc.localDescription });
      } else if (payload.kind === 'answer') {
        if (pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
        const queued = pendingCandidatesRef.current.get(payload.from) || [];
        for (const candidate of queued) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        pendingCandidatesRef.current.delete(payload.from);
      } else if (payload.kind === 'candidate') {
        if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        else pendingCandidatesRef.current.set(payload.from, [...(pendingCandidatesRef.current.get(payload.from) || []), payload.candidate]);
      }
    } catch (signalError) {
      console.error('KENTY voice signaling error:', signalError);
      setVoiceError('Не удалось согласовать голосовое соединение. Попробуй выйти и зайти снова.');
    }
  }

  async function joinVoiceRoom(e) {
    e.preventDefault();
    setVoiceError('');
    if (!voiceName.trim()) { setVoiceError('Введи своё имя.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setVoiceError('Браузер не поддерживает доступ к микрофону. Открой KENTY по HTTPS.'); return; }
    setJoining(true);
    setVoiceStatus('Запрашиваем доступ к микрофону…');
    try {
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) throw new Error('Не удалось проверить вход в аккаунт: ' + authError.message);
      const accessToken = authData.session?.access_token;
      if (!accessToken) throw new Error('Сессия закончилась. Выйди из KENTY и войди снова.');
      await supabase.realtime.setAuth(accessToken);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: noiseSuppressionRef.current,
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 }
        },
        video: false
      });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          if (localStreamRef.current === stream) {
            micEnabledRef.current = false;
            setMicEnabled(false);
            setVoiceError('Микрофон отключился. Проверь устройство и подключись снова.');
          }
        };
      });
      const topic = `voice:${activeVoiceOwner?.id || session.user.id}:${selectedRoom.id}`;
      const channel = supabase.channel(topic, {
        config: { private: true, broadcast: { self: false, ack: true }, presence: { key: session.user.id } }
      });
      voiceChannelRef.current = channel;
      channel.on('broadcast', { event: 'signal' }, ({ payload }) => { handleVoiceSignal(payload); });
      channel.on('presence', { event: 'sync' }, async () => {
        const state = channel.presenceState();
        const peers = Object.values(state).flat().filter(p => p.userId && p.userId !== session.user.id);
        const activePeerIds = new Set(peers.map(peer => peer.userId));
        for (const peerId of [...peerConnectionsRef.current.keys()]) {
          if (!activePeerIds.has(peerId)) closePeerConnection(peerId);
        }
        for (const peer of peers) {
          participantNamesRef.current.set(peer.userId, peer.name || 'Участник');
          const pc = createPeerConnection(peer.userId, peer.name || 'Участник');
          if (session.user.id < peer.userId && !offeredToRef.current.has(peer.userId) && pc.signalingState === 'stable') {
            offeredToRef.current.add(peer.userId);
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await sendVoiceSignal(peer.userId, { kind: 'offer', description: pc.localDescription });
            } catch (offerError) {
              offeredToRef.current.delete(peer.userId);
              console.error('KENTY voice offer error:', offerError);
            }
          }
        }
        updateVoiceParticipants();
      });
      const status = await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Тайм-аут: Supabase не подтвердил вход в голосовую комнату за 15 секунд. Проверь интернет и попробуй ещё раз.')), 15000);
        channel.subscribe((result, subscribeError) => {
          if (result === 'SUBSCRIBED') { window.clearTimeout(timeout); resolve(result); }
          if (result === 'CHANNEL_ERROR' || result === 'TIMED_OUT' || result === 'CLOSED') {
            window.clearTimeout(timeout);
            const detail = subscribeError?.message || subscribeError?.cause?.message || '';
            console.error('KENTY Realtime subscribe failed:', result, subscribeError);
            reject(new Error(detail
              ? 'Сервер отклонил вход: ' + detail
              : result === 'TIMED_OUT'
                ? 'Сервер не ответил вовремя. Попробуй ещё раз.'
                : 'Сервер не разрешил открыть комнату (' + result + '). Проверь, что аккаунт активен и ты владелец комнаты или её друг.'));
          }
        });
      });
      if (status !== 'SUBSCRIBED') throw new Error('Не удалось подключиться к голосовой комнате.');
      micEnabledRef.current = true;
      const presenceResult = await channel.track({ userId: session.user.id, name: voiceName.trim(), muted: false, joinedAt: new Date().toISOString() });
      if (presenceResult !== 'ok') {
        console.error('KENTY presence track failed:', presenceResult);
        throw new Error('Сервер подключил канал, но не зарегистрировал тебя в комнате. Статус: ' + String(presenceResult));
      }
      setConnected(true);
      micEnabledRef.current = true;
      setMicEnabled(true);
      setVoiceStatus('Подключено к «' + selectedRoom.label + '» · ' + (activeVoiceOwner?.label || 'Моя комната'));
      updateVoiceParticipants();
    } catch (e2) {
      const channel = voiceChannelRef.current;
      voiceChannelRef.current = null;
      if (channel) await supabase.removeChannel(channel).catch(() => {});
      [...peerConnectionsRef.current.keys()].forEach(closePeerConnection);
      peerConnectionsRef.current.clear();
      offeredToRef.current.clear();
      pendingCandidatesRef.current.clear();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      if (audioRef.current) audioRef.current.innerHTML = '';
      setConnected(false);
      console.error('KENTY voice join failed:', e2);
      setVoiceError(e2.message || 'Не удалось подключиться к голосовой комнате.');
      setVoiceStatus('Не удалось подключиться');
    } finally {
      setJoining(false);
    }
  }

  async function leaveVoiceRoom() {
    const channel = voiceChannelRef.current;
    voiceChannelRef.current = null;
    if (channel) await supabase.removeChannel(channel).catch(() => {});
    [...peerConnectionsRef.current.keys()].forEach(closePeerConnection);
    peerConnectionsRef.current.clear();
    offeredToRef.current.clear();
    pendingCandidatesRef.current.clear();
    participantNamesRef.current.clear();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    audioElementsRef.current.forEach(audio => { audio.pause(); audio.srcObject = null; audio.remove(); });
    audioElementsRef.current.clear();
    if (audioRef.current) audioRef.current.innerHTML = '';
    setConnected(false);
    micEnabledRef.current = false;
    setMicEnabled(false);
    setParticipants([]);
    setVoiceStatus('Ты вышел из комнаты');
  }

  async function toggleNoiseSuppression() {
    const next = !noiseSuppressionRef.current;
    noiseSuppressionRef.current = next;
    setNoiseSuppression(next);
    localStorage.setItem('kenty-noise-suppression', String(next));
    const track = localStreamRef.current?.getAudioTracks()?.[0];
    if (track && connected) {
      try {
        const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
        if (!('noiseSuppression' in supported)) {
          setVoiceError('Этот браузер не поддерживает переключение шумоподавления во время звонка. Переподключись, чтобы применить настройку.');
          return;
        }
        await track.applyConstraints({ noiseSuppression: next });
        const actual = track.getSettings?.().noiseSuppression;
        if (typeof actual === 'boolean' && actual !== next) {
          setVoiceError('Браузер не применил настройку шумоподавления. Возможно, устройство не поддерживает её.');
          return;
        }
        setVoiceError('');
        setVoiceStatus(next ? 'Шумоподавление включено' : 'Шумоподавление выключено');
      } catch (err) {
        console.warn('KENTY noise suppression constraint:', err);
        setVoiceError('Не удалось изменить шумоподавление. Попробуй переподключиться к комнате.');
      }
    } else {
      setVoiceStatus(next ? 'Шумоподавление включено для следующего подключения' : 'Шумоподавление выключено для следующего подключения');
    }
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream || !connected) return;
    // Change the actual MediaStreamTrack synchronously; never wait for Realtime.
    const tracks = stream.getAudioTracks();
    if (!tracks.length) {
      setVoiceError('Микрофон не найден. Выйди и подключись к комнате снова.');
      return;
    }
    const next = !micEnabledRef.current;
    micEnabledRef.current = next;
    tracks.forEach(track => { track.enabled = next; });
    setMicEnabled(next);
    setParticipants(current => current.map(p => p.local ? { ...p, muted: !next } : p));
    setVoiceStatus(next ? 'Микрофон включён' : 'Микрофон выключен');
    // Presence is only a status update. A slow network must not delay mute/unmute.
    const channel = voiceChannelRef.current;
    if (channel) {
      channel.track({ userId: session.user.id, name: voiceName.trim(), muted: !next, joinedAt: new Date().toISOString() })
        .then(() => updateVoiceParticipants())
        .catch(err => console.warn('KENTY mic status sync:', err));
    }
  }

  useEffect(() => () => {
    voiceChannelRef.current && supabase.removeChannel(voiceChannelRef.current);
    peerConnectionsRef.current.forEach(pc => pc.close());
    localStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  if (!session) return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submitAuth}>
        <div className="brand-name auth-logo">KENTY</div>
        {!isInstalled && <button type="button" className="install-button auth-install" onClick={installApp}>⬇ Скачать приложение</button>}
        <div className="eyebrow">YOUR SPACE. YOUR PEOPLE.</div>
        <h1>{authMode === 'login' ? 'С возвращением' : 'Создай аккаунт'}</h1>
        <p className="auth-subtitle">Общайся с друзьями, переписывайся и заходи в голосовые комнаты. Для KENTY нужна только пара ник + пароль.</p>
        <label className="auth-label">НИКНЕЙМ
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="например, alex_01" maxLength={24} autoComplete="username" required />
        </label>
        <label className="auth-label">ПАРОЛЬ
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} maxLength={72} placeholder="Минимум 8 символов" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required />
        </label>
        {error && <div className="error-box">{error}</div>}
        {notice && <div className="notice-box">{notice}</div>}
        <button className="primary-button auth-submit" disabled={authBusy}>
          {authBusy ? 'Подожди…' : authMode === 'login' ? 'Войти в KENTY →' : 'Создать аккаунт →'}
        </button>
        <button type="button" className="text-button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(''); setNotice(''); }}>
          {authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
        <p className="auth-subtitle">Важно: ник и пароль нужно запомнить. Восстановление пароля без почты или телефона пока недоступно.</p>
      </form>
      {!isInstalled && (
        <section className="download-card" aria-label="Установка приложения KENTY">
          <div className="download-card-icon">K</div>
          <div className="download-card-copy">
            <span className="eyebrow">KENTY ДЛЯ ТВОИХ УСТРОЙСТВ</span>
            <h2>Установи KENTY как приложение</h2>
            <p>Открой KENTY с рабочего стола или главного экрана — без необходимости каждый раз искать сайт.</p>
          </div>
          <button type="button" className="download-main-button" onClick={installApp}>⬇ Установить KENTY</button>
          <div className="download-platforms">
            <details>
              <summary>Windows / Mac / Linux</summary>
              <p>Открой сайт в Chrome, Edge или Яндекс Браузере. Нажми «Установить KENTY» в адресной строке или открой меню браузера и выбери установку приложения.</p>
            </details>
            <details>
              <summary>Android</summary>
              <p>Открой сайт в Chrome, нажми меню ⋮ и выбери «Установить приложение» или «Добавить на главный экран».</p>
            </details>
            <details>
              <summary>iPhone / iPad</summary>
              <p>Открой сайт в Safari, нажми «Поделиться», затем «На экран Домой» и подтверди добавление.</p>
            </details>
          </div>
          <p className="download-note">Бесплатно · Установка через браузер · Интернет нужен для общения</p>
        </section>
      )}
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
        <button className={'nav-item ' + (tab === 'settings' ? 'selected' : '')} onClick={() => setTab('settings')}>⚙ Настройки</button>
        <div className="sidebar-label">ПЕРЕПИСКИ</div>
        <div className="conversation-list">
          {conversations.map(c => <button className={'conversation-link ' + (selectedConversation?.id === c.id ? 'selected' : '')} key={c.id} onClick={() => { setSelectedConversation(c); setTab('chat'); loadMessages(c.id); }}>
            <span className="mini-avatar">{c.person?.avatar_url ? <img src={c.person.avatar_url} alt="" /> : (c.person?.display_name || c.person?.username || '?')[0].toUpperCase()}</span>{c.person?.display_name || c.person?.username || 'Личный чат'}
          </button>)}
          {!conversations.length && <small className="sidebar-empty">Пока нет переписок</small>}
        </div>
        <div className="profile-card">
          <div className="profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.display_name || profile?.username || 'K')[0].toUpperCase()}</div>
          <div className="profile-meta"><b>{profile?.display_name || profile?.username || 'KENTY'}</b><small>@{profile?.username || 'user'}</small></div>
          <button className="logout-button" title="Выйти" onClick={logout}>↪</button>
        </div>
      </aside>
      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-title"><span className="hash">{tab === 'chat' ? '#' : '◖'}</span><b>{tab === 'friends' ? 'друзья' : tab === 'chat' ? (selectedConversation?.person?.display_name || selectedConversation?.person?.username || 'сообщения') : tab === 'settings' ? 'настройки' : 'голосовые-комнаты'}</b></div>
          <div className="topbar-right">{!isInstalled && <button type="button" className="install-button" onClick={installApp}>Установить</button>}<span className={'connection-pill ' + (connected ? 'connected' : '')}><i />{connected ? 'В голосовой комнате' : 'KENTY · пространство для своих'}</span></div>
        </header>

        {error && <div className="global-error">{error}<button onClick={() => setError('')}>×</button></div>}
        {notice && <div className="global-notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        {tab === 'friends' && <div className="social-content">
          <section className="friends-hero">
            <div className="friends-hero-glow" />
            <div className="friends-hero-copy"><span className="eyebrow">ТВОЁ ПРОСТРАНСТВО</span><h1>Твои люди. Твои моменты.</h1><p>Находи друзей, начинай переписки и собирайтесь в голосовых комнатах.</p><div className="friends-hero-tags"><span>✦ Личные сообщения</span><span>◉ Голосовые комнаты</span></div></div>
            <div className="friends-hero-art"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-monogram">K</div><span className="hero-spark spark-one">✦</span><span className="hero-spark spark-two">✧</span></div>
          </section>
          <div className="friends-stats">
            <div className="friend-stat"><span className="friend-stat-icon">♧</span><div><b>{friends.length}</b><small>Друзей</small></div></div>
            <div className="friend-stat"><span className="friend-stat-icon online-stat-icon">●</span><div><b>{friends.filter(f => onlineUserIds.has(personForFriendship(f).id)).length}</b><small>Сейчас в сети</small></div></div>
            <div className="friend-stat"><span className="friend-stat-icon request-stat-icon">✉</span><div><b>{incoming.length}</b><small>Новых заявок</small></div></div>
          </div>
          <div className="social-section-heading"><div><span className="eyebrow">ПОИСК ПО KENTY</span><h2>Найди своих</h2></div><span className="section-heading-mark">⌕</span></div>
          <form className="search-panel" onSubmit={searchUsers}><span className="search-panel-icon">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти по нику или имени…" /><button className="primary-button">Найти друзей <span>→</span></button></form>
          {!!searchResults.length && <section className="social-section"><h2>Результаты поиска</h2>{searchResults.map(p => <div className="person-row" key={p.id}><div className="participant-avatar">{p.avatar_url ? <img src={p.avatar_url} alt="" /> : (p.display_name || p.username)[0].toUpperCase()}</div><div className="participant-name"><b>{p.display_name || p.username}</b><small>@{p.username}</small></div><button className="small-action" onClick={() => sendRequest(p.id)}>Добавить</button></div>)}</section>}
          {incoming.length > 0 && <section className="social-section"><h2>Входящие заявки <span>{incoming.length}</span></h2>{incoming.map(f => <div className="person-row" key={f.id}><div className="participant-avatar">{personForFriendship(f).avatar_url ? <img src={personForFriendship(f).avatar_url} alt="" /> : (personForFriendship(f).display_name || '?')[0].toUpperCase()}</div><div className="participant-name"><b>{personForFriendship(f).display_name}</b><small>@{personForFriendship(f).username}</small></div><button className="small-action" onClick={() => respondRequest(f.id, 'accepted')}>Принять</button><button className="subtle-action" onClick={() => respondRequest(f.id, 'rejected')}>Отклонить</button></div>)}</section>}
          <section className="social-section"><h2>Мои друзья <span>{friends.length}</span></h2>
            {friends.map(f => <div className="person-row" key={f.id}><div className={'participant-avatar friend-avatar ' + (onlineUserIds.has(personForFriendship(f).id) ? 'friend-avatar-online' : '')}>{personForFriendship(f).avatar_url ? <img src={personForFriendship(f).avatar_url} alt="" /> : (personForFriendship(f).display_name || '?')[0].toUpperCase()}<i /></div><div className="participant-name"><b>{personForFriendship(f).display_name}</b><small>@{personForFriendship(f).username}</small><small className={'friend-presence ' + (onlineUserIds.has(personForFriendship(f).id) ? 'online' : '')}>{onlineUserIds.has(personForFriendship(f).id) ? '● В сети' : '○ Не в сети'}</small></div><button className="small-action" disabled={busy} onClick={() => openChat(personForFriendship(f))}>Написать</button></div>)}
            {!friends.length && <p className="empty-state">Пока нет друзей. Найди человека по нику выше.</p>}
          </section>
          {outgoing.length > 0 && <section className="social-section"><h2>Отправленные заявки</h2>{outgoing.map(f => <div className="person-row" key={f.id}><div className="participant-name"><b>{personForFriendship(f).display_name}</b><small>@{personForFriendship(f).username} · Ожидает ответа</small></div></div>)}</section>}
        </div>}

        {tab === 'chat' && <div className="chat-content">
          {!selectedConversation ? <div className="empty-state chat-empty"><h2>Твои сообщения</h2><p>Добавь друга и нажми «Написать», чтобы начать личную переписку.</p></div> : <>
            <div className="chat-welcome"><div className="chat-welcome-icon">#</div><h1>{selectedConversation.person?.display_name || selectedConversation.person?.username}</h1><p>Личная переписка KENTY</p></div>
            <div className="chat-messages">{messages.map(m => <article className="chat-message" key={m.id}><div className="message-avatar">{m.sender_id === session.user.id ? (profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.username || 'Я')[0].toUpperCase()) : (selectedConversation.person?.avatar_url ? <img src={selectedConversation.person.avatar_url} alt="" /> : (selectedConversation.person?.username || 'Д')[0].toUpperCase())}</div><div><b>{m.sender_id === session.user.id ? 'Ты' : selectedConversation.person?.display_name || selectedConversation.person?.username}</b><p>{m.content}</p></div></article>)}</div>
            <form className="chat-composer" onSubmit={sendMessage}><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Написать сообщение…" /><button type="submit">Отправить</button></form>
          </>}
        </div>}

        {tab === 'settings' && <div className="settings-content">
          <section className="settings-hero"><span className="eyebrow">ТВОЙ АККАУНТ</span><h1>Настройки</h1><p>Настрой KENTY под себя — от аватара до оформления.</p></section>
          <section className="settings-card"><div className="settings-card-heading"><div><h2>Фото профиля</h2><p>Это фото увидят твои друзья и собеседники.</p></div></div>
            <div className="avatar-editor"><div className="avatar-preview">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Твой аватар" /> : <span>{(profile?.display_name || profile?.username || 'K')[0].toUpperCase()}</span>}</div><div className="avatar-editor-copy"><b>{profile?.display_name || profile?.username || 'Твой профиль'}</b><small>@{profile?.username || 'user'}</small><label className="primary-button avatar-upload-button">{avatarBusy ? 'Загружаем…' : 'Выбрать фото'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadAvatar} disabled={avatarBusy} /></label><small>JPG, PNG, WEBP или GIF · до 5 МБ</small></div></div>
          </section>
          <section className="settings-card"><div className="settings-card-heading"><div><h2>Внешний вид</h2><p>Выбери оформление приложения. Настройка сохранится на этом устройстве.</p></div></div>
            <div className="theme-options"><button type="button" className={'theme-option ' + (theme === 'dark' ? 'active' : '')} onClick={() => setTheme('dark')}><span className="theme-preview dark-preview"><i /><i /><i /></span><b>Тёмная</b><small>Комфортно вечером</small></button><button type="button" className={'theme-option ' + (theme === 'light' ? 'active' : '')} onClick={() => setTheme('light')}><span className="theme-preview light-preview"><i /><i /><i /></span><b>Светлая</b><small>Больше света и контраста</small></button></div>
          </section>
        </div>}

        {tab === 'voice' && <div className="voice-content">
          <div className="voice-heading"><div><div className="eyebrow">REAL-TIME VOICE</div><h1>Голосовые комнаты</h1><p>Заходи к друзьям, общайся и оставайся на связи.</p></div><div className="voice-orb">♫</div></div>
          {!connected && <><div className="room-owner-picker"><label htmlFor="voice-owner">КОМНАТА КОГО</label><select id="voice-owner" value={activeVoiceOwner?.id || ''} onChange={e => setSelectedVoiceOwnerId(e.target.value)}>{voiceOwners.map(owner => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select><small>Войти можно только в свою комнату или комнату принятого друга.</small></div><div className="room-picker">{VOICE_ROOMS.map(r => <button type="button" key={r.id} className={'room-card ' + (selectedRoom.id === r.id ? 'active' : '')} onClick={() => setSelectedRoom(r)}><span className="room-card-icon">{r.icon}</span><span className="room-card-title">{r.label}</span><span className="room-card-description">{r.description}</span></button>)}</div></>}
          {!connected ? <form className="join-panel" onSubmit={joinVoiceRoom}><div className="panel-heading"><div><span className="eyebrow">ПОДКЛЮЧЕНИЕ</span><h2>Войти в «{selectedRoom.label}»</h2></div></div><div className="form-grid"><label><span>ТВОЁ ИМЯ</span><input value={voiceName} onChange={e => setVoiceName(e.target.value)} placeholder="Твоё имя" /></label></div><button type="button" className={"noise-toggle " + (noiseSuppression ? "active" : "")} aria-pressed={noiseSuppression} onClick={toggleNoiseSuppression}><span className="noise-toggle-icon">✦</span><span><b>Шумоподавление</b><small>{noiseSuppression ? 'Включено · подавляет фоновые шумы' : 'Выключено · исходный звук микрофона'}</small></span><span className="noise-toggle-state">{noiseSuppression ? 'ВКЛ' : 'ВЫКЛ'}</span></button>{voiceError && <div className="error-box">{voiceError}</div>}<div className="join-bottom"><div className="join-hint">Выбирай комнату и подключайся — код не нужен.</div><button className="primary-button" disabled={joining}>{joining ? 'Подключаем…' : 'Войти в комнату →'}</button></div></form> : <section className="live-panel"><div className="panel-heading"><div><span className="eyebrow">ТЫ В КОМНАТЕ</span><h2>{selectedRoom.label}</h2></div><span className="live-badge"><i /> В ЭФИРЕ</span></div><div className="participant-heading">УЧАСТНИКИ · {participants.length}</div><div className="participant-list">{participants.map(p => <div className="participant" key={p.id}><div className="participant-avatar">{p.name[0]?.toUpperCase()}</div><div className="participant-name"><b>{p.name}{p.local ? ' (ты)' : ''}</b><small>{p.speaking ? 'Говорит' : 'На связи'}</small></div><span className="mic-state">{p.muted ? 'Микрофон выкл.' : 'Микрофон вкл.'}</span></div>)}</div><div className="voice-controls"><button type="button" className={"control-button " + (!micEnabled ? "control-muted" : "")} aria-pressed={micEnabled} onClick={toggleMic}>{micEnabled ? '🎙 Выключить микрофон' : '🔇 Включить микрофон'}</button><button type="button" className={"control-button noise-live-button " + (noiseSuppression ? "noise-live-active" : "")} aria-pressed={noiseSuppression} onClick={toggleNoiseSuppression}>✦ Шумоподавление: {noiseSuppression ? 'ВКЛ' : 'ВЫКЛ'}</button><button className="leave-button" onClick={leaveVoiceRoom}>Выйти из комнаты</button></div></section>}
          <div className="status-line">{voiceStatus}</div><div className="alpha-note">Голос идёт напрямую между участниками через WebRTC. Комнаты доступны владельцу и принятым друзьям.</div><div className="audio-bin" ref={audioRef} />
        </div>}
      </section>
    </main>
  );
}
