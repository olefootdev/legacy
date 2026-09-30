/**
 * Prévia do NETWORK com dados de EXEMPLO — só em desenvolvimento
 * (rota /dev/network, montada atrás de `import.meta.env.DEV` no App).
 *
 * Existe porque o painel de expansão só desenha árvore, barra e carreira pra
 * quem está logado E dentro da árvore: sem isto não dá pra olhar o layout
 * localmente. Nada aqui chega à produção nem finge ser dado de alguém.
 *
 * O exemplo é o cenário que o fundador usou pra decidir a regra da carreira:
 * Time 1 maior que o Time 2, sobra que carrega, e gente que chegou por
 * derramamento misturada com a equipe própria.
 */
import { WalletShell } from '@/pages/wallet/WalletShell';
import { PainelExpansao } from '@/pages/wallet/network/PainelExpansao';
import type { MinhaExpansao } from '@/pages/wallet/network/useMinhaExpansao';
import { SecaoVolt, Hashtag } from '@/components/ui';

const no = (i: number, nivel: number, perna: 1 | 2, pai: number | null, minha = true) => ({
  userId: `ex-${i}`, nivel, yOrdem: i, perna, daMinhaEquipe: minha,
  paiId: pai === null ? null : `ex-${pai}`,
});

const EXEMPLO: MinhaExpansao = {
  carregando: false,
  naArvore: true,
  padrinho: 'origem',
  username: 'exemplo',
  convida: true,
  ativacao: { ativo: true, diretosT1: 2, diretosT2: 1, faltaNaPerna: null },
  pernas: { t1: 1_260n, t2: 510n, menor: 510n },
  carreira: { acumulado: 6_400n, degrau: null, proximo: 'CAMPEAO', falta: 3_600n },
  mapa: [
    no(1, 1, 1, null), no(2, 1, 2, null),
    no(3, 2, 1, 1), no(4, 2, 1, 1, false), no(5, 2, 2, 2),
    no(6, 3, 1, 3), no(7, 3, 1, 4, false), no(8, 3, 2, 5, false),
    no(9, 4, 1, 6),
  ],
  bonus: { usdCents: 4_185n, olefoot: 334_800n, olefootSacado: 0n, ciclosPagos: 3, pernaPadrao: null,
    hojeUsdCents: 1_850_00n, tetoDiarioCents: 2_500_00n },
  ciclos: [
    { abreEm: '2026-09-30T14:00:00Z', status: 'SETTLED', poolUsdCents: 1_562n, equiparadoTotal: 740n, valorPorOlexpMicro: 25_000_000n, bonusTotalUsdCents: 18_500n },
    { abreEm: '2026-09-30T11:00:00Z', status: 'SETTLED', poolUsdCents: 31_250n, equiparadoTotal: 9_400n, valorPorOlexpMicro: 25_000_000n, bonusTotalUsdCents: 2_350_00n },
  ],
  reler: () => {},
};

const FALTA_ATIVAR: MinhaExpansao = {
  ...EXEMPLO,
  ativacao: { ativo: false, diretosT1: 1, diretosT2: 0, faltaNaPerna: 2 },
  pernas: { t1: 80n, t2: 0n, menor: 0n },
  carreira: { acumulado: 0n, degrau: null, proximo: 'CAMPEAO', falta: 10_000n },
  mapa: [no(1, 1, 1, null)],
};

// As duas telas que mostram "Tenho uma licença".
const SEM_ATIVACAO: MinhaExpansao = { ...FALTA_ATIVAR, convida: false };
const FORA: MinhaExpansao = { ...EXEMPLO, naArvore: false, convida: false };

export default function NetworkPreview() {
  const qual = new URLSearchParams(window.location.search).get('estado');
  const dados = qual === 'falta' ? FALTA_ATIVAR : qual === 'semativacao' ? SEM_ATIVACAO
    : qual === 'fora' ? FORA : EXEMPLO;
  return (
    <WalletShell title="Network" hashtag="#network · exemplo" heroVariant="compact" voltar>
      <section className="min-w-0 space-y-3">
        <SecaoVolt label="Expansão">
          <Hashtag>#equiparacao #time1 #time2</Hashtag>
        </SecaoVolt>
        <PainelExpansao dados={dados} />
      </section>
    </WalletShell>
  );
}
