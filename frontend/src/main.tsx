import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global spotlight pointer sync for all cards across the application
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      const winW = window.innerWidth || 1;
      const winH = window.innerHeight || 1;
      document.documentElement.style.setProperty('--x', x.toFixed(1));
      document.documentElement.style.setProperty('--xp', (x / winW).toFixed(3));
      document.documentElement.style.setProperty('--y', y.toFixed(1));
      document.documentElement.style.setProperty('--yp', (y / winH).toFixed(3));
    },
    { passive: true }
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
