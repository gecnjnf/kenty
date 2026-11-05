import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initializeNativeShell, nativeEnvironment } from './native.js';
import './style.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);

initializeNativeShell();

if (!nativeEnvironment.isNative() && !nativeEnvironment.isElectron() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('KENTY service worker registration failed:', error);
    });
  });
}
