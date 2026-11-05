import { useEffect, useState } from 'react';

function readNetworkQuality(connection) {
  if (!connection) return 'unknown';
  const effectiveType = connection.effectiveType;
  const downlink = Number(connection.downlink) || 0;
  if (effectiveType === 'slow-2g' || effectiveType === '2g' || (downlink > 0 && downlink < 0.8)) return 'weak';
  if (effectiveType === '3g' || (downlink > 0 && downlink < 1.5)) return 'moderate';
  return 'good';
}

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [quality, setQuality] = useState('unknown');

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const updateOnline = () => setIsOnline(navigator.onLine);
    const updateQuality = () => setQuality(readNetworkQuality(connection));

    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    connection?.addEventListener?.('change', updateQuality);
    updateQuality();

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      connection?.removeEventListener?.('change', updateQuality);
    };
  }, []);

  const label = !isOnline ? 'Нет интернета'
    : quality === 'weak' ? 'Слабая сеть'
    : quality === 'moderate' ? 'Средняя сеть'
    : quality === 'good' ? 'Хорошая сеть'
    : 'Интернет есть';
  const statusClass = !isOnline ? 'network-offline'
    : quality === 'weak' ? 'network-weak'
    : quality === 'moderate' ? 'network-moderate'
    : 'network-online';
  const title = !isOnline
    ? 'Нет сетевого подключения'
    : quality === 'unknown'
      ? 'Браузер не предоставляет оценку качества сети'
      : 'Оценка качества по данным браузера; фактическое качество звонка может отличаться';

  return <span className={'network-pill ' + statusClass} title={title} role="status" aria-live="polite">
    <i />{label}
  </span>;
}
