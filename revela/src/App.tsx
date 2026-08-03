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
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthSheet } from './components/AuthSheet';
import { ComoFuncionaPage } from './pages/ComoFuncionaPage';
import { DnaTestPage } from './pages/DnaTestPage';
import { MeuPerfilPage } from './pages/MeuPerfilPage';
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
import { ResetSenhaPage } from './pages/ResetSenhaPage';
import { ShortLink } from './pages/ShortLink';
import { TalentPage } from './pages/TalentPage';
import { Footer, Nav } from './sections/Top';

export default function App() {
  const [session, setSession] = useState<RevelaSession | null>(null);
  const [authReason, setAuthReason] = useState<string | null>(null);
  const { message, push } = useToast();

  /**
   * A ação que a pessoa TENTOU fazer antes de a folha de conta aparecer.
   *
   * Sem isto, quem clica em "SOU FÃ", cria a conta e volta pra tela encontra o
   * mesmo botão intocado — e precisa lembrar de clicar de novo. Bem no ponto de
   * maior atrito do funil, que é justamente onde a campanha não pode perder
   * ninguém.
   */
  const pendente = useRef<(() => void) | null>(null);

  useEffect(() => {
    captureReferralFromUrl();
    void currentSession().then(setSession);
    return onSessionChange((s) => {
      setSession(s);
      if (!s || !pendente.current) return;
      const acao = pendente.current;
      pendente.current = null;
      // Um tick depois: o estado de sessão das páginas precisa ter descido
      // antes, senão a ação roda de novo sem credencial.
      setTimeout(acao, 0);
    });
  }, []);

  const requireAuth = useCallback((reason: string, aoEntrar?: () => void) => {
    pendente.current = aoEntrar ?? null;
    setAuthReason(reason);
  }, []);

  return (
    <BrowserRouter>
      <Nav
        session={session}
        onLogin={() => requireAuth('Entra pra apoiar e salvar teu time')}
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
        {/* O painel do atleta. Precisa vir ANTES de /:short — senão o
            catch-all de handle engoliria "meu-perfil" como se fosse um @. */}
        <Route
          path="/meu-perfil"
          element={<MeuPerfilPage session={session} requireAuth={requireAuth} onNote={push} />}
        />
        {/* O teste de DNA. Também antes de /:short, pelo mesmo motivo do
            painel: "dna" seria engolido como se fosse um @. */}
        <Route
          path="/dna"
          element={<DnaTestPage session={session} requireAuth={requireAuth} onNote={push} />}
        />
        {/* Definir senha. O e-mail de recuperação volta PRA CÁ porque o
            `redirectTo` é montado do `window.location.origin` — sessão do
            supabase-js é por origem, e link que caísse no domínio do jogo
            deixaria a pessoa deslogada aqui. Antes de /:short, como as outras. */}
        <Route path="/reset-senha" element={<ResetSenhaPage onNote={push} />} />
        <Route path="/como-funciona" element={<ComoFuncionaPage session={session} />} />
        <Route path="/lenda/:slug" element={<LegendPage onNote={push} />} />
        {/* Alias: links de /playervip/<handle> compartilhados por aí continuam
            funcionando se apontarem pra este domínio. A estrutura de divulgação
            do playervip fica de pé; só a casca mudou. */}
        <Route path="/playervip/:slug" element={<LegendPage onNote={push} />} />
        {/* O link CURTO do jogador: revela.olefoot.com/<handle>. Menos específico
            que as rotas acima (/comecar, /t/... vencem), mais que o catch-all.
            Resolve o @ → perfil + indicação, ou trata como código de indicação. */}
        <Route path="/:short" element={<ShortLink />} />
        <Route path="*" element={<Home session={session} requireAuth={requireAuth} onNote={push} />} />
      </Routes>

      <Footer />

      <AuthSheet open={authReason !== null} reason={authReason ?? ''} onClose={() => setAuthReason(null)} />
      <Toast message={message} />
    </BrowserRouter>
  );
}
