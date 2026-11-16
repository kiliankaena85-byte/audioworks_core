import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import '@fontsource/golos-text/700.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { tryTriggerChunkReload } from './utils/lazyWithRetry';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    if (tryTriggerChunkReload()) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
