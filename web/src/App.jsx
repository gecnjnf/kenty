import { useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

const VOICE_ROOMS = [
  { id: 'lobby', label: 'Общая', description: 'Для разговоров обо всём', icon: '◉' },
  { id: 'gaming', label: 'Игровая', description: 'Собираемся поиграть', icon: '🎮' },
  { id: 'chill', label: 'Тихая', description: 'Спокойное общение', icon: '☾' }
];

function participantView(participant, localIdentity) {
  return {
    identity: participant.identity,
    name: participant.name || participant.identity,
    isLocal: participant.identity === localIdentity,
    isSpeaking: Boolean(participant.isSpeaking),
    isMuted: !participant.isMicrophoneEnabled
  };
}

export default function App() {
  const [tab, setTab] = useState('voice');
  const [selectedRoom, setSelectedRoom] = useState(VOICE_ROOMS[0]);
  const [displayName, setDisplayName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Голосовые комнаты готовы к подключению');
  const [messages, setMessages] = useState([
    { name: 'KENTY', text: 'Добро пожаловать! Голосовые комнаты уже здесь.' },
    { name: 'Система', text: 'Выбери комнату, введи имя и общий код доступа.' }
  ]);
  const [message, setMessage] = useState('');

  const roomRef = useRef(null);
  const audioContainerRef = useRef(null);

  const participantCount = participants.length;
  const activeSpeakers = useMemo(
    () => new Set(activeSpeakerIds),
    [activeSpeakerIds]
  );

  function refreshParticipants(room) {
    if (!room) return;
    const localIdentity = room.localParticipant.identity;
    const list = [
      participantView(room.localParticipant, localIdentity),
      ...Array.from(room.remoteParticipants.values()).map((person) =>
        participantView(person, localIdentity)
      )
    ];
    setParticipants(list);
    setActiveSpeakerIds(list.filter((person) => person.isSpeaking).map((person) => person.identity));
  }

  async function joinVoiceRoom(event) {
    event.preventDefault();
    setError('');

    if (!displayName.trim() || !accessCode.trim()) {
      setError('Введи имя и код доступа.');
      return;
    }

    setJoining(true);
    setStatus('Подключаемся к голосовой комнате…');

    let room;
    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: selectedRoom.id,
          displayName: displayName.trim(),
          accessCode
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось получить доступ к комнате.');
      }

      room = new Room({
        adaptiveStream: true,
        dynacast: true
      });
      roomRef.current = room;

      const sync = () => refreshParticipants(room);

      room.on(RoomEvent.ParticipantConnected, sync);
      room.on(RoomEvent.ParticipantDisconnected, sync);
      room.on(RoomEvent.ActiveSpeakersChanged, sync);
      room.on(RoomEvent.LocalTrackPublished, sync);
      room.on(RoomEvent.LocalTrackUnpublished, sync);

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio && audioContainerRef.current) {
          const audioElement = track.attach();
          audioElement.autoplay = true;
          audioElement.playsInline = true;
          audioContainerRef.current.appendChild(audioElement);
        }
        sync();
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
        sync();
      });

      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setConnected(false);
        setMicEnabled(false);
        setParticipants([]);
        setActiveSpeakerIds([]);
        setStatus('Соединение завершено');
        if (audioContainerRef.current) audioContainerRef.current.innerHTML = '';
      });

      await room.connect(data.serverUrl, data.participantToken);
      await room.localParticipant.setMicrophoneEnabled(true);

      setMicEnabled(true);
      setConnected(true);
      setStatus(`Ты в комнате «${selectedRoom.label}»`);
      refreshParticipants(room);
    } catch (err) {
      if (room) {
        try { await room.disconnect(); } catch { /* no-op */ }
      }
      roomRef.current = null;
      setConnected(false);
      setParticipants([]);
      setError(err?.message || 'Не удалось подключиться. Проверь настройки и разрешение на микрофон.');
      setStatus('Не удалось подключиться');
    } finally {
      setJoining(false);
    }
  }

  async function leaveVoiceRoom() {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      try { await room.disconnect(); } catch { /* no-op */ }
    }
    setConnected(false);
    setMicEnabled(false);
    setParticipants([]);
    setActiveSpeakerIds([]);
    setStatus('Ты вышел из голосовой комнаты');
    if (audioContainerRef.current) audioContainerRef.current.innerHTML = '';
  }

  async function toggleMicrophone() {
    const room = roomRef.current;
    if (!room) return;
    const nextState = !micEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(nextState);
      setMicEnabled(nextState);
      refreshParticipants(room);
    } catch {
      setError('Не получилось переключить микрофон. Проверь разрешения браузера.');
    }
  }

  function sendMessage(event) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessages((current) => [...current, { name: displayName.trim() || 'Гость', text }]);
    setMessage('');
  }

  useEffect(() => () => {
    const room = roomRef.current;
    if (room) room.disconnect();
  }, []);

  return (
    <main className="app-shell">
      <aside className="server-rail">
        <div className="brand-mark">K</div>
        <div className="rail-divider" />
        <div className="server-icon selected">K</div>
        <div className="server-icon muted-icon">＋</div>
      </aside>

      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-name">KENTY</div>
          <span className="beta-tag">VOICE ALPHA</span>
        </div>

        <div className="sidebar-label">ПРОСТРАНСТВО</div>
        <button className={`nav-item ${tab === 'chat' ? 'selected' : ''}`} onClick={() => setTab('chat')}>
          <span className="nav-symbol">#</span> Текстовый чат
        </button>
        <button className={`nav-item ${tab === 'voice' ? 'selected' : ''}`} onClick={() => setTab('voice')}>
          <span className="nav-symbol">◖</span> Голосовые комнаты
        </button>

        <div className="sidebar-label voice-label">ГОЛОСОВЫЕ КОМНАТЫ</div>
        {VOICE_ROOMS.map((voiceRoom) => (
          <button
            className={`room-nav ${selectedRoom.id === voiceRoom.id ? 'room-selected' : ''}`}
            key={voiceRoom.id}
            onClick={() => { setSelectedRoom(voiceRoom); setTab('voice'); }}
            disabled={connected}
          >
            <span>{voiceRoom.icon}</span>
            <span>{voiceRoom.label}</span>
            {connected && selectedRoom.id === voiceRoom.id && <i className="online-dot" />}
          </button>
        ))}

        <div className="profile-card">
          <div className="profile-avatar">{(displayName.trim()[0] || 'G').toUpperCase()}</div>
          <div className="profile-meta">
            <b>{displayName.trim() || 'Гость'}</b>
            <small>{connected ? 'В голосовой комнате' : 'Не в сети'}</small>
          </div>
          <span className={`profile-status ${connected ? 'online' : ''}`} />
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-title">
            <span className="hash">{tab === 'chat' ? '#' : '◖'}</span>
            <b>{tab === 'chat' ? 'общий' : 'голосовые-комнаты'}</b>
          </div>
          <div className="topbar-right">
            <span className={`connection-pill ${connected ? 'connected' : ''}`}>
              <i /> {connected ? 'Подключено' : 'Не подключено'}
            </span>
            <span className="topbar-brand">KENTY · пространство для своих</span>
          </div>
        </header>

        {tab === 'voice' ? (
          <div className="voice-content">
            <div className="voice-heading">
              <div>
                <div className="eyebrow">REAL-TIME VOICE</div>
                <h1>Голосовые комнаты</h1>
                <p>Заходи к друзьям, общайся и оставайся на связи.</p>
              </div>
              <div className="voice-orb"><span>♫</span></div>
            </div>

            <div className="room-picker">
              {VOICE_ROOMS.map((voiceRoom) => (
                <button
                  key={voiceRoom.id}
                  className={`room-card ${selectedRoom.id === voiceRoom.id ? 'active' : ''}`}
                  onClick={() => setSelectedRoom(voiceRoom)}
                  disabled={connected || joining}
                >
                  <span className="room-card-icon">{voiceRoom.icon}</span>
                  <span className="room-card-title">{voiceRoom.label}</span>
                  <span className="room-card-description">{voiceRoom.description}</span>
                  <span className="room-card-arrow">↗</span>
                </button>
              ))}
            </div>

            {!connected ? (
              <form className="join-panel" onSubmit={joinVoiceRoom}>
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">ПОДКЛЮЧЕНИЕ</span>
                    <h2>Войти в «{selectedRoom.label}»</h2>
                  </div>
                  <span className="lock-mark">⌑</span>
                </div>

                <div className="form-grid">
                  <label>
                    <span>ТВОЁ ИМЯ</span>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Например, Alex"
                      maxLength={24}
                      autoComplete="nickname"
                    />
                  </label>
                  <label>
                    <span>ОБЩИЙ КОД ДОСТУПА</span>
                    <input
                      value={accessCode}
                      onChange={(event) => setAccessCode(event.target.value)}
                      placeholder="Код, который выдали друзьям"
                      type="password"
                      autoComplete="off"
                    />
                  </label>
                </div>

                {error && <div className="error-box">{error}</div>}

                <div className="join-bottom">
                  <div className="join-hint"><span>ⓘ</span> Друзья должны ввести тот же код доступа.</div>
                  <button className="primary-button" type="submit" disabled={joining}>
                    {joining ? 'Подключаем…' : 'Войти в комнату'} <span>→</span>
                  </button>
                </div>
              </form>
            ) : (
              <section className="live-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">ТЫ В КОМНАТЕ</span>
                    <h2>{selectedRoom.label}</h2>
                  </div>
                  <span className="live-badge"><i /> В ЭФИРЕ</span>
                </div>
                <div className="participant-heading">
                  <span>УЧАСТНИКИ</span>
                  <b>{participantCount}</b>
                </div>
                <div className="participant-list">
                  {participants.map((person) => (
                    <div className={`participant ${person.isSpeaking || activeSpeakers.has(person.identity) ? 'speaking' : ''}`} key={person.identity}>
                      <div className="participant-avatar">{(person.name[0] || 'Г').toUpperCase()}</div>
                      <div className="participant-name">
                        <b>{person.name}{person.isLocal ? ' (ты)' : ''}</b>
                        <small>{person.isSpeaking || activeSpeakers.has(person.identity) ? 'Говорит' : 'На связи'}</small>
                      </div>
                      <span className={`mic-state ${person.isMuted ? 'muted' : ''}`}>{person.isMuted ? 'Микрофон выкл.' : 'Микрофон вкл.'}</span>
                    </div>
                  ))}
                </div>
                <div className="voice-controls">
                  <button className={`control-button ${micEnabled ? '' : 'control-muted'}`} onClick={toggleMicrophone}>
                    <span>{micEnabled ? '🎙' : '🔇'}</span>
                    {micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
                  </button>
                  <button className="leave-button" onClick={leaveVoiceRoom}>Выйти из комнаты</button>
                </div>
              </section>
            )}

            <div className="status-line"><span className={connected ? 'status-live-dot' : ''} />{status}</div>
            <div className="alpha-note">Тестовая версия: для входа всем участникам нужен один общий код. Не используй здесь личные или чувствительные разговоры.</div>
            <div className="audio-bin" ref={audioContainerRef} aria-hidden="true" />
          </div>
        ) : (
          <div className="chat-content">
            <div className="chat-welcome">
              <div className="chat-welcome-icon">#</div>
              <h1>Добро пожаловать в #общий</h1>
              <p>Это временный текстовый чат для проверки интерфейса. История пока не сохраняется.</p>
            </div>
            <div className="chat-messages">
              {messages.map((item, index) => (
                <article className="chat-message" key={index}>
                  <div className="message-avatar">{item.name[0]}</div>
                  <div><b>{item.name}</b><p>{item.text}</p></div>
                </article>
              ))}
            </div>
            <form className="chat-composer" onSubmit={sendMessage}>
              <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Написать сообщение…" />
              <button type="submit">Отправить</button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
