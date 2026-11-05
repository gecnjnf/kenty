import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function Communities({ session, onNotice, onError }) {
  const userId = session?.user?.id;
  const [servers, setServers] = useState([]);
  const [serverId, setServerId] = useState('');
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState('');
  const [messages, setMessages] = useState([]);
  const [people, setPeople] = useState({});
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [channelName, setChannelName] = useState('');
  const [draft, setDraft] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadServers(preferredId) {
    if (!userId) return;
    const { data: memberships, error: membershipError } = await supabase
      .from('server_members').select('server_id').eq('user_id', userId);
    if (membershipError) throw membershipError;
    const ids = [...new Set((memberships || []).map(item => item.server_id))];
    if (!ids.length) {
      setServers([]);
      setServerId('');
      setChannels([]);
      setChannelId('');
      return;
    }
    const { data, error } = await supabase
      .from('servers').select('id,name,description,icon_url,owner_id,created_at')
      .in('id', ids).order('created_at', { ascending: true });
    if (error) throw error;
    const list = data || [];
    setServers(list);
    setServerId(current => {
      const wanted = preferredId || current;
      return list.some(item => item.id === wanted) ? wanted : (list[0]?.id || '');
    });
  }

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const inviteCode = params.get('invite');
        if (inviteCode && /^[a-f0-9]{8,40}$/i.test(inviteCode)) {
          const { data: joinedId, error: joinError } = await supabase.rpc('join_server_by_invite', { invite_code: inviteCode });
          if (joinError) throw joinError;
          window.history.replaceState({}, '', window.location.pathname + window.location.hash);
          if (active) onNotice?.('Ты присоединился к сообществу KENTY!');
          await loadServers(joinedId);
        } else {
          await loadServers();
        }
      } catch (error) {
        if (active) onError?.('Сообщества: ' + (error.message || 'не удалось загрузить данные.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!serverId) {
      setChannels([]);
      setChannelId('');
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('channels')
        .select('id,name,channel_type,topic,position')
        .eq('server_id', serverId).order('position', { ascending: true });
      if (error) {
        if (active) onError?.('Не удалось загрузить каналы: ' + error.message);
        return;
      }
      const list = data || [];
      if (active) {
        setChannels(list);
        setChannelId(current => list.some(item => item.id === current) ? current : (list.find(item => item.channel_type === 'text')?.id || ''));
      }
    })();
    return () => { active = false; };
  }, [serverId]);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      return;
    }
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.from('channel_messages')
        .select('id,channel_id,sender_id,content,created_at,edited_at')
        .eq('channel_id', channelId).order('created_at', { ascending: false }).limit(100);
      if (error) {
        if (active) onError?.('Не удалось загрузить сообщения канала: ' + error.message);
        return;
      }
      const ordered = (data || []).reverse();
      if (active) setMessages(ordered);
      const ids = [...new Set(ordered.map(item => item.sender_id))];
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles')
          .select('id,username,display_name,avatar_url').in('id', ids);
        if (active) setPeople(Object.fromEntries((profiles || []).map(person => [person.id, person])));
      }
    };
    const channel = supabase.channel('kenty:server-channel:' + channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_messages', filter: 'channel_id=eq.' + channelId }, async ({ new: incoming }) => {
        if (!active || !incoming?.id) return;
        setMessages(current => current.some(item => item.id === incoming.id) ? current : [...current, incoming].slice(-100));
        if (!people[incoming.sender_id]) {
          const { data } = await supabase.from('profiles').select('id,username,display_name,avatar_url').eq('id', incoming.sender_id).maybeSingle();
          if (active && data) setPeople(current => ({ ...current, [data.id]: data }));
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') load();
        if (status === 'CHANNEL_ERROR' && active) onError?.('Потеряно обновление канала в реальном времени.');
      });
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  async function createServer(event) {
    event.preventDefault();
    const name = serverName.trim();
    if (name.length < 2 || name.length > 48) {
      onError?.('Название сообщества должно быть от 2 до 48 символов.');
      return;
    }
    setBusy(true);
    try {
      const { data: created, error: createError } = await supabase.from('servers')
        .insert({ name, description: serverDescription.trim().slice(0, 240), owner_id: userId })
        .select('id').single();
      if (createError) throw createError;
      const { error: memberError } = await supabase.from('server_members')
        .insert({ server_id: created.id, user_id: userId, role: 'owner' });
      if (memberError) throw memberError;
      const { error: channelError } = await supabase.from('channels')
        .insert({ server_id: created.id, name: 'общий', channel_type: 'text', created_by: userId, position: 0 });
      if (channelError) throw channelError;
      setServerName('');
      setServerDescription('');
      await loadServers(created.id);
      onNotice?.('Сообщество создано. Приглашай друзей!');
    } catch (error) {
      onError?.('Не удалось создать сообщество: ' + (error.message || 'ошибка'));
    } finally {
      setBusy(false);
    }
  }

  async function createChannel(event) {
    event.preventDefault();
    const name = channelName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!serverId || !/^[\p{L}\p{N}_-]{2,40}$/u.test(name)) {
      onError?.('Название канала: 2–40 букв, цифр, дефисов или _.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('channels').insert({
        server_id: serverId, name, channel_type: 'text', created_by: userId, position: channels.length
      });
      if (error) throw error;
      setChannelName('');
      const { data } = await supabase.from('channels').select('id,name,channel_type,topic,position')
        .eq('server_id', serverId).order('position', { ascending: true });
      const list = data || [];
      setChannels(list);
      setChannelId(list.find(item => item.name === name)?.id || channelId);
      onNotice?.('Текстовый канал создан.');
    } catch (error) {
      onError?.('Не удалось создать канал: ' + (error.message || 'ошибка'));
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    if (!serverId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from('server_invites')
        .insert({ server_id: serverId, created_by: userId })
        .select('code').single();
      if (error) throw error;
      const link = window.location.origin + '/?invite=' + encodeURIComponent(data.code);
      setInviteLink(link);
      try {
        await navigator.clipboard.writeText(link);
        onNotice?.('Пригласительная ссылка скопирована!');
      } catch {
        onNotice?.('Ссылка создана. Скопируй её из поля ниже.');
      }
    } catch (error) {
      onError?.('Не удалось создать приглашение: ' + (error.message || 'ошибка'));
    } finally {
      setBusy(false);
    }
  }

  async function sendChannelMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || content.length > 5000 || !channelId || !userId) return;
    const { data, error } = await supabase.from('channel_messages')
      .insert({ channel_id: channelId, sender_id: userId, content })
      .select('id,channel_id,sender_id,content,created_at,edited_at').single();
    if (error) {
      onError?.('Не удалось отправить сообщение: ' + error.message);
      return;
    }
    setDraft('');
    setMessages(current => current.some(item => item.id === data.id) ? current : [...current, data].slice(-100));
  }

  const selectedServer = servers.find(item => item.id === serverId);
  const selectedChannel = channels.find(item => item.id === channelId);

  if (loading) return <section className="communities-page"><div className="communities-loading">Загружаем твои сообщества…</div></section>;

  return (
    <section className="communities-page">
      <header className="communities-header">
        <div><span className="eyebrow">KENTY COMMUNITIES</span><h1>Сообщества</h1><p>Создавай свои пространства и собирай друзей в одном месте.</p></div>
        <span className="communities-count">{servers.length} сообществ</span>
      </header>
      <div className="communities-layout">
        <aside className="communities-list">
          <div className="communities-list-title">ТВОИ СООБЩЕСТВА</div>
          {servers.map(server => <button type="button" key={server.id} className={'community-server ' + (server.id === serverId ? 'active' : '')} onClick={() => { setServerId(server.id); setInviteLink(''); }}>
            <span className="community-server-icon">{server.icon_url ? <img src={server.icon_url} alt="" /> : server.name.slice(0, 1).toUpperCase()}</span>
            <span><b>{server.name}</b><small>{server.description || 'Сообщество KENTY'}</small></span>
          </button>)}
          {!servers.length && <p className="communities-empty">Пока нет сообществ. Создай первое или открой приглашение от друга.</p>}
          <form className="community-create-form" onSubmit={createServer}>
            <b>НОВОЕ СООБЩЕСТВО</b>
            <input value={serverName} onChange={event => setServerName(event.target.value)} maxLength={48} placeholder="Название" required />
            <textarea value={serverDescription} onChange={event => setServerDescription(event.target.value)} maxLength={240} rows={2} placeholder="Короткое описание (необязательно)" />
            <button className="primary-button" disabled={busy}>{busy ? 'Создаём…' : '+ Создать'}</button>
          </form>
        </aside>
        <div className="community-workspace">
          {!selectedServer ? <div className="community-welcome"><div className="community-welcome-mark">K</div><h2>Твоё первое сообщество</h2><p>Создай сообщество или присоединись по пригласительной ссылке.</p></div> : <>
            <div className="community-server-heading"><div><span className="eyebrow">СООБЩЕСТВО</span><h2>{selectedServer.name}</h2><p>{selectedServer.description || 'Место для общения с друзьями.'}</p></div><button type="button" className="community-invite-button" onClick={createInvite} disabled={busy}>＋ Пригласить</button></div>
            {inviteLink && <div className="community-invite-link"><span>ПРИГЛАСИТЕЛЬНАЯ ССЫЛКА</span><input readOnly value={inviteLink} onFocus={event => event.target.select()} /><button type="button" onClick={() => navigator.clipboard?.writeText(inviteLink).then(() => onNotice?.('Ссылка скопирована!')).catch(() => {})}>Копировать</button></div>}
            <div className="community-content-grid">
              <aside className="community-channels">
                <div className="community-channel-heading"><b>ТЕКСТОВЫЕ КАНАЛЫ</b><span>{channels.filter(item => item.channel_type === 'text').length}</span></div>
                {channels.filter(item => item.channel_type === 'text').map(channel => <button type="button" key={channel.id} className={'community-channel ' + (channel.id === channelId ? 'active' : '')} onClick={() => setChannelId(channel.id)}># {channel.name}</button>)}
                {!channels.some(item => item.channel_type === 'text') && <small className="communities-muted">Текстовых каналов пока нет</small>}
                {selectedServer.owner_id === userId && <form className="community-add-channel" onSubmit={createChannel}><input value={channelName} onChange={event => setChannelName(event.target.value)} maxLength={40} placeholder="Новый канал" /><button type="submit" disabled={busy} aria-label="Создать канал">＋</button></form>}
                <div className="community-channel-heading community-voice-heading"><b>ГОЛОСОВЫЕ КАНАЛЫ</b></div>
                {channels.filter(item => item.channel_type === 'voice').map(channel => <div className="community-channel community-channel-disabled" key={channel.id}>◖ {channel.name}</div>)}
                {channels.filter(item => item.channel_type === 'voice').length === 0 && <small className="communities-muted">Голосовые каналы пока не настроены</small>}
              </aside>
              <div className="community-chat">
                {!selectedChannel ? <div className="community-welcome"><h2>Выбери текстовый канал</h2></div> : <>
                  <div className="community-chat-heading"><b># {selectedChannel.name}</b><small>{selectedChannel.topic || 'Общение участников сообщества'}</small></div>
                  <div className="community-messages">
                    {messages.map(item => {
                      const person = people[item.sender_id];
                      return <article className="community-message" key={item.id}>
                        <div className="community-message-avatar">{person?.avatar_url ? <img src={person.avatar_url} alt="" /> : (person?.display_name || person?.username || '?').slice(0, 1).toUpperCase()}</div>
                        <div><div className="community-message-meta"><b>{person?.display_name || person?.username || 'Участник'}</b><time>{formatTime(item.created_at)}</time></div><p>{item.content}</p></div>
                      </article>;
                    })}
                    {!messages.length && <p className="communities-empty-chat">Здесь пока тихо. Напиши первое сообщение 👋</p>}
                  </div>
                  <form className="community-composer" onSubmit={sendChannelMessage}><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={5000} placeholder={'Написать в #' + selectedChannel.name + '…'} /><button type="submit" disabled={!draft.trim()}>Отправить</button></form>
                </>}
              </div>
            </div>
          </>}
        </div>
      </div>
    </section>
  );
}
