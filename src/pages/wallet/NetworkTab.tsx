import { WalletShell } from './WalletShell';
import { PainelExpansao } from './network/PainelExpansao';
import { useMinhaExpansao } from './network/useMinhaExpansao';
import { SecaoVolt, Hashtag } from '@/components/ui';
import { useTrackScreen } from '@/progression/trackEvent';

/**
 * Wallet → NETWORK. A rede que paga: a expansão, e só ela.
 *
 * Desde 2026-09-30 é a ÚNICA rede do produto. O plano de marketing antigo —
 * ativação de R$ 125, carreira com bônus em dólar, comissão de 5% em três
 * níveis e marcos em EXP — foi cancelado pelo fundador. O código de cadastro
 * (`profiles.referred_by_code`) continua existindo por baixo: é por ele que
 * quem compra um pack sem convite acha o patrocinador na árvore.
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

    </WalletShell>
  );
}
