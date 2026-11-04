import { useState } from 'react';

const initial = [
  { name: 'KENTY', text: 'Добро пожаловать! Это начало твоего пространства.' },
  { name: 'Система', text: 'Напиши сообщение внизу, чтобы проверить интерфейс.' }
];

export default function App() {
  const [messages, setMessages] = useState(initial);
  const [value, setValue] = useState('');
  const [channel, setChannel] = useState('общий');
  function send(e) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    setMessages(m => [...m, { name: 'Ты', text }]);
    setValue('');
  }
  return <main className="shell">
    <aside className="rail"><div className="logo">K</div><div className="server active">K</div><div className="server">＋</div></aside>
    <aside className="sidebar">
      <div className="brand">KENTY <span>beta</span></div>
      <p className="muted">ТВОЁ ПРОСТРАНСТВО</p>
      <button className="channel selected" onClick={() => setChannel('общий')}>#　общий</button>
      <button className="channel" onClick={() => setChannel('знакомства')}>#　знакомства</button>
      <button className="channel" onClick={() => setChannel('мемы')}>#　мемы</button>
      <div className="profile"><div className="avatar">G</div><div><b>Гость</b><small>В сети</small></div><span className="dots">•••</span></div>
    </aside>
    <section className="chat">
      <header><div><small>КАНАЛ</small><h1># {channel}</h1></div><div className="header-right">KENTY · пространство для своих</div></header>
      <div className="messages">{messages.map((m,i)=><article className="message" key={i}><div className="avatar">{m.name[0]}</div><div><b>{m.name}</b><p>{m.text}</p></div></article>)}</div>
      <form className="composer" onSubmit={send}><input value={value} onChange={e=>setValue(e.target.value)} placeholder={`Написать в #${channel}`} /><button type="submit">Отправить</button></form>
      <footer>Это демонстрационная сборка KENTY · сообщения пока хранятся только в памяти страницы</footer>
    </section>
  </main>;
}
