/**
 * PARTIDA VIVA — celular deitado.
 *
 * Android: tela cheia + `screen.orientation.lock('landscape')` (só funciona
 * dentro de um gesto do usuário e em tela cheia).
 * iPhone: não existe lock nem tela cheia pra página — o palco gira sozinho por
 * CSS quando o navegador está em retrato (ver `PartidaVivaPalco`), então
 * funciona com ou sem a trava de rotação do aparelho.
 */

type OrientacaoComLock = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/** Chamar DENTRO do handler de clique. Nunca lança. */
export async function deitarTela(): Promise<void> {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen && document.fullscreenEnabled) {
      await el.requestFullscreen({ navigationUI: 'hide' });
    }
    const o = screen.orientation as OrientacaoComLock | undefined;
    if (o?.lock) await o.lock('landscape');
  } catch {
    /* iPhone / desktop / sem permissão: o palco gira por CSS */
  }
}

/** Já sem barras do navegador: tela cheia (Android) ou aberto da tela de início (app instalado). */
export function semBarras(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return !!document.fullscreenElement || nav.standalone === true
    || window.matchMedia?.('(display-mode: fullscreen)').matches || window.matchMedia?.('(display-mode: standalone)').matches;
}

/** O navegador deixa a página entrar em tela cheia (Android/desktop sim; iPhone não). */
export function podeTelaCheia(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenEnabled && !!document.documentElement.requestFullscreen;
}

/** iPhone/iPad: tela cheia só instalando na tela de início. */
export function ehIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/**
 * Deitado, o iPhone reserva a margem do entalhe dos DOIS lados (safe-area
 * simétrica), mas a câmera fica só de um: 'esq' quando o aparelho girou pra
 * esquerda (topo à esquerda), 'dir' no outro sentido. Fora do iPhone deitado: null.
 */
export function ladoDoEntalhe(): 'esq' | 'dir' | null {
  if (typeof window === 'undefined' || !ehIOS() || window.innerHeight > window.innerWidth) return null;
  const legado = (window as Window & { orientation?: number }).orientation;
  const ang = typeof legado === 'number' ? legado : screen.orientation?.angle;
  if (ang === 90) return 'esq';
  if (ang === -90 || ang === 270) return 'dir';
  return null;
}

export async function levantarTela(): Promise<void> {
  try {
    screen.orientation?.unlock?.();
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* nada a desfazer */
  }
}

/**
 * Toque na tela → ponto local do campo. Com o palco girado 90° por CSS
 * (`rotate(90deg) translateY(-100%)`, origem no topo-esquerdo), o eixo x
 * local corre pela VERTICAL da tela e o y local, da direita pra esquerda.
 */
export function pontoLocal(
  clientX: number, clientY: number,
  caixa: { left: number; top: number; right: number },
  girado: boolean,
): { x: number; y: number } {
  return girado
    ? { x: clientY - caixa.top, y: caixa.right - clientX }
    : { x: clientX - caixa.left, y: clientY - caixa.top };
}
