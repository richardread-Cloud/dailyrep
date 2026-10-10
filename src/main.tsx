import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startDemoAnimation } from './lib/library';
import './styles.css';

startDemoAnimation();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// The installed app works offline through a service worker. The one-file test build (published inside another page) can't use one.
if (import.meta.env.PROD && import.meta.env.MODE !== 'artifact' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support unavailable */ }); });
}
// Ask the browser not to clear on-device data when space runs low.
void navigator.storage?.persist?.().catch(() => false);
