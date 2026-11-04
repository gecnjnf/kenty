import { randomUUID, timingSafeEqual } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';

const ALLOWED_ROOMS = new Set(['lobby', 'gaming', 'chill']);

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Разрешён только POST-запрос.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const roomName = typeof body.roomName === 'string' ? body.roomName : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName : '';
    const accessCode = typeof body.accessCode === 'string' ? body.accessCode : '';

    if (!ALLOWED_ROOMS.has(roomName)) {
      return res.status(400).json({ error: 'Выбери одну из доступных голосовых комнат.' });
    }

    const safeName = displayName
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}_ -]/gu, '')
      .trim()
      .slice(0, 24);

    if (safeName.length < 2) {
      return res.status(400).json({ error: 'Имя должно содержать минимум 2 символа.' });
    }

    const expectedCode = process.env.KENTY_VOICE_ACCESS_CODE;
    if (!expectedCode) {
      return res.status(503).json({ error: 'Голосовой сервер ещё не настроен: добавь переменные LiveKit в Vercel.' });
    }
    if (!accessCode || !safeEqual(accessCode, expectedCode)) {
      return res.status(401).json({ error: 'Неверный код доступа к голосовым комнатам.' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const serverUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !serverUrl) {
      return res.status(503).json({ error: 'Не хватает настроек LiveKit в Vercel. Проверь LIVEKIT_URL, LIVEKIT_API_KEY и LIVEKIT_API_SECRET.' });
    }

    if (!/^wss:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(serverUrl)) {
      return res.status(500).json({ error: 'LIVEKIT_URL должен начинаться с wss:// и содержать адрес проекта LiveKit.' });
    }

    const identity = `guest-${randomUUID()}`;
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: safeName,
      ttl: '30m'
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false
    });

    const participantToken = await token.toJwt();

    return res.status(200).json({
      serverUrl,
      participantToken,
      identity,
      displayName: safeName,
      roomName
    });
  } catch (error) {
    console.error('KENTY LiveKit token error:', error);
    return res.status(500).json({ error: 'Не удалось подготовить подключение к голосовой комнате.' });
  }
}
