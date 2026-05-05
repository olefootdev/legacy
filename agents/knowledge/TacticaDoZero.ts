/**
 * /agents/knowledge/TacticaDoZero.ts
 *
 * Knowledge base extraída do ebook "Táctica do Zero" (charliedt17).
 * Princípios táticos reais de futebol traduzidos para o motor de agentes.
 *
 * Fonte: 159 páginas cobrindo zonas, fases, princípios ofensivos/defensivos
 * e comportamentos por posição.
 */

// ── Fases do jogo (4 momentos canônicos) ─────────────────────────────────────

export type GameMoment =
  | 'FASE_OFENSIVA'        // posse de bola — criar e progredir
  | 'TRANSICAO_OFENSIVA'   // recuperou a bola — adversário desorganizado
  | 'FASE_DEFENSIVA'       // sem posse — impedir avanço
  | 'TRANSICAO_DEFENSIVA'; // perdeu a bola — reorganizar imediatamente

// ── Princípios táticos defensivos ────────────────────────────────────────────

export interface DefensivePrinciples {
  // Marcação: homem, zona ou misto
  marking: 'man' | 'zone' | 'mixed';
  // Cobertura: apoio ao companheiro que está marcando
  coverage: boolean;
  // Pressão: ir ao encontro do portador para interromper
  pressing: 'none' | 'partial' | 'total';
  // Basculamento: mover o bloco para o lado da bola
  basculation: boolean;
  // Recuo: retornar à posição defensiva
  retreat: 'individual' | 'collective';
  // Temporização: frear sem entrar no duelo, aguardar ajuda
  delay: boolean;
  // Redução de espaços: compactar linhas
  compactness: 'low' | 'medium' | 'high';
}

// ── Princípios táticos ofensivos ──────────────────────────────────────────────

export interface OffensivePrinciples {
  // Desmarque: movimento sem bola para receber em melhor posição
  // 'support' = não ultrapassa o portador | 'run' = ultrapassa
  demarking: 'support' | 'run' | 'none';
  // Apoio: aproximar-se do portador para dar continuidade
  support: boolean;
  // Amplitude: manter largura para esticar a defesa
  width: boolean;
  // Profundidade: movimentos verticais em direção ao gol
  depth: boolean;
  // Circulação: deslocar a bola de um lado para o outro
  circulation: boolean;
  // Progressão: transportar ou enviar a bola em direção ao adversário
  progression: boolean;
  // Tabela: combinação rápida 1-2 para superar adversário
  wallPass: boolean;
  // Desdobramento: projeção de jogador de trás para criar superioridade
  overlap: boolean;
  // Superioridade numérica na zona da bola
  numericalSuperiority: boolean;
}

// ── Comportamento por posição (extraído do ebook) ────────────────────────────

export interface PositionBehavior {
  positionName: string;
  // O que fazer em cada fase
  inPossession: string[];
  outOfPossession: string[];
  transitionAttack: string[];
  transitionDefense: string[];
  // Princípios que se aplicam
  offensivePrinciples: Partial<OffensivePrinciples>;
  defensivePrinciples: Partial<DefensivePrinciples>;
  // Zonas permitidas (profundidade: 1=defensiva, 2=construção, 3=criação, 4=finalização)
  allowedZoneDepths: number[];
  // Nunca avançar além desta zona de profundidade
  maxZoneDepth: number;
}

// ── Catálogo de comportamentos por posição ────────────────────────────────────

export const POSITION_BEHAVIORS: Record<string, PositionBehavior> = {

  GK: {
    positionName: 'Goleiro',
    inPossession: [
      'Iniciar o jogo com passe curto para os zagueiros ou longo para os flancos',
      'Posicionar-se como primeiro atacante na saída de bola',
      'Escolher opções que gerem superioridade ou progressão efetiva',
    ],
    outOfPossession: [
      'Controlar ângulos: alinhar-se entre a bola e o centro do gol',
      'Avançar para reduzir o ângulo quando atacante se aproxima em diagonal',
      'Cobrir o espaço atrás da linha defensiva adiantada',
      'Organizar a linha defensiva com comunicação constante',
      'Dominar a área em cruzamentos e escanteios',
    ],
    transitionAttack: [
      'Reiniciar rapidamente com passe curto ao zagueiro mais próximo',
      'Optar por lançamento longo se houver espaço nas costas da defesa adversária',
    ],
    transitionDefense: [
      'Retornar imediatamente à linha do gol',
      'Nunca avançar além da área após perda de posse',
    ],
    offensivePrinciples: { support: true, progression: false },
    defensivePrinciples: { pressing: 'none', retreat: 'individual', compactness: 'high', delay: true },
    allowedZoneDepths: [1],
    maxZoneDepth: 1,
  },

  CB_L: {
    positionName: 'Zagueiro Central Esquerdo',
    inPossession: [
      'Circular a bola com segurança para o companheiro mais livre',
      'Lançamento diagonal para os corredores externos quando há espaço',
      'Conduzir para atrair marcação e liberar companheiro',
      'Apoio entre linhas: conectar defesa e meio-campo',
    ],
    outOfPossession: [
      'Marcação zonal ou individual conforme a situação',
      'Manter o bloco compacto — nunca perseguir a bola para o meio-campo',
      'Coberturas e dobragens ao lateral quando ele é superado',
      'Temporizar após perda de posse — não entrar no duelo sozinho',
      'Direcionar a linha defensiva: aproximar ou recuar para o impedimento',
    ],
    transitionAttack: [
      'Passe vertical rápido ao meio-campista ou atacante',
      'Se não houver passe vertical, circular com segurança',
    ],
    transitionDefense: [
      'Recuar imediatamente à linha defensiva',
      'Manter bloco compacto com o outro zagueiro',
    ],
    offensivePrinciples: { support: true, circulation: true, depth: false, width: false },
    defensivePrinciples: { marking: 'mixed', coverage: true, pressing: 'partial', basculation: true, retreat: 'collective', compactness: 'high', delay: true },
    allowedZoneDepths: [1, 2],
    maxZoneDepth: 2,
  },

  CB_R: {
    positionName: 'Zagueiro Central Direito',
    inPossession: [
      'Circular a bola com segurança',
      'Lançamento diagonal para os corredores externos',
      'Conduzir para atrair marcação e liberar companheiro',
    ],
    outOfPossession: [
      'Marcação zonal ou individual',
      'Manter bloco compacto',
      'Coberturas ao lateral direito quando superado',
      'Temporizar — não entrar no duelo sozinho',
    ],
    transitionAttack: [
      'Passe vertical rápido ao meio-campista',
      'Circular com segurança se não houver passe vertical',
    ],
    transitionDefense: [
      'Recuar imediatamente',
      'Manter linha com CB_L',
    ],
    offensivePrinciples: { support: true, circulation: true, depth: false, width: false },
    defensivePrinciples: { marking: 'mixed', coverage: true, pressing: 'partial', basculation: true, retreat: 'collective', compactness: 'high', delay: true },
    allowedZoneDepths: [1, 2],
    maxZoneDepth: 2,
  },

  LB: {
    positionName: 'Lateral Esquerdo',
    inPossession: [
      'Oferecer largura no corredor esquerdo',
      'Overlap com o LM quando há espaço e segurança',
      'Cruzamento para a área quando na zona de criação',
      'Apoio ao zagueiro na saída de bola',
    ],
    outOfPossession: [
      'Marcação 1x1 no corredor esquerdo',
      'Cobertura ao zagueiro central quando ele sai da posição',
      'Basculamento: mover-se para o lado da bola',
      'Nunca abandonar o corredor quando o adversário tem largura',
    ],
    transitionAttack: [
      'Subir pelo corredor esquerdo imediatamente',
      'Oferecer opção de passe em largura',
    ],
    transitionDefense: [
      'Sprint de volta à posição defensiva',
      'Prioridade: fechar o corredor esquerdo antes de qualquer coisa',
    ],
    offensivePrinciples: { width: true, overlap: true, support: true, depth: true },
    defensivePrinciples: { marking: 'man', coverage: true, pressing: 'partial', basculation: true, retreat: 'individual', compactness: 'medium', delay: false },
    allowedZoneDepths: [1, 2, 3],
    maxZoneDepth: 3,
  },

  RB: {
    positionName: 'Lateral Direito',
    inPossession: [
      'Oferecer largura no corredor direito',
      'Overlap com o RM quando há espaço',
      'Cruzamento para a área',
    ],
    outOfPossession: [
      'Marcação 1x1 no corredor direito',
      'Cobertura ao zagueiro central direito',
      'Basculamento para o lado da bola',
    ],
    transitionAttack: [
      'Subir pelo corredor direito',
      'Oferecer largura imediatamente',
    ],
    transitionDefense: [
      'Sprint de volta à posição',
      'Fechar o corredor direito',
    ],
    offensivePrinciples: { width: true, overlap: true, support: true, depth: true },
    defensivePrinciples: { marking: 'man', coverage: true, pressing: 'partial', basculation: true, retreat: 'individual', compactness: 'medium', delay: false },
    allowedZoneDepths: [1, 2, 3],
    maxZoneDepth: 3,
  },

  LM: {
    positionName: 'Meia Esquerdo',
    inPossession: [
      'Manter amplitude no corredor esquerdo',
      'Receber do LB e progredir',
      'Cruzamento quando na zona de finalização',
      'Cortar para dentro quando o espaço abre',
      'Desmarque de ruptura: ultrapassar o portador para receber em profundidade',
    ],
    outOfPossession: [
      'Pressão alta no corredor esquerdo',
      'Rastrear o lateral adversário',
      'Interromper linhas de passe no corredor',
      'Pressão imediata após perda',
    ],
    transitionAttack: [
      'Sprint para o corredor esquerdo imediatamente',
      'Criar largura para abrir espaço central',
    ],
    transitionDefense: [
      'Recuar à linha do meio-campo',
      'Não deixar o LB exposto',
    ],
    offensivePrinciples: { width: true, depth: true, demarking: 'run', support: true, overlap: false },
    defensivePrinciples: { pressing: 'total', marking: 'man', basculation: true, retreat: 'individual', compactness: 'medium', delay: false },
    allowedZoneDepths: [2, 3, 4],
    maxZoneDepth: 4,
  },

  RM: {
    positionName: 'Meia Direito',
    inPossession: [
      'Manter amplitude no corredor direito',
      'Receber do RB e progredir',
      'Cruzamento quando na zona de finalização',
      'Desmarque de ruptura em profundidade',
    ],
    outOfPossession: [
      'Pressão alta no corredor direito',
      'Rastrear o lateral adversário',
      'Interromper linhas de passe',
    ],
    transitionAttack: [
      'Sprint para o corredor direito',
      'Criar largura',
    ],
    transitionDefense: [
      'Recuar à linha do meio-campo',
      'Não deixar o RB exposto',
    ],
    offensivePrinciples: { width: true, depth: true, demarking: 'run', support: true },
    defensivePrinciples: { pressing: 'total', marking: 'man', basculation: true, retreat: 'individual', compactness: 'medium', delay: false },
    allowedZoneDepths: [2, 3, 4],
    maxZoneDepth: 4,
  },

  CM_L: {
    positionName: 'Meia Central Esquerdo',
    inPossession: [
      'Ditar o ritmo: receber dos zagueiros e distribuir',
      'Apoio constante ao portador — desmarque de apoio (não ultrapassa)',
      'Passe entre linhas para o atacante quando a linha defensiva está adiantada',
      'Circulação: mover a bola de um lado para o outro para abrir espaços',
      'Chegada de segunda linha à área adversária',
    ],
    outOfPossession: [
      'Blindar a linha defensiva — bloquear passes centrais',
      'Pressão imediata após perda de posse',
      'Cobertura ao lateral ou volante quando pressionado',
      'Redução de linhas de passe no corredor central',
    ],
    transitionAttack: [
      'Empurrar para o half-space esquerdo',
      'Apoiar o atacante — chegada atrasada à área',
    ],
    transitionDefense: [
      'Recuar imediatamente à linha do meio-campo',
      'Não perseguir a bola no terço ofensivo',
    ],
    offensivePrinciples: { support: true, circulation: true, demarking: 'support', wallPass: true, numericalSuperiority: true },
    defensivePrinciples: { pressing: 'partial', marking: 'zone', coverage: true, basculation: true, retreat: 'collective', compactness: 'high', delay: true },
    allowedZoneDepths: [2, 3, 4],
    maxZoneDepth: 4,
  },

  CM_R: {
    positionName: 'Meia Central Direito (Box-to-Box)',
    inPossession: [
      'Corridas box-to-box: apoiar o atacante pelo half-space direito',
      'Jogo entre linhas: receber entre a defesa e o meio-campo adversário',
      'Desmarque de ruptura: ultrapassar o portador para receber em profundidade',
      'Tabela com o atacante para superar a defesa',
    ],
    outOfPossession: [
      'Pressionar junto com CM_L',
      'Cobrir o lado direito do meio-campo',
      'Rastrear o meia adversário',
      'Pressão imediata após perda',
    ],
    transitionAttack: [
      'Correr além do atacante pelo half-space direito',
      'Chegar atrasado à área',
    ],
    transitionDefense: [
      'Recuar à linha do meio-campo',
      'Espelhar o CM_L',
    ],
    offensivePrinciples: { depth: true, demarking: 'run', wallPass: true, overlap: true, numericalSuperiority: true },
    defensivePrinciples: { pressing: 'total', marking: 'man', basculation: true, retreat: 'collective', compactness: 'medium', delay: false },
    allowedZoneDepths: [2, 3, 4],
    maxZoneDepth: 4,
  },

  ST_L: {
    positionName: 'Atacante Esquerdo',
    inPossession: [
      'Finalizar quando dentro da zona de finalização',
      'Hold-up: segurar a bola de costas para o gol e esperar apoio',
      'Desmarque de ruptura: correr nas costas da defesa',
      'Tabela com o meia para superar a linha defensiva',
      'Atacar a zona 14 (corredor central à frente da área)',
    ],
    outOfPossession: [
      'Pressão alta inicial sobre o portador adversário',
      'Interrupção de linhas de passe do goleiro/zagueiro',
      'Recuar até a zona média quando necessário — não perseguir além',
    ],
    transitionAttack: [
      'Atacar imediatamente o espaço nas costas da defesa',
      'Exigir o passe em profundidade',
    ],
    transitionDefense: [
      'Pressão imediata sobre o portador',
      'Forçar o adversário para o corredor — não deixar jogar pelo centro',
    ],
    offensivePrinciples: { depth: true, demarking: 'run', wallPass: true, numericalSuperiority: true, progression: true },
    defensivePrinciples: { pressing: 'total', marking: 'zone', retreat: 'individual', compactness: 'low', delay: false },
    allowedZoneDepths: [3, 4],
    maxZoneDepth: 4,
  },

  ST_R: {
    positionName: 'Atacante Direito',
    inPossession: [
      'Finalizar quando dentro da zona de finalização',
      'Hold-up: segurar a bola e esperar apoio',
      'Desmarque de ruptura nas costas da defesa',
      'Tabela com o meia',
    ],
    outOfPossession: [
      'Pressão alta sobre o portador adversário',
      'Interrupção de linhas de passe',
    ],
    transitionAttack: [
      'Atacar o espaço nas costas da defesa',
      'Exigir o passe em profundidade',
    ],
    transitionDefense: [
      'Pressão imediata sobre o portador',
      'Forçar para o corredor',
    ],
    offensivePrinciples: { depth: true, demarking: 'run', wallPass: true, numericalSuperiority: true, progression: true },
    defensivePrinciples: { pressing: 'total', marking: 'zone', retreat: 'individual', compactness: 'low', delay: false },
    allowedZoneDepths: [3, 4],
    maxZoneDepth: 4,
  },
};

// ── Zonas de profundidade (do ebook) ─────────────────────────────────────────
// Zona 1: defensiva (0–25% do campo)
// Zona 2: construção/progressão (25–50%)
// Zona 3: criação (50–75%)
// Zona 4: finalização (75–100%)

export function getZoneDepth(x: number, teamSide: 'home' | 'away'): number {
  // home ataca para x=100, away ataca para x=0
  const attackX = teamSide === 'home' ? x : 100 - x;
  if (attackX < 25) return 1;
  if (attackX < 50) return 2;
  if (attackX < 75) return 3;
  return 4;
}

// ── Decisão tática baseada nos princípios do ebook ───────────────────────────

export interface TacticaDecision {
  // Intenção derivada dos princípios
  shouldPass: boolean;       // apoio/circulação — dar continuidade
  shouldDribble: boolean;    // superioridade qualitativa — 1x1
  shouldShoot: boolean;      // zona de finalização + progressão
  shouldSupport: boolean;    // desmarque de apoio — oferecer opção
  shouldRun: boolean;        // desmarque de ruptura — ultrapassar portador
  shouldHold: boolean;       // temporização — aguardar reorganização
  shouldPress: boolean;      // pressão — ir ao encontro do portador
  shouldRetreat: boolean;    // recuo — retornar à posição
  // Contexto
  moment: GameMoment;
  zoneDepth: number;
}

export function decideTactica(
  position: string,
  hasBall: boolean,
  teamHasBall: boolean,
  distToGoal: number,
  distToBall: number,
  zoneDepth: number,
  nearestOpponentDist: number,
  teamSide: 'home' | 'away',
  possession: 'home' | 'away' | null,
): TacticaDecision {
  const behavior = POSITION_BEHAVIORS[position];
  const offPrinciples = behavior?.offensivePrinciples ?? {};
  const defPrinciples = behavior?.defensivePrinciples ?? {};

  // Determinar o momento do jogo
  const moment: GameMoment = teamHasBall
    ? 'FASE_OFENSIVA'
    : 'FASE_DEFENSIVA';

  // ── Fase ofensiva ─────────────────────────────────────────────────────────
  if (hasBall) {
    const inFinalizationZone = zoneDepth === 4 && distToGoal < 25;
    const underPressure = nearestOpponentDist < 8;

    return {
      shouldShoot:   inFinalizationZone,
      shouldPass:    underPressure || (offPrinciples.circulation ?? false) || (offPrinciples.support ?? false),
      shouldDribble: !underPressure && nearestOpponentDist < 15 && zoneDepth >= 3,
      shouldSupport: false,
      shouldRun:     !inFinalizationZone && !underPressure && (offPrinciples.depth ?? false),
      shouldHold:    !inFinalizationZone && !underPressure && zoneDepth <= 2,
      shouldPress:   false,
      shouldRetreat: false,
      moment,
      zoneDepth,
    };
  }

  if (teamHasBall) {
    // Sem bola mas time tem posse — desmarque
    const wantsRun = offPrinciples.demarking === 'run' && zoneDepth >= 3;
    const wantsSupport = offPrinciples.support ?? true;
    return {
      shouldShoot:   false,
      shouldPass:    false,
      shouldDribble: false,
      shouldSupport: wantsSupport && !wantsRun,
      shouldRun:     wantsRun,
      shouldHold:    !wantsSupport && !wantsRun,
      shouldPress:   false,
      shouldRetreat: false,
      moment,
      zoneDepth,
    };
  }

  // ── Fase defensiva ────────────────────────────────────────────────────────
  const maxDepth = behavior?.maxZoneDepth ?? 4;
  const isOutOfZone = zoneDepth > maxDepth;
  const shouldPressNow = defPrinciples.pressing === 'total' ||
    (defPrinciples.pressing === 'partial' && distToBall < 15);

  return {
    shouldShoot:   false,
    shouldPass:    false,
    shouldDribble: false,
    shouldSupport: false,
    shouldRun:     false,
    shouldHold:    !shouldPressNow && !isOutOfZone,
    shouldPress:   shouldPressNow && distToBall < 20,
    shouldRetreat: isOutOfZone || (!shouldPressNow && defPrinciples.retreat === 'collective'),
    moment: 'FASE_DEFENSIVA',
    zoneDepth,
  };
}
