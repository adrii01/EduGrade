import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against getter-only fetch in iframe environments
try {
  const currentFetch = window.fetch;
  let activeFetch = currentFetch;
  Object.defineProperty(window, 'fetch', {
    get() {
      return activeFetch;
    },
    set(newFetch) {
      activeFetch = newFetch;
    },
    configurable: true,
    enumerable: true,
  });
} catch (_) {
  // Silent fallback
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
