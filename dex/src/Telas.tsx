import { tradutor } from '@/i18n/idioma';
import { useIdioma } from '@/i18n/useIdioma';
import { TEXTOS } from './textos';
import { AindaNao } from './Abas';

/**
 * As telas que o desenho pede e cujo motor ainda não existe.
 *
 * 🔑 Elas EXISTEM em vez de não existir, e dizem o que falta em vez de fingir.
 * Uma aba que não abre é bug; uma aba que abre e explica é produto.
 *
 * Comprar e Render moraram aqui até a Fase 6. Saíram porque eram CÓPIA: os
 * números de rendimento e divisão viviam também em server/src/lib/earningsRegras.ts,
 * e cópia diverge calada. Quem diz esses números agora é a aba DEX da carteira
 * do jogo, que lê tudo de GET /api/earnings — um lugar só.
 */

export function TelaDepositar() {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  return <AindaNao titulo={t('acaoDepositar')} oQueFalta={t('depositarFalta')} />;
}

export function TelaEnviar() {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  return <AindaNao titulo={t('acaoEnviar')} oQueFalta={t('enviarFalta')} />;
}
