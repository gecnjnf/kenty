import { randomUUID } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';

const ALLOWED_ROOMS = new Set(['lobby', 'gaming', 'chill']);


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Разрешён только POST-запрос.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const roomName = typeof body.roomName === 'string' ? body.roomName : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName : '';

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

    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!bearer || !supabaseUrl || !supabaseAnonKey) {
      return res.status(401).json({ error: 'Войди в аккаунт KENTY, чтобы подключиться к голосовой комнате.' });
    }
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${bearer}` }
    });
    if (!authResponse.ok) {
      return res.status(401).json({ error: 'Сессия истекла. Войди в KENTY заново.' });
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
