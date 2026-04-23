import { STYLE_PRESETS, canonicalizePresetId, styleActionBias } from '@/tactics/playingStyle';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const wingTags = ['attacking_third', 'wide'] as const;

/**
 * chooseAction é determinístico (argmax); com muitas opções, papel/arquétipo/capacidade
 * dominam e o contador não reflete o viés de estilo. Aqui validamos o contrato numérico
 * após normalizeStyle (100 pts → frações), que é o que o motor usa.
 */
function main() {
  assert(canonicalizePresetId('tiki_positional') === 'POSSE_CONTROLADA', 'legacy preset id migrates');
  assert(canonicalizePresetId('POSSE_CONTROLADA') === 'POSSE_CONTROLADA', 'canonical preset id unchanged');

  const crossWide = styleActionBias(STYLE_PRESETS.JOGO_PELAS_LATERAIS, 'cross', wingTags);
  const crossTiki = styleActionBias(STYLE_PRESETS.POSSE_CONTROLADA, 'cross', wingTags);
  assert(crossWide > crossTiki, 'JOGO_PELAS_LATERAIS should bias cross more than POSSE_CONTROLADA (wing)');

  const holdLow = styleActionBias(STYLE_PRESETS.BLOCO_BAIXO, 'hold', undefined);
  const holdDirect = styleActionBias(STYLE_PRESETS.JOGO_DIRETO, 'hold', undefined);
  assert(holdLow >= holdDirect, 'BLOCO_BAIXO should bias hold at least as much as JOGO_DIRETO');

  const longDirect = styleActionBias(STYLE_PRESETS.JOGO_DIRETO, 'pass_long', undefined);
  const longTiki = styleActionBias(STYLE_PRESETS.POSSE_CONTROLADA, 'pass_long', undefined);
  assert(longDirect >= longTiki, 'JOGO_DIRETO should bias long pass at least as much as POSSE_CONTROLADA');

  console.log('playing-style self-test: ok');
}

main();
