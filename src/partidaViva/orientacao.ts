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
