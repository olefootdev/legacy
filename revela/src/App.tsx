/**
 * OLEFOOT REVELA — casca e rotas.
 *
 * A CASCA É O ARGUMENTO. Nav, rodapé, folha de login e toast vivem aqui, fora
 * das rotas, porque é exatamente isso que faz a página da lenda não parecer
 * outro site: o topo não pisca, a identidade não troca, a sessão não some.
 *
 * Antes, o card de lenda mandava pra `game.olefoot.com/playervip/<handle>` —
 * outra linguagem visual, outro domínio. A pessoa sentia que tinha caído num
 * lugar diferente bem na hora em que ia decidir comprar. Agora a vitrine da
 * lenda é uma rota daqui, com a mesma cara.
 */
import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthSheet } from './components/AuthSheet';
import { Toast, useToast } from './components/primitives';
import {
  captureReferralFromUrl,
  currentSession,
  onSessionChange,
  signOut,
  type RevelaSession,
} from './data/session';
import { Home } from './pages/Home';
import { LegendPage } from './pages/LegendPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { TalentPage } from './pages/TalentPage';
import { Footer, Nav } from './sections/Top';

export default function App() {
  const [session, setSession] = useState<RevelaSession | null>(null);
  const [authReason, setAuthReason] = useState<string | null>(null);
  const { message, push } = useToast();

  useEffect(() => {
    captureReferralFromUrl();
    void currentSession().then(setSession);
    return onSessionChange(setSession);
  }, []);

  const requireAuth = useCallback((reason: string) => setAuthReason(reason), []);

  return (
    <BrowserRouter>
      <Nav
        session={session}
        onLogin={() => setAuthReason('Entra pra apoiar e salvar teu time')}
        onLogout={() => void signOut()}
      />

      <Routes>
        <Route path="/" element={<Home session={session} requireAuth={requireAuth} onNote={push} />} />
        {/* O endereço do atleta. Curto de propósito: cabe num story, numa bio
            de Instagram, num print de grupo. É o link que ele vai postar. */}
        <Route
          path="/t/:slug"
          element={<TalentPage session={session} requireAuth={requireAuth} onNote={push} />}
        />
        {/* O passo 1 tem endereço próprio. Antes era uma âncora no rodapé da
            home — quem clicava em "criar perfil" caía no fim de tudo, sem
            entender que aquilo abria uma jornada de 7 passos. */}
        <Route
          path="/comecar"
          element={<OnboardingPage onNote={push} />}
        />
        <Route path="/lenda/:slug" element={<LegendPage onNote={push} />} />
        {/* Alias: links de /playervip/<handle> compartilhados por aí continuam
            funcionando se apontarem pra este domínio. A estrutura de divulgação
            do playervip fica de pé; só a casca mudou. */}
        <Route path="/playervip/:slug" element={<LegendPage onNote={push} />} />
        <Route path="*" element={<Home session={session} requireAuth={requireAuth} onNote={push} />} />
      </Routes>

      <Footer />

      <AuthSheet open={authReason !== null} reason={authReason ?? ''} onClose={() => setAuthReason(null)} />
      <Toast message={message} />
    </BrowserRouter>
  );
}
