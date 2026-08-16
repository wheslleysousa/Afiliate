import './utils/patchFetch';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ErrorToast } from './components/ErrorToast.tsx';
import { initGlobalErrorHandlers } from './utils/errorReporter.ts';
import './index.css';

initGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <ErrorToast />
    </ErrorBoundary>
  </StrictMode>,
);


