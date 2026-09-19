import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// Fontes do VOLT2 servidas do próprio domínio (a CSP não aceita Google Fonts).
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/inter-tight';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './index.css';
import { initFontLoading } from './lib/fontLoader';

// Inicializa carregamento de fontes
initFontLoading();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
