import { WalletShell } from './WalletShell';
import { PainelExpansao } from './network/PainelExpansao';
import { IndicacaoDoJogo } from './network/IndicacaoDoJogo';
import { useMinhaExpansao } from './network/useMinhaExpansao';
import { SecaoVolt, Hashtag } from '@/components/ui';
import { useTrackScreen } from '@/progression/trackEvent';

/**
 * Wallet → NETWORK. A rede inteira num endereço.
 *
 * Eram três telas falando de rede, cada uma com um pedaço:
 *   `/expansao`         a árvore binária e a equiparação, solta fora do menu
 *   `/wallet/referrals` o código de cadastro e os indicados
 *   `/manager/network`  marcos, carreira do jogo e amizades
 * As duas primeiras moram aqui agora. A terceira ainda não migrou — os blocos
 * de dinheiro dela entram aqui, e as amizades ficam no Manager.
 *
 * A ordem é de propósito: EXPANSÃO em cima, porque é ela que paga; a indicação
 * do jogo embaixo, porque é por ela que a rede começa.
 *
 * Abre SEM PIN: é daqui que se copia o convite, e convite atrás de senha é
 * convite que não sai.
 */

export function NetworkTab() {
  useTrackScreen('screen_wallet');
  const expansao = useMinhaExpansao();

  // O herói fica SEM números de propósito. O equiparado e a carreira já são o
  // topo do painel logo abaixo, com a linha que ensina a ler ("é o menor dos
  // dois times"). Repetir em cima daria o mesmo saldo duas vezes na mesma tela.
  return (
    <WalletShell title="Network" hashtag="#network" heroVariant="compact" voltar>
      <section className="min-w-0 space-y-3">
        <SecaoVolt label="Expansão">
          <Hashtag>#equiparacao #time1 #time2</Hashtag>
        </SecaoVolt>
        <PainelExpansao dados={expansao} />
      </section>

      <IndicacaoDoJogo />
    </WalletShell>
  );
}
