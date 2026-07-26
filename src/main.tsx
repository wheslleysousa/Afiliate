// Patch window.fetch setter to prevent errors when libraries attempt global fetch assignment
if (typeof window !== 'undefined' && window.fetch) {
  try {
    let originalFetch = window.fetch;
    Object.defineProperty(window, 'fetch', {
      get() {
        return originalFetch;
      },
      set(newFetch) {
        originalFetch = newFetch;
      },
      configurable: true,
      enumerable: true,
    });
  } catch (e) {
    console.warn('Failed to patch window.fetch:', e);
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
