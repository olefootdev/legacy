import { STYLE_PRESETS, styleActionBias } from '@/tactics/playingStyle';

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
  const crossWide = styleActionBias(STYLE_PRESETS.wide_crossing, 'cross', wingTags);
  const crossTiki = styleActionBias(STYLE_PRESETS.tiki_positional, 'cross', wingTags);
  assert(crossWide > crossTiki, 'wide_crossing should bias cross more than tiki_positional (wing)');

  const holdLow = styleActionBias(STYLE_PRESETS.low_block_counter, 'hold', undefined);
  const holdDirect = styleActionBias(STYLE_PRESETS.direct_long_ball, 'hold', undefined);
  assert(holdLow >= holdDirect, 'low_block_counter should bias hold at least as much as direct_long_ball');

  const longDirect = styleActionBias(STYLE_PRESETS.direct_long_ball, 'pass_long', undefined);
  const longTiki = styleActionBias(STYLE_PRESETS.tiki_positional, 'pass_long', undefined);
  assert(longDirect >= longTiki, 'direct_long_ball should bias long pass at least as much as tiki_positional');

  console.log('playing-style self-test: ok');
}

main();
