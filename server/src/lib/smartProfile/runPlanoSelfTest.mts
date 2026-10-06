/**
 * Conferência do plano (Fase 3).   npm run test:plano
 *
 * A prova que importa: PARTIDA HONESTA SAI IDÊNTICA. Os casos honestos abaixo
 * são montados com as MESMAS funções que o jogo usa para enviar o payload
 * (`playerToQuickPlanPayload`, `applyLegacyBoostToLineup`), não com números
 * escolhidos à mão — se o envelope aqui ficar apertado demais, este teste
 * quebra antes de cortar a jogada de alguém.
 */
import { conferirEscalacao, conferenciaVazia, impressaoDaEscalacao, type FichaDoMotor } from './plano.js';
import { validarRelato, resumirPlano, type ResumoDoPlano } from './custodia.js';
import { atributosCompletos } from './derivar.js';
import { playerToQuickPlanPayload, applyLegacyBoostToLineup, moralTilt } from '../../../../src/match/quickPlanClient.js';
import type { PlayerEntity } from '../../../../src/entities/types.js';

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
};

const ATTRS = {
  passe: 71, marcacao: 58, velocidade: 77, drible: 74, finalizacao: 82,
  fisico: 69, tatico: 62, mentalidade: 66, confianca: 73, fairPlay: 70,
};
const ficha: FichaDoMotor = { atributos: atributosCompletos(ATTRS, 'ATA') };
const fichas = new Map<string, FichaDoMotor>([['genesis-9', ficha]]);

/** Jogador do jogo, do jeito que o elenco guarda. */
const entidade = (behavior: PlayerEntity['behavior']): PlayerEntity => ({
  id: 'genesis-9', name: 'Craque da Vila', pos: 'ATA', num: 9, attrs: { ...ATTRS }, behavior,
} as unknown as PlayerEntity);

console.log('\n🟩 partida honesta sai idêntica\n');
{
  for (const behavior of ['equilibrado', 'ofensivo', 'defensivo', 'criativo'] as const) {
    for (const moral of [0, 25, 50, 75, 100]) {
      const enviado = playerToQuickPlanPayload(entidade(behavior), 12, 'attack', moral);
      const r = conferirEscalacao([enviado], fichas);
      check(
        `behavior ${behavior} + moral ${moral} passa intacto`,
        r.conferencia.corrigidos === 0 && JSON.stringify(r.escalacao[0]) === JSON.stringify(enviado),
        r.conferencia.motivos.join(' | '),
      );
    }
  }
}
{
  // Lenda em campo: boost passivo somado por cima dos tilts, no teto do CAP.
  const base = playerToQuickPlanPayload(entidade('ofensivo'), 5, 'attack', 100);
  const comLenda = applyLegacyBoostToLineup([base], [
    { label: 'ATAQUE', pct: 6 }, { label: 'DEFESA', pct: 9 }, { label: 'MORAL', pct: 12 },
    { label: 'PASSE', pct: 5.5 }, { label: 'VELOCIDADE', pct: 20 },
  ]);
  const r = conferirEscalacao(comLenda, fichas);
  check('lenda no teto do CAP (+8 por categoria) passa intacto', r.conferencia.corrigidos === 0, r.conferencia.motivos.join(' | '));
}
{
  // Adversário sintético e elenco de outro manager: sem ficha, passa intacto.
  const adversario = [{ id: 'away-3', finalizacao: 99, passe: 99, marcacao: 99 }];
  const r = conferirEscalacao(adversario, fichas);
  check('jogador sem ficha passa intacto', r.conferencia.corrigidos === 0 && r.conferencia.sem_ficha === 1
    && r.escalacao[0]!.finalizacao === 99);
}

console.log('\n🟥 número fora da ficha é cortado\n');
{
  const enviado = { ...playerToQuickPlanPayload(entidade('equilibrado'), 0, 'attack', 50), finalizacao: 99 };
  const r = conferirEscalacao([enviado], fichas);
  check('finalização 99 numa ficha de 82 → cortada', r.conferencia.corrigidos === 1);
  check('corta no TETO legal, não zera o jogador', (r.escalacao[0] as { finalizacao: number }).finalizacao === 82 + 11 + 1);
  check('o motivo diz o enviado, o teto e a ficha',
    /genesis-9\.finalizacao: 99 fora de \[\d+, 94\] \(ficha 82\) → 94/.test(r.conferencia.motivos[0] ?? ''),
    r.conferencia.motivos[0] ?? '(sem motivo)');
}
{
  const r = conferirEscalacao([{ id: 'genesis-9', marcacao: 1 }], fichas);
  check('marcação 1 numa ficha de 58 → sobe ao piso legal (não é cheat, mas não é a ficha)',
    (r.escalacao[0] as { marcacao: number }).marcacao === 58 - 2 - 1);
}
{
  const r = conferirEscalacao([{ id: 'genesis-9', fair_play: 99 }], fichas);
  check('fair_play não tem tilt: vale exatamente a ficha', (r.escalacao[0] as { fair_play: number }).fair_play === 70);
  check('fair_play inflado conta como CORTE', r.conferencia.corrigidos === 1);
}
{
  const r = conferirEscalacao([{ id: 'genesis-9' }], fichas);
  const l = r.escalacao[0] as Record<string, number>;
  check('campo ausente (motor leria NaN) vira o valor da ficha',
    l.finalizacao === 82 && l.passe === 71 && l.confianca === 73 && l.mentalidade === 66);
  check('preencher ausente NÃO é adulteração: conta em preenchidos, não em corrigidos',
    r.conferencia.corrigidos === 0 && r.conferencia.preenchidos === 1);
}
{
  const r = conferirEscalacao([{ id: 'genesis-9', velocidade: 'muito rápido' as unknown as number }], fichas);
  check('atributo não-numérico vira o valor da ficha', (r.escalacao[0] as { velocidade: number }).velocidade === 77);
  check('não-numérico não acusa adulteração', r.conferencia.corrigidos === 0 && r.conferencia.preenchidos === 1);
}
{
  // Um titular corrigido não contamina o resto da escalação.
  const limpo = playerToQuickPlanPayload(entidade('criativo'), 30, 'mid', 40);
  const sujo = { ...limpo, id: 'genesis-9', drible: 97 };
  const r = conferirEscalacao([{ ...limpo, id: 'sem-ficha' }, sujo], fichas);
  check('só o titular fora da ficha é mexido', r.conferencia.corrigidos === 1 && r.conferencia.sem_ficha === 1);
}
{
  const muitos = Array.from({ length: 30 }, (_, i) => ({ id: 'genesis-9', finalizacao: 99, passe: 99, marcacao: 99, _i: i }));
  const r = conferirEscalacao(muitos, fichas);
  check('lista de motivos tem teto (não vira jsonb gigante)', r.conferencia.motivos.length === 20 && r.conferencia.corrigidos === 30);
}

console.log('\n🔑 impressão dos números na chave do cache\n');
{
  const a = playerToQuickPlanPayload(entidade('ofensivo'), 10, 'attack', 50);
  const b = playerToQuickPlanPayload(entidade('defensivo'), 10, 'attack', 50);
  check('mesma escalação, números iguais → mesma impressão', impressaoDaEscalacao([[a]]) === impressaoDaEscalacao([[a]]));
  check('behavior diferente → impressão diferente', impressaoDaEscalacao([[a]]) !== impressaoDaEscalacao([[b]]));
  const comLenda = applyLegacyBoostToLineup([a], [{ label: 'ATAQUE', pct: 8 }]);
  check('lenda ativada → impressão diferente (o cache não serve o plano de antes)',
    impressaoDaEscalacao([[a]]) !== impressaoDaEscalacao([comLenda]));
  check('fadiga diferente → impressão diferente',
    impressaoDaEscalacao([[a]]) !== impressaoDaEscalacao([[{ ...a, fatigue: 80 }]]));
  check('ordem dos lados importa', impressaoDaEscalacao([[a], [b]]) !== impressaoDaEscalacao([[b], [a]]));
}

console.log('\n🔗 plano corrigido suja a custódia do relato\n');
{
  const plano = resumirPlano({ mode: 'full', start_minute: 0, events: [
    { kind: 'goal_home', minute: 20, actor_id: 'genesis-9' }, { kind: 'shot_home', minute: 50, actor_id: 'genesis-9' },
  ] }, ['genesis-9']);
  const jogador = { id: 'genesis-9', pos: 'ATA', attrsAntes: ATTRS, gols: 1, chutes: 2, nota: 0 };
  // Nota honesta: a fórmula é conferida pelo test:custodia; aqui só o efeito da conferência.
  const semConferencia: ResumoDoPlano = { ...plano, conferencia: { conferidos: 11, sem_ficha: 0, corrigidos: 0, preenchidos: 0, motivos: [] } };
  const comCorte: ResumoDoPlano = { ...plano, conferencia: { conferidos: 11, sem_ficha: 0, corrigidos: 2, preenchidos: 0, motivos: ['x'] } };
  const v1 = validarRelato({ placar: [1, 0], jogadores: [jogador] }, [semConferencia]);
  const v2 = validarRelato({ placar: [1, 0], jogadores: [jogador] }, [comCorte]);
  check('plano sem corte não ganha motivo novo', !v1.motivos.some((m) => m.includes('fora da ficha')));
  check('plano com corte → suspeita, com o motivo nomeado',
    v2.custodia === 'suspeita' && v2.motivos.some((m) => m.includes('2 titular(es) fora da ficha')));
  const antigo: ResumoDoPlano = plano; // emitido antes da Fase 3: sem o campo
  const v3 = validarRelato({ placar: [1, 0], jogadores: [jogador] }, [antigo]);
  check('plano antigo (sem conferência) não é acusado', !v3.motivos.some((m) => m.includes('fora da ficha')));
}

console.log('\n🧮 envelope cobre a escala declarada dos tilts\n');
{
  check('moralTilt extremo cabe no envelope da confiança', moralTilt(100).conf === 5 && moralTilt(0).conf === -5);
  check('moralTilt extremo cabe no envelope da mentalidade', moralTilt(100).men === 2 && moralTilt(0).men === -2);
  // Ficha no teto: o clamp 1..99 do jogo não pode ser lido como adulteração.
  const attrsTeto = { ...ATTRS, finalizacao: 99 };
  const noTeto = new Map<string, FichaDoMotor>([['genesis-9', { atributos: atributosCompletos(attrsTeto, 'ATA') }]]);
  const envioTeto = playerToQuickPlanPayload({ ...entidade('ofensivo'), attrs: attrsTeto } as PlayerEntity, 0, 'attack', 100);
  const r = conferirEscalacao([envioTeto], noTeto);
  check('ficha em 99: o clamp do jogo não é lido como adulteração', r.conferencia.corrigidos === 0, r.conferencia.motivos.join(' | '));
  const attrsBase = { ...ATTRS, fisico: 1 };
  const naBase = new Map<string, FichaDoMotor>([['genesis-9', { atributos: atributosCompletos(attrsBase, 'ATA') }]]);
  const envioBase = playerToQuickPlanPayload({ ...entidade('defensivo'), attrs: attrsBase } as PlayerEntity, 0, 'def', 0);
  const r2 = conferirEscalacao([envioBase], naBase);
  check('ficha em 1: o piso do jogo não é lido como adulteração', r2.conferencia.corrigidos === 0, r2.conferencia.motivos.join(' | '));
}
{
  const vazia = conferenciaVazia();
  check('conferência vazia é neutra',
    vazia.conferidos === 0 && vazia.corrigidos === 0 && vazia.preenchidos === 0 && vazia.motivos.length === 0);
}

console.log(`\n${falhou === 0 ? '🟢' : '🔴'} ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
