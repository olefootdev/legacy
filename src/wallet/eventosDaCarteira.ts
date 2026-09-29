/**
 * "A posição mudou" — o aviso que faz as telas da carteira relerem.
 *
 * A aba DEX e o NETWORK leem do banco ao montar. Quem compra OLEFOOT sem sair
 * da tela veria a posição antiga até recarregar — e numa compra, o primeiro
 * número que a pessoa procura é o que acabou de pagar.
 *
 * Evento do navegador e não estado global: quem avisa (o checkout) não precisa
 * conhecer quem escuta, e nada disso entra no save do jogo.
 */
const EVENTO = 'olefoot:posicao-mudou';

export function avisarQueAPosicaoMudou(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO));
}

/** Devolve a função que cancela a escuta — pronta pra `useEffect`. */
export function aoMudarAPosicao(fazer: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENTO, fazer);
  return () => window.removeEventListener(EVENTO, fazer);
}
