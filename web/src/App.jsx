import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const messageTimeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

function formatMessageTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : messageTimeFormatter.format(date);
}

const IMAGE_MESSAGE_PREFIX = 'kenty-image:v1:';

function getImagePath(content) {
  if (typeof content !== 'string' || !content.startsWith(IMAGE_MESSAGE_PREFIX)) return null;
  const path = content.slice(IMAGE_MESSAGE_PREFIX.length);
  const parts = path.split('/');
  return parts.length === 3 && parts.every(Boolean) ? path : null;
}

const VOICE_ROOMS = [
  { id: 'lobby', label: 'Общая', description: 'Для разговоров обо всём', icon: '◉' },
  { id: 'gaming', label: 'Игровая', description: 'Собираемся поиграть', icon: '🎮' },
  { id: 'chill', label: 'Тихая', description: 'Спокойное общение', icon: '☾' }
];

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('friends');
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [serverChannels, setServerChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [channelMessages, setChannelMessages] = useState([]);
  const [channelMessage, setChannelMessage] = useState('');
  const [serverNameDraft, setServerNameDraft] = useState('');
  const [channelNameDraft, setChannelNameDraft] = useState('');
  const [inviteCodeDraft, setInviteCodeDraft] = useState('');
  const [showServerCreate, setShowServerCreate] = useState(false);
  const [showChannelCreate, setShowChannelCreate] = useState(false);
  const [serverBusy, setServerBusy] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');
  const [theme, setTheme] = useState(() => localStorage.getItem('kenty-theme') || 'dark');
  const [accentTheme, setAccentTheme] = useState(() => localStorage.getItem('kenty-accent') || 'ember');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [friendships, setFriendships] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const onlineChannelRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const activeConversationIdRef = useRef(null);
  const messageLoadRequestRef = useRef(0);
  const [message, setMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [messageActionBusy, setMessageActionBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment');
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState('');
  const [imageUrls, setImageUrls] = useState({});
  const [expandedImage, setExpandedImage] = useState('');
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [selectedRoom, setSelectedRoom] = useState(VOICE_ROOMS[0]);
  const [selectedVoiceOwnerId, setSelectedVoiceOwnerId] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [voiceCameraFacing, setVoiceCameraFacing] = useState('user');
  const [voiceCameraSwitching, setVoiceCameraSwitching] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [remoteScreenShares, setRemoteScreenShares] = useState({});
  const [remoteVideoStreams, setRemoteVideoStreams] = useState({});
  const localScreenShareRef = useRef(null);
  const localVideoStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const micEnabledRef = useRef(true);
  const [noiseSuppression, setNoiseSuppression] = useState(() => localStorage.getItem('kenty-noise-suppression') !== 'false');
  const noiseSuppressionRef = useRef(localStorage.getItem('kenty-noise-suppression') !== 'false');
  const [participants, setParticipants] = useState([]);
  const [voiceError, setVoiceError] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Голосовые комнаты готовы к подключению');
  const voiceChannelRef = useRef(null);
  const liveKitRoomRef = useRef(null);
  const liveKitSdkRef = useRef(null);
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
    document.documentElement.dataset.accent = accentTheme;
    localStorage.setItem('kenty-accent', accentTheme);
  }, [accentTheme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    loadProfile();
    loadSocial();
    loadServers();
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
    else {
      setProfile(data);
      setDisplayName(data.display_name || data.username || '');
      setBio(data.bio || '');
      setVoiceName(data.display_name || data.username);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    const cleanName = displayName.trim();
    const cleanBio = bio.trim();
    if (cleanName.length < 2 || cleanName.length > 32) {
      setError('Имя должно содержать от 2 до 32 символов.');
      return;
    }
    if (cleanBio.length > 160) {
      setError('Описание профиля должно быть не длиннее 160 символов.');
      return;
    }
    setProfileBusy(true);
    setError('');
    try {
      const { data, error: updateError } = await supabase.from('profiles')
        .update({ display_name: cleanName, bio: cleanBio, updated_at: new Date().toISOString() })
        .eq('id', session.user.id)
        .select('id,username,display_name,avatar_url,bio')
        .single();
      if (updateError) throw updateError;
      setProfile(prev => ({ ...prev, ...data }));
      setVoiceName(cleanName);
      setNotice('Профиль сохранён!');
      await loadSocial();
    } catch (saveError) {
      setError('Не удалось сохранить профиль: ' + (saveError.message || 'ошибка'));
    } finally {
      setProfileBusy(false);
    }
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

  async function loadServers() {
    if (!session?.user?.id) return;
    const { data, error: loadError } = await supabase.from('server_members')
      .select('server_id,role,joined_at,server:servers(id,name,description,icon_url,owner_id,created_at)')
      .eq('user_id', session.user.id)
      .order('joined_at', { ascending: false });
    if (loadError) { setError('Не удалось загрузить серверы: ' + loadError.message); return; }
    const items = (data || []).map(item => ({ ...item.server, role: item.role })).filter(item => item.id);
    setServers(items);
    setSelectedServerId(current => items.some(item => item.id === current) ? current : (items[0]?.id || ''));
  }

  async function createServer(event) {
    event.preventDefault();
    const name = serverNameDraft.trim();
    if (name.length < 2 || name.length > 64 || serverBusy) return;
    setServerBusy(true);
    try {
      const { data: created, error: createError } = await supabase.from('servers')
        .insert({ name, owner_id: session.user.id })
        .select('id,name,description,icon_url,owner_id,created_at')
        .single();
      if (createError) throw createError;
      const { error: memberError } = await supabase.from('server_members')
        .insert({ server_id: created.id, user_id: session.user.id, role: 'owner' });
      if (memberError) {
        await supabase.from('servers').delete().eq('id', created.id);
        throw memberError;
      }
      const { error: channelError } = await supabase.from('channels').insert({
        server_id: created.id, name: 'общий', channel_type: 'text', created_by: session.user.id, position: 0
      });
      if (channelError) throw channelError;
      setServerNameDraft('');
      setShowServerCreate(false);
      await loadServers();
      setSelectedServerId(created.id);
      setTab('server');
      setNotice('Сервер «' + name + '» создан. Пригласи друзей!');
    } catch (createError) {
      setError('Не удалось создать сервер: ' + (createError.message || 'ошибка'));
    } finally { setServerBusy(false); }
  }

  async function createServerChannel(event) {
    event.preventDefault();
    const name = channelNameDraft.trim().toLowerCase().replace(/\\s+/g, '-');
    const currentServer = servers.find(item => item.id === selectedServerId);
    if (!currentServer || !name || serverBusy) return;
    if (!['owner','admin','moderator'].includes(currentServer.role)) {
      setError('Создавать каналы могут только модераторы и администраторы.');
      return;
    }
    setServerBusy(true);
    try {
      const { data, error: channelError } = await supabase.from('channels').insert({
        server_id: selectedServerId, name, channel_type: 'text', created_by: session.user.id, position: serverChannels.length
      }).select('id,server_id,name,channel_type,topic,position,created_at').single();
      if (channelError) throw channelError;
      setServerChannels(current => [...current, data]);
      setSelectedChannelId(data.id);
      setChannelNameDraft('');
      setShowChannelCreate(false);
      setTab('server');
    } catch (createError) {
      setError('Не удалось создать канал: ' + (createError.message || 'ошибка'));
    } finally { setServerBusy(false); }
  }

  async function joinServerWithCode(event) {
    event.preventDefault();
    const code = inviteCodeDraft.trim();
    if (!code || serverBusy) return;
    setServerBusy(true);
    try {
      const { data, error: joinError } = await supabase.rpc('join_server_by_invite', { invite_code: code });
      if (joinError) throw joinError;
      setInviteCodeDraft('');
      await loadServers();
      setSelectedServerId(data);
      setTab('server');
      setNotice('Ты присоединился к серверу!');
    } catch (joinError) {
      setError(joinError.message || 'Не удалось использовать приглашение.');
    } finally { setServerBusy(false); }
  }

  async function createServerInvite() {
    const currentServer = servers.find(item => item.id === selectedServerId);
    if (!currentServer || !['owner','admin','moderator'].includes(currentServer.role)) return;
    setServerBusy(true);
    try {
      const { data, error: inviteError } = await supabase.from('server_invites')
        .insert({ server_id: selectedServerId, created_by: session.user.id })
        .select('code')
        .single();
      if (inviteError) throw inviteError;
      const inviteUrl = window.location.origin + '/?invite=' + encodeURIComponent(data.code);
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setNotice('Ссылка-приглашение скопирована: ' + inviteUrl);
      } catch {
        setNotice('Ссылка-приглашение: ' + inviteUrl);
      }
    } catch (inviteError) {
      setError('Не удалось создать приглашение: ' + (inviteError.message || 'ошибка'));
    } finally { setServerBusy(false); }
  }

  async function sendChannelMessage(event) {
    event.preventDefault();
    const content = channelMessage.trim();
    if (!content || !selectedChannelId || content.length > 10000) return;
    const { data, error: sendError } = await supabase.from('channel_messages')
      .insert({ channel_id: selectedChannelId, sender_id: session.user.id, content })
      .select('id,channel_id,sender_id,content,created_at,edited_at')
      .single();
    if (sendError) setError('Не удалось отправить сообщение: ' + sendError.message);
    else {
      setChannelMessage('');
      setChannelMessages(current => [...current.filter(item => item.id !== data.id), data].slice(-100));
    }
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
    e.preventDefault();
    const q = search.trim();
    setError('');
    setSearchMessage('');
    setSearchResults([]);
    if (q.length < 2) { setSearchMessage('Введи минимум 2 символа для поиска.'); return; }
    if (!session?.user?.id) { setSearchMessage('Сначала войди в аккаунт.'); return; }
    setSearchBusy(true);
    try {
      const columns = 'id,username,display_name,avatar_url';
      const pattern = '%' + q + '%';
      const [users, names] = await Promise.all([
        supabase.from('profiles').select(columns).neq('id', session.user.id).ilike('username', pattern).limit(12),
        supabase.from('profiles').select(columns).neq('id', session.user.id).ilike('display_name', pattern).limit(12)
      ]);
      if (users.error) throw users.error;
      if (names.error) throw names.error;
      const found = new Map();
      [...(users.data || []), ...(names.data || [])].forEach(person => found.set(person.id, person));
      const results = [...found.values()].slice(0, 12);
      setSearchResults(results);
      setSearchMessage(results.length ? 'Найдено пользователей: ' + results.length : 'Никого не нашли. Проверь ник или имя.');
    } catch (err) {
      setError('Не удалось найти пользователей: ' + (err.message || 'ошибка запроса'));
    } finally {
      setSearchBusy(false);
    }
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
    } catch (e) { setError(e.message || 'Не удалось открыть переписку.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const serverId = selectedServerId;
    if (!serverId) { setServerChannels([]); setSelectedChannelId(''); return undefined; }
    let active = true;
    (async () => {
      const { data, error: loadError } = await supabase.from('channels')
        .select('id,server_id,name,channel_type,topic,position,created_at')
        .eq('server_id', serverId)
        .order('position', { ascending: true });
      if (!active) return;
      if (loadError) { setError('Не удалось загрузить каналы: ' + loadError.message); return; }
      setServerChannels(data || []);
      setSelectedChannelId(current => (data || []).some(channel => channel.id === current) ? current : (data?.[0]?.id || ''));
    })();
    return () => { active = false; };
  }, [selectedServerId]);

  useEffect(() => {
    const channelId = selectedChannelId;
    if (!channelId) { setChannelMessages([]); return undefined; }
    let active = true;
    const load = async () => {
      const { data, error: loadError } = await supabase.from('channel_messages')
        .select('id,channel_id,sender_id,content,created_at,edited_at')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (!active) return;
      if (loadError) { setError('Не удалось загрузить сообщения канала: ' + loadError.message); return; }
      setChannelMessages(data || []);
    };
    const realtime = supabase.channel('kenty:server-channel:' + channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_messages', filter: 'channel_id=eq.' + channelId }, payload => {
        if (!active) return;
        if (payload.eventType === 'INSERT' && payload.new?.id) {
          setChannelMessages(current => [...current.filter(item => item.id !== payload.new.id), payload.new].slice(-100));
        } else if (payload.eventType === 'UPDATE' && payload.new?.id) {
          setChannelMessages(current => current.map(item => item.id === payload.new.id ? payload.new : item));
        } else if (payload.eventType === 'DELETE' && payload.old?.id) {
          setChannelMessages(current => current.filter(item => item.id !== payload.old.id));
        }
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') load(); });
    return () => { active = false; supabase.removeChannel(realtime); };
  }, [selectedChannelId]);

  useEffect(() => {
    if (!session?.user?.id || !pendingInviteCode) return undefined;
    let active = true;
    (async () => {
      const { data, error: inviteError } = await supabase.rpc('join_server_by_invite', { invite_code: pendingInviteCode });
      if (!active) return;
      if (inviteError) setError('Не удалось принять приглашение: ' + inviteError.message);
      else {
        setSelectedServerId(data);
        setTab('server');
        setNotice('Ты присоединился к серверу!');
        await loadServers();
      }
      setPendingInviteCode('');
      window.history.replaceState({}, '', window.location.pathname);
    })();
    return () => { active = false; };
  }, [session?.user?.id, pendingInviteCode]);

  useEffect(() => {
    const conversationId = selectedConversation?.id;
    activeConversationIdRef.current = conversationId || null;
    messageLoadRequestRef.current += 1;
    setMessages([]);
    if (!conversationId) return undefined;

    let active = true;
    const channel = supabase.channel('kenty:chat:' + conversationId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'conversation_id=eq.' + conversationId
      }, ({ new: incoming }) => {
        if (!active || activeConversationIdRef.current !== conversationId || !incoming?.id) return;
        setMessages(current => {
          const merged = new Map(current.map(item => [item.id, item]));
          merged.set(incoming.id, incoming);
          return [...merged.values()]
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .slice(-100);
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId
      }, ({ new: updated }) => {
        if (!active || activeConversationIdRef.current !== conversationId || !updated?.id) return;
        setMessages(current => current.map(item => item.id === updated.id ? updated : item));
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId
      }, ({ old: removed }) => {
        if (!active || activeConversationIdRef.current !== conversationId || !removed?.id) return;
        setMessages(current => current.filter(item => item.id !== removed.id));
      })
      .subscribe(status => {
        if (active && status === 'SUBSCRIBED') loadMessages(conversationId);
        if (active && status === 'CHANNEL_ERROR') {
          setError('Не удалось включить обновление чата в реальном времени. Попробуй обновить страницу.');
        }
      });

    return () => {
      active = false;
      if (activeConversationIdRef.current === conversationId) activeConversationIdRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages, selectedConversation?.id]);

  useEffect(() => {
    let active = true;
    const imageMessages = messages.map(item => ({ id: item.id, path: getImagePath(item.content) })).filter(item => item.path);
    if (!imageMessages.length) {
      setImageUrls({});
      return undefined;
    }
    (async () => {
      const entries = await Promise.all(imageMessages.map(async item => {
        const { data, error: signedError } = await supabase.storage.from('chat-media').createSignedUrl(item.path, 3600);
        return [item.id, signedError ? '' : data?.signedUrl || ''];
      }));
      if (active) setImageUrls(current => ({ ...current, ...Object.fromEntries(entries) }));
    })();
    return () => { active = false; };
  }, [messages]);

  useEffect(() => {
    if (!cameraOpen || capturedPhoto) return undefined;
    let active = true;
    let stream = null;
    setCameraBusy(true);
    setCameraError('');
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Камера недоступна. Открой KENTY через HTTPS в современном браузере.');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1920, max: 2560 },
            height: { ideal: 1080, max: 1440 }
          }
        });
        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        const video = cameraVideoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
      } catch (cameraFailure) {
        if (active) {
          const name = cameraFailure?.name;
          setCameraError(name === 'NotAllowedError' || name === 'PermissionDeniedError'
            ? 'Нет доступа к камере. Разреши использование камеры в настройках браузера и попробуй снова.'
            : name === 'NotFoundError' || name === 'DevicesNotFoundError'
              ? 'Камера не найдена на этом устройстве.'
              : name === 'NotReadableError' || name === 'TrackStartError'
                ? 'Камера уже используется другим приложением. Закрой его и повтори попытку.'
                : cameraFailure?.message || 'Не удалось запустить камеру.');
        }
      } finally {
        if (active) setCameraBusy(false);
      }
    })();
    return () => {
      active = false;
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (cameraStreamRef.current === stream) cameraStreamRef.current = null;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    };
  }, [cameraOpen, cameraFacing, cameraAttempt, capturedPhoto]);

  useEffect(() => {
    if (!capturedPhoto) {
      setCameraPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(capturedPhoto);
    setCameraPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [capturedPhoto]);

  useEffect(() => {
    const stopCamera = () => cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    const onVisibility = () => {
      if (document.hidden && cameraOpen) {
        stopCamera();
        cameraStreamRef.current = null;
        setCameraOpen(false);
        setCapturedPhoto(null);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [cameraOpen]);


  async function loadMessages(id) {
    const requestId = ++messageLoadRequestRef.current;
    const { data, error: err } = await supabase.from('messages')
      .select('id,sender_id,content,created_at,edited_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (requestId !== messageLoadRequestRef.current || activeConversationIdRef.current !== id) return;
    if (err) {
      setError('Не удалось загрузить сообщения: ' + err.message);
      return;
    }
    const latestFirst = (data || []).reverse();
    setMessages(current => {
      const merged = new Map(latestFirst.map(item => [item.id, item]));
      current.forEach(item => merged.set(item.id, item));
      return [...merged.values()]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-100);
    });
  }

  function openChatCamera() {
    if (!selectedConversation) return;
    setCameraError('');
    setCapturedPhoto(null);
    setCameraFacing('environment');
    setCameraAttempt(value => value + 1);
    setCameraOpen(true);
  }

  function closeChatCamera() {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
    setCapturedPhoto(null);
    setCameraError('');
    setCameraBusy(false);
  }

  async function captureChatPhoto() {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Камера ещё запускается. Подожди немного.');
      return;
    }
    const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Не удалось обработать снимок. Попробуй ещё раз.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        setCameraError('Не удалось создать фотографию. Попробуй ещё раз.');
        return;
      }
      setCapturedPhoto(new File([blob], 'kenty-photo-' + Date.now() + '.jpg', { type: 'image/jpeg' }));
      setCameraError('');
    }, 'image/jpeg', 0.88);
  }

  async function sendCapturedPhoto() {
    if (!capturedPhoto || !selectedConversation || !session?.user?.id) return;
    if (!['image/jpeg','image/png','image/webp'].includes(capturedPhoto.type) || capturedPhoto.size > 8 * 1024 * 1024) {
      setCameraError('Фотография должна быть JPG, PNG или WEBP размером до 8 МБ.');
      return;
    }
    setCameraBusy(true);
    setCameraError('');
    const conversationId = selectedConversation.id;
    const path = session.user.id + '/' + conversationId + '/' +
      (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + '.jpg';
    try {
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, capturedPhoto, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });
      if (uploadError) throw uploadError;
      const { data: sent, error: messageError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: session.user.id,
        content: IMAGE_MESSAGE_PREFIX + path
      }).select('id,sender_id,content,created_at,edited_at').single();
      if (messageError) {
        await supabase.storage.from('chat-media').remove([path]);
        throw messageError;
      }
      if (sent && activeConversationIdRef.current === conversationId) {
        setMessages(current => {
          const merged = new Map(current.map(item => [item.id, item]));
          merged.set(sent.id, sent);
          return [...merged.values()]
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .slice(-100);
        });
      }
      closeChatCamera();
      setNotice('Фотография отправлена!');
    } catch (photoError) {
      setCameraError('Не удалось отправить фотографию: ' + (photoError.message || 'ошибка загрузки'));
      setCameraBusy(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const text = message.trim();
    if (!text || !selectedConversation || text.length > 10000) return;
    const conversationId = selectedConversation.id;
    const { data: sent, error: err } = await supabase.from('messages').insert({
      conversation_id: conversationId, sender_id: session.user.id, content: text
    }).select('id,sender_id,content,created_at').single();
    if (err) {
      setError('Не удалось отправить сообщение: ' + err.message);
    } else {
      setMessage('');
      if (sent && activeConversationIdRef.current === conversationId) {
        setMessages(current => {
          const merged = new Map(current.map(item => [item.id, item]));
          merged.set(sent.id, sent);
          return [...merged.values()]
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .slice(-100);
        });
      }
    }
  }

  function beginEditMessage(item) {
    if (item.sender_id !== session?.user?.id || getImagePath(item.content)) return;
    setEditingMessageId(item.id);
    setEditDraft(item.content);
  }

  async function saveEditedMessage(item) {
    const nextContent = editDraft.trim();
    if (!nextContent || nextContent.length > 10000 || messageActionBusy) return;
    setMessageActionBusy(true);
    const { data, error: updateError } = await supabase.from('messages')
      .update({ content: nextContent, edited_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('sender_id', session.user.id)
      .select('id,sender_id,content,created_at,edited_at')
      .single();
    if (updateError) setError('Не удалось изменить сообщение: ' + updateError.message);
    else {
      setMessages(current => current.map(messageItem => messageItem.id === item.id ? data : messageItem));
      setEditingMessageId(null);
      setEditDraft('');
    }
    setMessageActionBusy(false);
  }

  async function deleteMessage(item) {
    if (item.sender_id !== session?.user?.id || messageActionBusy) return;
    if (!window.confirm('Удалить это сообщение?')) return;
    setMessageActionBusy(true);
    const { error: deleteError } = await supabase.from('messages').delete().eq('id', item.id).eq('sender_id', session.user.id);
    if (deleteError) setError('Не удалось удалить сообщение: ' + deleteError.message);
    else {
      setMessages(current => current.filter(messageItem => messageItem.id !== item.id));
      if (editingMessageId === item.id) setEditingMessageId(null);
    }
    setMessageActionBusy(false);
  }

  function personForFriendship(f) { return f.person || { username: 'Пользователь', display_name: 'Пользователь' }; }
  const incoming = friendships.filter(f => f.status === 'pending' && f.addressee_id === session?.user?.id);
  const outgoing = friendships.filter(f => f.status === 'pending' && f.requester_id === session?.user?.id);
  const friends = friendships.filter(f => f.status === 'accepted');
  const voiceOwners = [{ id: session?.user?.id, label: 'Моя комната' }, ...friends.map(f => ({ id: f.person?.id, label: f.person?.display_name || f.person?.username || 'Друг' })).filter(x => x.id)];
  const activeVoiceOwner = voiceOwners.find(x => x.id === selectedVoiceOwnerId) || voiceOwners[0];

  function updateVoiceParticipants() {
    const room = liveKitRoomRef.current;
    if (!room) return;
    const local = room.localParticipant;
    const activeIds = new Set((room.activeSpeakers || []).map(person => person.identity));
    const remote = [...room.remoteParticipants.values()];
    setParticipants([
      {
        id: local.identity,
        name: local.name || voiceName || profile?.display_name || 'Ты',
        muted: !local.isMicrophoneEnabled,
        speaking: activeIds.has(local.identity),
        local: true
      },
      ...remote.map(person => ({
        id: person.identity,
        name: person.name || 'Участник',
        muted: !person.isMicrophoneEnabled,
        speaking: activeIds.has(person.identity),
        local: false
      }))
    ]);
    setRemoteScreenShares(Object.fromEntries(
      remote.filter(person => person.isScreenShareEnabled).map(person => [person.identity, true])
    ));
  }

  function handleLiveKitTrackSubscribed(track, publication, participant) {
    const Track = liveKitSdkRef.current?.Track;
    if (!Track) return;
    if (track.kind === Track.Kind.Audio) {
      const element = track.attach();
      const key = participant.identity + ':' + (publication.trackSid || track.sid || 'audio');
      element.autoplay = true;
      element.playsInline = true;
      element.setAttribute('data-voice-peer', participant.identity);
      audioRef.current?.appendChild(element);
      audioElementsRef.current.set(key, element);
      element.play?.().catch?.(() => setVoiceError('Нажми на экран, чтобы разрешить воспроизведение звука.'));
      return;
    }
    if (track.kind === Track.Kind.Video) {
      const stream = new MediaStream([track.mediaStreamTrack]);
      setRemoteVideoStreams(current => ({ ...current, [participant.identity]: stream }));
      if (publication.source === Track.Source.ScreenShare) {
        setRemoteScreenShares(current => ({ ...current, [participant.identity]: true }));
      }
    }
  }

  function handleLiveKitTrackUnsubscribed(track, publication, participant) {
    const Track = liveKitSdkRef.current?.Track;
    if (!Track) return;
    const key = participant.identity + ':' + (publication.trackSid || track.sid || 'audio');
    track.detach();
    const element = audioElementsRef.current.get(key);
    if (element) {
      element.pause?.();
      element.srcObject = null;
      element.remove();
      audioElementsRef.current.delete(key);
    }
    if (track.kind === Track.Kind.Video) {
      setRemoteVideoStreams(current => {
        const next = { ...current };
        if (next[participant.identity]?.getTracks?.().includes(track.mediaStreamTrack)) {
          delete next[participant.identity];
        }
        return next;
      });
      if (publication.source === Track.Source.ScreenShare) {
        setRemoteScreenShares(current => ({ ...current, [participant.identity]: false }));
      }
    }
  }

  async function joinVoiceRoom(e) {
    e.preventDefault();
    setVoiceError('');
    if (!voiceName.trim() || voiceName.trim().length < 2) {
      setVoiceError('Введи имя минимум из двух символов.');
      return;
    }
    if (!session?.user?.id) {
      setVoiceError('Сначала войди в аккаунт KENTY.');
      return;
    }

    setJoining(true);
    setVoiceStatus('Проверяем доступ и готовим защищённое подключение…');
    let room = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) throw new Error('Не удалось проверить вход: ' + authError.message);
      const accessToken = authData.session?.access_token;
      if (!accessToken) throw new Error('Сессия закончилась. Войди в KENTY заново.');

      const roomName = (activeVoiceOwner?.id || session.user.id) + ':' + selectedRoom.id;
      const tokenResponse = await fetch('/api/token', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken
        },
        body: JSON.stringify({ roomName, displayName: voiceName.trim() })
      });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenData.participantToken || !tokenData.serverUrl) {
        throw new Error(tokenData.error || 'Сервер не выдал токен для голосовой комнаты.');
      }

      const liveKitSdk = await import('livekit-client');
      liveKitSdkRef.current = liveKitSdk;
      room = new liveKitSdk.Room({ adaptiveStream: true, dynacast: true });
      liveKitRoomRef.current = room;

      room
        .on(liveKitSdk.RoomEvent.TrackSubscribed, (track, publication, participant) => {
          handleLiveKitTrackSubscribed(track, publication, participant);
          updateVoiceParticipants();
        })
        .on(liveKitSdk.RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          handleLiveKitTrackUnsubscribed(track, publication, participant);
          updateVoiceParticipants();
        })
        .on(liveKitSdk.RoomEvent.ParticipantConnected, updateVoiceParticipants)
        .on(liveKitSdk.RoomEvent.ParticipantDisconnected, participant => {
          setRemoteVideoStreams(current => {
            const next = { ...current };
            delete next[participant.identity];
            return next;
          });
          setRemoteScreenShares(current => {
            const next = { ...current };
            delete next[participant.identity];
            return next;
          });
          updateVoiceParticipants();
        })
        .on(liveKitSdk.RoomEvent.ActiveSpeakersChanged, updateVoiceParticipants)
        .on(liveKitSdk.RoomEvent.LocalTrackUnpublished, publication => {
          if (publication.source === liveKitSdk.Track.Source.Camera) setCameraEnabled(false);
          if (publication.source === liveKitSdk.Track.Source.ScreenShare) setScreenSharing(false);
          updateVoiceParticipants();
        })
        .on(liveKitSdk.RoomEvent.ConnectionStateChanged, state => {
          setVoiceStatus(state === 'connected' ? 'Связь с голосовой комнатой установлена' : 'Состояние соединения: ' + state);
        })
        .on(liveKitSdk.RoomEvent.AudioPlaybackStatusChanged, () => {
          if (!room.canPlaybackAudio) {
            setVoiceError('Звук заблокирован браузером. Нажми на экран и повтори подключение звука.');
          } else {
            setVoiceError('');
          }
        })
        .on(liveKitSdk.RoomEvent.Disconnected, () => {
          setConnected(false);
          setMicEnabled(false);
          setCameraEnabled(false);
          setScreenSharing(false);
          setParticipants([]);
          setRemoteVideoStreams({});
          setRemoteScreenShares({});
        });

      await room.prepareConnection(tokenData.serverUrl, tokenData.participantToken).catch(() => {});
      await room.connect(tokenData.serverUrl, tokenData.participantToken);
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: noiseSuppressionRef.current,
        autoGainControl: true,
        channelCount: 1
      });
      await room.startAudio().catch(() => {});

      setConnected(true);
      setMicEnabled(true);
      setCameraEnabled(false);
      setScreenSharing(false);
      setVoiceError('');
      setVoiceStatus('Подключено к «' + selectedRoom.label + '» · ' + (activeVoiceOwner?.label || 'Моя комната'));
      updateVoiceParticipants();
    } catch (joinError) {
      if (room) {
        try { await room.disconnect(); } catch {}
      }
      if (liveKitRoomRef.current === room) liveKitRoomRef.current = null;
      audioElementsRef.current.forEach(element => {
        element.pause?.();
        element.srcObject = null;
        element.remove();
      });
      audioElementsRef.current.clear();
      setConnected(false);
      setMicEnabled(false);
      setCameraEnabled(false);
      setScreenSharing(false);
      setParticipants([]);
      setRemoteVideoStreams({});
      setRemoteScreenShares({});
      console.error('KENTY LiveKit join failed:', joinError);
      setVoiceError(joinError.message || 'Не удалось подключиться к голосовой комнате.');
      setVoiceStatus('Не удалось подключиться');
    } finally {
      setJoining(false);
    }
  }

  async function leaveVoiceRoom() {
    const room = liveKitRoomRef.current;
    liveKitRoomRef.current = null;
    if (room) {
      try { await room.disconnect(); } catch (disconnectError) {
        console.warn('KENTY LiveKit disconnect:', disconnectError);
      }
    }
    audioElementsRef.current.forEach(element => {
      element.pause?.();
      element.srcObject = null;
      element.remove();
    });
    audioElementsRef.current.clear();
    setRemoteVideoStreams({});
    setRemoteScreenShares({});
    setConnected(false);
    setMicEnabled(false);
    setCameraEnabled(false);
    setScreenSharing(false);
    setParticipants([]);
    setVoiceStatus('Ты вышел из комнаты');
  }

  async function toggleNoiseSuppression() {
    const next = !noiseSuppressionRef.current;
    noiseSuppressionRef.current = next;
    setNoiseSuppression(next);
    localStorage.setItem('kenty-noise-suppression', String(next));
    const room = liveKitRoomRef.current;
    const Track = liveKitSdkRef.current?.Track;
    const localTrack = Track ? room?.localParticipant.getTrackPublication(Track.Source.Microphone)?.track : null;
    const mediaTrack = localTrack?.mediaStreamTrack;
    if (mediaTrack && connected) {
      try {
        await mediaTrack.applyConstraints({ noiseSuppression: next });
        setVoiceError('');
        setVoiceStatus(next ? 'Шумоподавление включено' : 'Шумоподавление выключено');
      } catch (constraintError) {
        console.warn('KENTY noise suppression constraint:', constraintError);
        setVoiceError('Не удалось изменить шумоподавление. Настройка сохранена для следующего подключения.');
      }
    } else {
      setVoiceStatus(next ? 'Шумоподавление включено для следующего подключения' : 'Шумоподавление выключено для следующего подключения');
    }
  }

  async function toggleVoiceCamera() {
    const room = liveKitRoomRef.current;
    if (!room || !connected) return;
    const next = !cameraEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next, { facingMode: voiceCameraFacing });
      setCameraEnabled(next);
      setVoiceError('');
      setVoiceStatus(next ? 'Камера включена · видео передаётся участникам' : 'Камера выключена');
    } catch (cameraError) {
      setVoiceError(cameraError.name === 'NotAllowedError'
        ? 'Нет доступа к камере. Разреши KENTY использовать камеру в настройках браузера.'
        : cameraError.message || 'Не удалось изменить состояние камеры.');
    }
  }

  async function switchVoiceCamera() {
    const room = liveKitRoomRef.current;
    if (!room || !connected || !cameraEnabled || voiceCameraSwitching || screenSharing) return;
    const nextFacing = voiceCameraFacing === 'user' ? 'environment' : 'user';
    const Track = liveKitSdkRef.current?.Track;
    const cameraTrack = Track ? room.localParticipant.getTrackPublication(Track.Source.Camera)?.track : null;
    if (!cameraTrack?.restartTrack) {
      setVoiceError('Не удалось переключить камеру. Выключи и снова включи её.');
      return;
    }
    setVoiceCameraSwitching(true);
    try {
      await cameraTrack.restartTrack({ facingMode: nextFacing });
      setVoiceCameraFacing(nextFacing);
      setVoiceError('');
      setVoiceStatus(nextFacing === 'user' ? 'Включена фронтальная камера' : 'Включена основная камера');
    } catch (switchError) {
      setVoiceError(switchError.message || 'Не удалось переключить камеру.');
    } finally {
      setVoiceCameraSwitching(false);
    }
  }

  useEffect(() => {
    const room = liveKitRoomRef.current;
    const element = localVideoRef.current;
    if (!room || !element || (!cameraEnabled && !screenSharing)) return undefined;
    const Track = liveKitSdkRef.current?.Track;
    if (!Track) return undefined;
    const source = screenSharing ? Track.Source.ScreenShare : Track.Source.Camera;
    const publication = room.localParticipant.getTrackPublication(source);
    const track = publication?.track;
    if (!track) return undefined;
    track.attach(element);
    return () => { track.detach(element); };
  }, [cameraEnabled, screenSharing, connected]);

  async function stopScreenShare() {
    const room = liveKitRoomRef.current;
    if (!room || !screenSharing) return;
    try {
      await room.localParticipant.setScreenShareEnabled(false);
      setScreenSharing(false);
      setVoiceError('');
      setVoiceStatus('Демонстрация экрана остановлена');
    } catch (shareError) {
      setVoiceError(shareError.message || 'Не удалось остановить демонстрацию экрана.');
    }
  }

  async function toggleScreenShare() {
    const room = liveKitRoomRef.current;
    if (!room || !connected) return;
    if (screenSharing) {
      await stopScreenShare();
      return;
    }
    try {
      await room.localParticipant.setScreenShareEnabled(true);
      setScreenSharing(true);
      setVoiceError('');
      setVoiceStatus('Ты показываешь экран участникам комнаты');
    } catch (shareError) {
      setVoiceError(shareError.name === 'NotAllowedError' || shareError.name === 'AbortError'
        ? 'Демонстрация экрана отменена или доступ запрещён.'
        : shareError.message || 'Не удалось начать демонстрацию экрана.');
    }
  }

  async function toggleMic() {
    const room = liveKitRoomRef.current;
    if (!room || !connected) return;
    const next = !micEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next, {
        echoCancellation: true,
        noiseSuppression: noiseSuppressionRef.current,
        autoGainControl: true,
        channelCount: 1
      });
      setMicEnabled(next);
      setVoiceError('');
      setVoiceStatus(next ? 'Микрофон включён' : 'Микрофон выключен');
      updateVoiceParticipants();
    } catch (micError) {
      setVoiceError(micError.message || 'Не удалось изменить состояние микрофона.');
    }
  }

  useEffect(() => () => {
    const room = liveKitRoomRef.current;
    liveKitRoomRef.current = null;
    if (room) room.disconnect().catch(() => {});
    audioElementsRef.current.forEach(element => {
      element.pause?.();
      element.srcObject = null;
      element.remove();
    });
    audioElementsRef.current.clear();
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
      <aside className="server-rail">
        <button type="button" className="brand-mark" onClick={() => setTab('friends')} aria-label="KENTY — друзья">K</button>
        <div className="rail-divider" />
        {servers.map(server => <button type="button" key={server.id} title={server.name} aria-label={server.name} className={'server-icon ' + (selectedServerId === server.id ? 'selected' : '')} onClick={() => { setSelectedServerId(server.id); setTab('server'); }}>{server.name[0]?.toUpperCase() || 'S'}</button>)}
        <button type="button" className="server-icon server-add-button" onClick={() => setShowServerCreate(value => !value)} aria-label="Создать сервер">＋</button>
      </aside>
      <aside className="sidebar">
        <div className="brand-row"><div className="brand-name">KENTY</div><span className="beta-tag">ALPHA</span></div>
        <div className="sidebar-label">ПРОСТРАНСТВО</div>
        <button className={'nav-item ' + (tab === 'friends' ? 'selected' : '')} onClick={() => setTab('friends')}>♧ Друзья</button>
        <button className={'nav-item ' + (tab === 'chat' ? 'selected' : '')} onClick={() => setTab('chat')}># Сообщения</button>
        <button className={'nav-item ' + (tab === 'voice' ? 'selected' : '')} onClick={() => setTab('voice')}>◖ Голосовые комнаты</button>
        <button className={'nav-item ' + (tab === 'settings' ? 'selected' : '')} onClick={() => setTab('settings')}>⚙ Настройки</button>
        <div className="sidebar-label">СЕРВЕРЫ</div>
        <button className="nav-item" onClick={() => setShowServerCreate(value => !value)}>＋ Создать сервер</button>
        {showServerCreate && <form className="sidebar-create-form" onSubmit={createServer}><input value={serverNameDraft} onChange={event => setServerNameDraft(event.target.value)} maxLength={64} placeholder="Название сервера" required /><button disabled={serverBusy}>{serverBusy ? 'Создаём…' : 'Создать'}</button></form>}
        <form className="sidebar-join-form" onSubmit={joinServerWithCode}><input value={inviteCodeDraft} onChange={event => setInviteCodeDraft(event.target.value)} placeholder="Код приглашения" aria-label="Код приглашения" /><button disabled={serverBusy || !inviteCodeDraft.trim()}>Войти</button></form>
        {selectedServerId && <><div className="sidebar-label channel-sidebar-label">КАНАЛЫ</div>
          <div className="server-channel-list">{serverChannels.map(channel => <button type="button" key={channel.id} className={'conversation-link ' + (selectedChannelId === channel.id ? 'selected' : '')} onClick={() => { setSelectedChannelId(channel.id); setTab('server'); }}><span className="channel-kind">{channel.channel_type === 'voice' ? '◖' : '#'}</span>{channel.name}</button>)}
          {!serverChannels.length && <small className="sidebar-empty">Пока нет каналов</small>}</div>
          {['owner','admin','moderator'].includes(servers.find(item => item.id === selectedServerId)?.role) && <><button className="nav-item create-channel-toggle" onClick={() => setShowChannelCreate(value => !value)}>＋ Добавить канал</button>{showChannelCreate && <form className="sidebar-create-form" onSubmit={createServerChannel}><input value={channelNameDraft} onChange={event => setChannelNameDraft(event.target.value)} maxLength={64} placeholder="Название канала" required /><button disabled={serverBusy}>Создать</button></form>}</>}
        </>}
        <div className="sidebar-label">ПЕРЕПИСКИ</div>
        <div className="conversation-list">
          {conversations.map(c => <button className={'conversation-link ' + (selectedConversation?.id === c.id ? 'selected' : '')} key={c.id} onClick={() => { setSelectedConversation(c); setTab('chat'); }}>
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
          <div className="topbar-title"><span className="hash">{tab === 'chat' ? '#' : '◖'}</span><b>{tab === 'friends' ? 'друзья' : tab === 'chat' ? (selectedConversation?.person?.display_name || selectedConversation?.person?.username || 'сообщения') : tab === 'server' ? (servers.find(item => item.id === selectedServerId)?.name || 'сервер') : tab === 'settings' ? 'настройки' : 'голосовые-комнаты'}</b></div>
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
          <form className="search-panel" onSubmit={searchUsers}><span className="search-panel-icon">⌕</span><input type="search" enterKeyHint="search" autoComplete="off" value={search} onChange={e => { setSearch(e.target.value); setSearchMessage(''); }} placeholder="Найти по нику или имени…" /><button type="button" onClick={searchUsers} className="primary-button" disabled={searchBusy}>{searchBusy ? 'Ищем…' : 'Найти друзей'} <span>→</span></button></form>
          {searchMessage && <p className="search-feedback" role="status">{searchMessage}</p>}
          {!!searchResults.length && <section className="social-section"><h2>Результаты поиска</h2>{searchResults.map(p => <div className="person-row" key={p.id}><div className="participant-avatar">{p.avatar_url ? <img src={p.avatar_url} alt="" /> : (p.display_name || p.username)[0].toUpperCase()}</div><div className="participant-name"><b>{p.display_name || p.username}</b><small>@{p.username}</small></div><button type="button" className="small-action" onClick={() => sendRequest(p.id)}>Добавить</button></div>)}</section>}
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
            <div className="chat-messages">{messages.map(m => <article className={"chat-message " + (m.sender_id === session.user.id ? "message-own" : "message-other")} key={m.id}>
              <div className="message-avatar">{m.sender_id === session.user.id ? (profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.username || 'Я')[0].toUpperCase()) : (selectedConversation.person?.avatar_url ? <img src={selectedConversation.person.avatar_url} alt="" /> : (selectedConversation.person?.username || 'Д')[0].toUpperCase())}</div>
              <div className="message-body">
                <div className="message-heading"><b>{m.sender_id === session.user.id ? 'Ты' : selectedConversation.person?.display_name || selectedConversation.person?.username}</b><time className="message-time" dateTime={m.created_at}>{formatMessageTime(m.created_at)}{m.edited_at ? ' · изменено' : ''}</time></div>
                {getImagePath(m.content)
                  ? <button type="button" className="chat-image-open" onClick={() => imageUrls[m.id] && setExpandedImage(imageUrls[m.id])} disabled={!imageUrls[m.id]} aria-label="Открыть фотографию">{imageUrls[m.id] ? <img className="chat-image-message" src={imageUrls[m.id]} alt="Фотография из переписки" loading="lazy" /> : <span className="chat-image-loading">Загружаем фотографию…</span>}</button>
                  : editingMessageId === m.id
                    ? <div className="message-edit-box"><textarea value={editDraft} onChange={event => setEditDraft(event.target.value)} maxLength={10000} rows={2} autoFocus /><div><button type="button" onClick={() => saveEditedMessage(m)} disabled={messageActionBusy || !editDraft.trim()}>Сохранить</button><button type="button" className="message-cancel-edit" onClick={() => { setEditingMessageId(null); setEditDraft(''); }}>Отмена</button></div></div>
                    : <p>{m.content}</p>}
                {m.sender_id === session.user.id && !getImagePath(m.content) && editingMessageId !== m.id && <div className="message-actions"><button type="button" onClick={() => beginEditMessage(m)} aria-label="Изменить сообщение">Изменить</button><button type="button" onClick={() => deleteMessage(m)} disabled={messageActionBusy} aria-label="Удалить сообщение">Удалить</button></div>}
              </div>
            </article>)}{!messages.length && <p className="chat-no-messages">Пока тихо. Отправь первое сообщение 👋</p>}<div ref={messagesEndRef} /></div>
            <form className="chat-composer" onSubmit={sendMessage}><button type="button" className="chat-camera-button" onClick={openChatCamera} aria-label="Открыть камеру" title="Сделать фото">📷</button><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Написать сообщение…" /><button type="submit">Отправить</button></form>
          </>}
        </div>}

        {tab === 'server' && <div className="server-content">
          {!servers.some(item => item.id === selectedServerId) ? <div className="empty-state chat-empty"><h2>Твои серверы</h2><p>Создай сервер или присоединись по приглашению друга.</p></div> : <>
            <section className="server-welcome"><div><span className="eyebrow">KENTY COMMUNITY</span><h1>{servers.find(item => item.id === selectedServerId)?.name}</h1><p>{servers.find(item => item.id === selectedServerId)?.description || 'Общайся, собирай друзей и создавай своё пространство.'}</p></div><button type="button" className="primary-button" onClick={createServerInvite} disabled={serverBusy}>Пригласить друзей ↗</button></section>
            {!selectedChannelId ? <div className="empty-state">Создай первый текстовый канал в боковой панели.</div> : <><div className="server-channel-heading"><span>#</span><div><b>{serverChannels.find(channel => channel.id === selectedChannelId)?.name || 'канал'}</b><small>{serverChannels.find(channel => channel.id === selectedChannelId)?.topic || 'Общение участников сервера'}</small></div></div>
              <div className="server-channel-messages">{channelMessages.map(item => <article className="server-chat-message" key={item.id}><div className="message-avatar">{item.sender_id === session.user.id ? (profile?.display_name || profile?.username || 'Я')[0].toUpperCase() : 'У'}</div><div><b>{item.sender_id === session.user.id ? 'Ты' : 'Участник'}</b><time>{formatMessageTime(item.created_at)}</time><p>{item.content}</p></div></article>)}{!channelMessages.length && <p className="chat-no-messages">Канал создан. Напиши первое сообщение 👋</p>}</div>
              <form className="chat-composer server-chat-composer" onSubmit={sendChannelMessage}><input value={channelMessage} onChange={event => setChannelMessage(event.target.value)} placeholder={'Написать в #' + (serverChannels.find(channel => channel.id === selectedChannelId)?.name || 'канал') + '…'} /><button type="submit">Отправить</button></form>
            </>}
          </>}
        </div>}

        {tab === 'settings' && <div className="settings-content">
          <section className="settings-hero"><span className="eyebrow">ТВОЙ АККАУНТ</span><h1>Настройки</h1><p>Настрой KENTY под себя — от аватара до оформления.</p></section>
          <section className="settings-card"><div className="settings-card-heading"><div><h2>Фото профиля</h2><p>Это фото увидят твои друзья и собеседники.</p></div></div>
            <div className="avatar-editor"><div className="avatar-preview">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Твой аватар" /> : <span>{(profile?.display_name || profile?.username || 'K')[0].toUpperCase()}</span>}</div><div className="avatar-editor-copy"><b>{profile?.display_name || profile?.username || 'Твой профиль'}</b><small>@{profile?.username || 'user'}</small><label className="primary-button avatar-upload-button">{avatarBusy ? 'Загружаем…' : 'Выбрать фото'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadAvatar} disabled={avatarBusy} /></label><small>JPG, PNG, WEBP или GIF · до 5 МБ</small></div></div>
          </section>
          <form className="settings-card profile-edit-card" onSubmit={saveProfile}>
            <div className="settings-card-heading"><div><h2>Личная информация</h2><p>Имя и описание, которые увидят друзья.</p></div></div>
            <div className="profile-edit-grid">
              <label>Отображаемое имя<input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={32} placeholder="Как тебя называть?" /></label>
              <label>О себе<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={160} rows={3} placeholder="Пара слов о себе…" /></label>
            </div>
            <div className="profile-edit-footer"><small>{bio.length}/160 символов</small><button className="primary-button" disabled={profileBusy}>{profileBusy ? 'Сохраняем…' : 'Сохранить профиль'}</button></div>
          </form>
          <section className="settings-card"><div className="settings-card-heading"><div><h2>Внешний вид</h2><p>Выбери оформление приложения. Настройка сохранится на этом устройстве.</p></div></div>
            <div className="theme-options"><button type="button" className={'theme-option ' + (theme === 'dark' ? 'active' : '')} onClick={() => setTheme('dark')}><span className="theme-preview dark-preview"><i /><i /><i /></span><b>Тёмная</b><small>Комфортно вечером</small></button><button type="button" className={'theme-option ' + (theme === 'light' ? 'active' : '')} onClick={() => setTheme('light')}><span className="theme-preview light-preview"><i /><i /><i /></span><b>Светлая</b><small>Больше света и контраста</small></button></div>
          </section>
          <section className="settings-card accent-settings-card">
            <div className="settings-card-heading"><div><h2>Цвет акцента</h2><p>Выбери оттенок кнопок и активных элементов.</p></div></div>
            <div className="accent-options">
              <button type="button" className={'accent-option accent-violet ' + (accentTheme === 'violet' ? 'active' : '')} onClick={() => setAccentTheme('violet')}><i />Фиолетовый</button>
              <button type="button" className={'accent-option accent-ocean ' + (accentTheme === 'ocean' ? 'active' : '')} onClick={() => setAccentTheme('ocean')}><i />Океан</button>
              <button type="button" className={'accent-option accent-sunset ' + (accentTheme === 'sunset' ? 'active' : '')} onClick={() => setAccentTheme('sunset')}><i />Закат</button>
              <button type="button" className={'accent-option accent-ember ' + (accentTheme === 'ember' ? 'active' : '')} onClick={() => setAccentTheme('ember')}><i />Огонь</button>
            </div>
          </section>
          {window.Capacitor?.isNativePlatform?.() && <section className="settings-card"><div className="settings-card-heading"><div><h2>Push-уведомления</h2><p>Разреши KENTY показывать системные уведомления. Для доставки сообщений также нужна настройка сервера уведомлений.</p></div></div><button type="button" className="primary-button" onClick={async () => { const result = await window.kentyEnablePushNotifications?.(); setNotice(result?.message || 'Не удалось включить уведомления.'); }}>Включить уведомления</button></section>}
        </div>}

        {tab === 'voice' && <div className="voice-content">
          <div className="voice-heading"><div><div className="eyebrow">REAL-TIME VOICE</div><h1>Голосовые комнаты</h1><p>Заходи к друзьям, общайся и оставайся на связи.</p></div><div className="voice-orb">♫</div></div>
          {!connected && <><div className="room-owner-picker"><label htmlFor="voice-owner">КОМНАТА КОГО</label><select id="voice-owner" value={activeVoiceOwner?.id || ''} onChange={e => setSelectedVoiceOwnerId(e.target.value)}>{voiceOwners.map(owner => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select><small>Войти можно только в свою комнату или комнату принятого друга.</small></div><div className="room-picker">{VOICE_ROOMS.map(r => <button type="button" key={r.id} className={'room-card ' + (selectedRoom.id === r.id ? 'active' : '')} onClick={() => setSelectedRoom(r)}><span className="room-card-icon">{r.icon}</span><span className="room-card-title">{r.label}</span><span className="room-card-description">{r.description}</span></button>)}</div></>}
          {!connected ? <form className="join-panel" onSubmit={joinVoiceRoom}><div className="panel-heading"><div><span className="eyebrow">ПОДКЛЮЧЕНИЕ</span><h2>Войти в «{selectedRoom.label}»</h2></div></div><div className="form-grid"><label><span>ТВОЁ ИМЯ</span><input value={voiceName} onChange={e => setVoiceName(e.target.value)} placeholder="Твоё имя" /></label></div><button type="button" className={"noise-toggle " + (noiseSuppression ? "active" : "")} aria-pressed={noiseSuppression} onClick={toggleNoiseSuppression}><span className="noise-toggle-icon">✦</span><span><b>Шумоподавление</b><small>{noiseSuppression ? 'Включено · подавляет фоновые шумы' : 'Выключено · исходный звук микрофона'}</small></span><span className="noise-toggle-state">{noiseSuppression ? 'ВКЛ' : 'ВЫКЛ'}</span></button>{voiceError && <div className="error-box">{voiceError}</div>}<div className="join-bottom"><div className="join-hint">Выбирай комнату и подключайся — код не нужен.</div><button className="primary-button" disabled={joining}>{joining ? 'Подключаем…' : 'Войти в комнату →'}</button></div></form> : <section className="live-panel"><div className="panel-heading"><div><span className="eyebrow">ТЫ В КОМНАТЕ</span><h2>{selectedRoom.label}</h2></div><span className="live-badge"><i /> В ЭФИРЕ</span></div>{voiceError && <div className="error-box" role="alert">{voiceError}</div>}<div className="voice-video-grid">
              {(cameraEnabled || screenSharing) && <div className="voice-video-tile local-video-tile"><video ref={localVideoRef} autoPlay playsInline muted /><span>{screenSharing ? 'Ты · демонстрация экрана' : 'Ты · камера включена'}</span></div>}
              {Object.entries(remoteVideoStreams).map(([peerId, stream]) => <div className="voice-video-tile" key={peerId}><video autoPlay playsInline ref={element => { if (element && element.srcObject !== stream) element.srcObject = stream; }} /><span>{remoteScreenShares[peerId] ? '🖥 Демонстрация экрана · ' : ''}{participants.find(person => person.id === peerId)?.name || 'Участник'}</span></div>)}
            </div><div className="participant-heading">УЧАСТНИКИ · {participants.length}</div><div className="participant-list">{participants.map(p => <div className="participant" key={p.id}><div className="participant-avatar">{p.name[0]?.toUpperCase()}</div><div className="participant-name"><b>{p.name}{p.local ? ' (ты)' : ''}</b><small>{p.speaking ? 'Говорит' : 'На связи'}</small></div><span className="mic-state">{p.muted ? 'Микрофон выкл.' : 'Микрофон вкл.'}</span></div>)}</div><div className="voice-controls"><button type="button" className={"control-button " + (!micEnabled ? "control-muted" : "")} aria-pressed={micEnabled} onClick={toggleMic}>{micEnabled ? '🎙 Выключить микрофон' : '🔇 Включить микрофон'}</button><button type="button" className={"control-button voice-camera-button " + (cameraEnabled ? "camera-live-active" : "")} aria-pressed={cameraEnabled} onClick={toggleVoiceCamera}>{cameraEnabled ? '📷 Выключить камеру' : '📷 Включить камеру'}</button><button type="button" className={"control-button screen-share-button " + (screenSharing ? "camera-live-active" : "")} aria-pressed={screenSharing} onClick={toggleScreenShare}>{screenSharing ? "⏹ Остановить показ" : "🖥 Показать экран"}</button>{cameraEnabled && <button type="button" className="control-button voice-camera-switch" onClick={switchVoiceCamera} disabled={voiceCameraSwitching}>{voiceCameraSwitching ? "⏳ Переключаем…" : "🔄 Перевернуть камеру"}</button>}<button type="button" className={"control-button noise-live-button " + (noiseSuppression ? "noise-live-active" : "")} aria-pressed={noiseSuppression} onClick={toggleNoiseSuppression}>✦ Шумоподавление: {noiseSuppression ? 'ВКЛ' : 'ВЫКЛ'}</button><button className="leave-button" onClick={leaveVoiceRoom}>Выйти из комнаты</button></div></section>}
          <div className="status-line">{voiceStatus}</div><div className="alpha-note">Голос идёт напрямую между участниками через WebRTC. Комнаты доступны владельцу и принятым друзьям.</div><div className="audio-bin" ref={audioRef} />
        </div>}
      </section>
      {cameraOpen && <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Камера KENTY">
        <div className="camera-modal">
          <header className="camera-modal-header"><div><span className="camera-eyebrow">KENTY CAMERA</span><h2>{capturedPhoto ? 'Предпросмотр фото' : 'Сделать фотографию'}</h2></div><button type="button" className="camera-close" onClick={closeChatCamera} aria-label="Закрыть камеру">×</button></header>
          <div className="camera-view">
            {capturedPhoto && cameraPreviewUrl
              ? <img className="camera-preview" src={cameraPreviewUrl} alt="Предпросмотр снимка" />
              : <video ref={cameraVideoRef} className="camera-video" autoPlay playsInline muted />}
            {cameraBusy && !capturedPhoto && <div className="camera-loading">Запускаем камеру…</div>}
            {cameraError && <div className="camera-error" role="alert">{cameraError}<button type="button" onClick={() => { setCameraError(''); setCameraAttempt(value => value + 1); }}>Повторить</button></div>}
          </div>
          <div className="camera-controls">
            {!capturedPhoto ? <>
              <button type="button" className="camera-secondary" onClick={() => setCameraFacing(value => value === 'user' ? 'environment' : 'user')} disabled={cameraBusy} aria-label="Переключить камеру">↻ <span>Сменить камеру</span></button>
              <button type="button" className="camera-shutter" onClick={captureChatPhoto} disabled={cameraBusy || !!cameraError} aria-label="Сфотографировать"><i /></button>
              <span className="camera-mode-label">{cameraFacing === 'user' ? 'Фронтальная' : 'Основная'}</span>
            </> : <>
              <button type="button" className="camera-secondary" onClick={() => setCapturedPhoto(null)}>↶ <span>Переснять</span></button>
              <button type="button" className="camera-send" onClick={sendCapturedPhoto} disabled={cameraBusy}>{cameraBusy ? 'Отправляем…' : 'Отправить фото ➤'}</button>
            </>}
          </div>
        </div>
      </div>}
      {expandedImage && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Просмотр фотографии" onClick={() => setExpandedImage('')}><button type="button" aria-label="Закрыть фотографию" onClick={() => setExpandedImage('')}>×</button><img src={expandedImage} alt="Фотография из переписки" onClick={e => e.stopPropagation()} /></div>}
      <nav className="mobile-dock" aria-label="Основная навигация">
        <button type="button" className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}><span>♧</span><small>Друзья</small></button>
        <button type="button" className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}><span>▤</span><small>Чаты</small></button>
        <button type="button" className={tab === 'voice' ? 'active' : ''} onClick={() => setTab('voice')}><span>◖</span><small>Голос</small></button>
        <button type="button" className={tab === 'server' ? 'active' : ''} onClick={() => setTab('server')}><span>▦</span><small>Серверы</small></button>
        <button type="button" className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><span>⚙</span><small>Настройки</small></button>
      </nav>
    </main>
  );
}