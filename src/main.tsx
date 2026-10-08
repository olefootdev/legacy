import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// Fontes do VOLT2 servidas do próprio domínio (a CSP não aceita Google Fonts).
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/inter-tight';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
// DS 2027 "Respeito é ouro": a voz, o spray e a prova.
import '@fontsource/pirata-one/400';
import '@fontsource/big-shoulders-stencil-display/900';
import '@fontsource/geist-mono/400';
import '@fontsource/geist-mono/500';
import '@fontsource/geist-mono/700';
import './index.css';
import { initFontLoading } from './lib/fontLoader';

// Inicializa carregamento de fontes
initFontLoading();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
