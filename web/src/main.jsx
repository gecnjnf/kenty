import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initializeNativeShell, nativeEnvironment } from './native.js';
import './style.css';

class KentyErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Keep diagnostics local; never send session data or secrets to a third party.
    console.error('KENTY interface error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <main className="app-error-screen" role="alert">
        <div className="app-error-card">
          <div className="app-error-mark">K</div>
          <h1>Что-то пошло не так</h1>
          <p>KENTY столкнулся с ошибкой интерфейса. Обнови приложение — переписки и аккаунт останутся в базе.</p>
          <button type="button" onClick={() => window.location.reload()}>Перезагрузить KENTY</button>
        </div>
      </main>;
    }
    return this.props.children;
  }
}


createRoot(document.getElementById('root')).render(
  <React.StrictMode><KentyErrorBoundary><App /></KentyErrorBoundary></React.StrictMode>
);

initializeNativeShell();

if (!nativeEnvironment.isNative() && !nativeEnvironment.isElectron() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('KENTY service worker registration failed:', error);
    });
  });
}
