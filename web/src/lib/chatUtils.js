export const messageTimeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function formatMessageTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : messageTimeFormatter.format(date);
}

export const IMAGE_MESSAGE_PREFIX = 'kenty-image:v1:';

export function getImagePath(content) {
  if (typeof content !== 'string' || !content.startsWith(IMAGE_MESSAGE_PREFIX)) return null;
  const path = content.slice(IMAGE_MESSAGE_PREFIX.length);
  const parts = path.split('/');
  return parts.length === 3 && parts.every(Boolean) ? path : null;
}

export const VOICE_ROOMS = [
  { id: 'lobby', label: 'Общая', description: 'Для разговоров обо всём', icon: '◉' },
  { id: 'gaming', label: 'Игровая', description: 'Собираемся поиграть', icon: '🎮' },
  { id: 'chill', label: 'Тихая', description: 'Спокойное общение', icon: '☾' }
];
