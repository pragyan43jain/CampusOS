import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { MobileBridge } from './services/mobileBridge';

// Initialize native mobile app hooks (Capacitor status bar, splash screen, hardware back button)
MobileBridge.initNativeApp();

// Register PWA service worker in production or standalone mode
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && (import.meta as any).env?.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.debug('[CampusOS] PWA Service Worker registered successfully with scope:', reg.scope);
      })
      .catch((err) => {
        console.debug('[CampusOS] PWA Service Worker registration notice:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
