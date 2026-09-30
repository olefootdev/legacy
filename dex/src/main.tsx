import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Fontes servidas do próprio domínio — a CSP bloqueia o Google Fonts.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/inter-tight';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './olewallet.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root não encontrado');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
