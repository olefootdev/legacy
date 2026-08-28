/**
 * Self-test: PERSONALIDADE MÍNIMA (Fase 4).
 *
 * Prova a corrente inteira, do traço à bola:
 *
 *   traços derivados → pedido do jogador → escolha do manager
 *     → managerRelationByPlayer (obediência em campo)
 *     → playerMoral → moralTilt → atributos enviados ao motor
 *
 * O elo final é o que importa: sem a ponte `moralTilt`, a moral seria mais um
 * SSOT que só a UI lê — e a decisão do vestiário não mudaria nada em campo.
 *
 * Uso: npm run test:player-personality
 */
import {
  derivePersonality,
  detectPlayerRequest,
  resolveRequest,
  minutesShare,
  CHOICE_LABEL,
  type PlayerRequestChoice,
} from '../src/systems/playerPersonality';
import { moralTilt } from '../src/match/quickPlanClient';

let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label} ${detail}`);
  if (!ok) fail++;
};

const NOW = 1_700_000_000_000;

console.log('\n🧠 TRAÇOS\n');

// ── 1) Derivação determinística e dentro dos limites ──────────────────────
{
  const base = {
    playerId: 'p1', age: 24, overall: 75, mintOverall: 70,
    squadAverageOverall: 70, matchesPlayed: 5, clubMatchesPlayed: 10,
  };
  const a = derivePersonality(base);
  const b = derivePersonality(base);
  check('determinístico', JSON.stringify(a) === JSON.stringify(b));
  check('todos os traços em 0–100',
    [a.ambicao, a.lealdade, a.ego].every((v) => v >= 0 && v <= 100 && Number.isInteger(v)),
    JSON.stringify(a));

  // Extremos não estouram
  const extremo = derivePersonality({
    playerId: 'x', age: 16, overall: 99, mintOverall: 40,
    squadAverageOverall: 30, matchesPlayed: 0, clubMatchesPlayed: 50,
  });
  check('extremo não estoura', [extremo.ambicao, extremo.lealdade, extremo.ego].every((v) => v >= 0 && v <= 100));
  check('sem idade não quebra',
    Number.isFinite(derivePersonality({ ...base, age: undefined }).ambicao));
}

// ── 2) Os traços dizem o que prometem ─────────────────────────────────────
{
  const jovem = derivePersonality({ playerId: 'j', age: 19, overall: 70, mintOverall: 62, squadAverageOverall: 70, matchesPlayed: 3, clubMatchesPlayed: 10 });
  const veterano = derivePersonality({ playerId: 'v', age: 33, overall: 70, mintOverall: 70, squadAverageOverall: 70, matchesPlayed: 3, clubMatchesPlayed: 10 });
  check('jovem é mais ambicioso que veterano', jovem.ambicao > veterano.ambicao,
    `${jovem.ambicao} vs ${veterano.ambicao}`);

  const titular = derivePersonality({ playerId: 't', age: 28, overall: 70, mintOverall: 70, squadAverageOverall: 70, matchesPlayed: 10, clubMatchesPlayed: 10 });
  const reserva = derivePersonality({ playerId: 'r', age: 28, overall: 70, mintOverall: 70, squadAverageOverall: 70, matchesPlayed: 0, clubMatchesPlayed: 10 });
  check('quem joga é mais leal que quem não joga', titular.lealdade > reserva.lealdade,
    `${titular.lealdade} vs ${reserva.lealdade}`);

  const craque = derivePersonality({ playerId: 'c', age: 28, overall: 88, mintOverall: 80, squadAverageOverall: 65, matchesPlayed: 8, clubMatchesPlayed: 10 });
  const comum = derivePersonality({ playerId: 'k', age: 28, overall: 62, mintOverall: 60, squadAverageOverall: 65, matchesPlayed: 8, clubMatchesPlayed: 10 });
  check('craque tem mais ego que jogador comum', craque.ego > comum.ego, `${craque.ego} vs ${comum.ego}`);

  check('minutesShare protege divisão por zero', minutesShare(5, 0) === 0);
  check('minutesShare satura em 1', minutesShare(20, 10) === 1);
}

console.log('\n💬 O PEDIDO\n');

// ── 3) Quem fala, e sobre o quê ───────────────────────────────────────────
{
  const call = (over: Partial<Parameters<typeof detectPlayerRequest>[0]>) =>
    detectPlayerRequest({
      playerId: 'p1', playerName: 'Lucas',
      personality: { ambicao: 50, lealdade: 50, ego: 50 },
      matchesPlayed: 5, clubMatchesPlayed: 10, relation: 75, now: NOW,
      ...over,
    });

  check('jogador satisfeito não fala', call({}) === null);

  const banco = call({ matchesPlayed: 1, personality: { ambicao: 70, lealdade: 50, ego: 70 } });
  check('reserva com ego cobra MINUTOS', banco?.kind === 'minutes', String(banco?.kind));

  const ambicioso = call({ personality: { ambicao: 85, lealdade: 30, ego: 40 } });
  check('ambicioso sem vínculo quer PALCO MAIOR', ambicioso?.kind === 'ambition', String(ambicioso?.kind));

  const craque = call({ matchesPlayed: 9, personality: { ambicao: 40, lealdade: 70, ego: 90 } });
  check('craque que joga cobra RESPEITO', craque?.kind === 'respect', String(craque?.kind));

  check('temporada curta cala todo mundo',
    call({ clubMatchesPlayed: 1, matchesPlayed: 0, personality: { ambicao: 95, lealdade: 10, ego: 95 } }) === null);
  check('relação forte compra paciência',
    call({ relation: 90, matchesPlayed: 0, personality: { ambicao: 95, lealdade: 10, ego: 95 } }) === null);
  check('id do pedido é estável (não duplica na fila)',
    call({ matchesPlayed: 1, personality: { ambicao: 70, lealdade: 50, ego: 70 } })?.id ===
    call({ matchesPlayed: 1, personality: { ambicao: 70, lealdade: 50, ego: 70 }, now: NOW + 999_999 })?.id);
  check('todo pedido tem fala em pt-BR', (banco?.quote.length ?? 0) > 10 && !!banco?.quote.match(/[áâãéêíóôõúç]/i));
}

console.log('\n⚖️ A ESCOLHA\n');

// ── 4) Nenhuma resposta é grátis, nenhuma é "a certa" ─────────────────────
{
  const grant = resolveRequest('minutes', 'grant');
  const challenge = resolveRequest('minutes', 'challenge');
  const promise = resolveRequest('minutes', 'promise');

  check('dar chance é o que mais aproxima', grant.relationDelta > promise.relationDelta && grant.relationDelta > challenge.relationDelta);
  check('mandar conquistar custa relação', challenge.relationDelta < 0);
  check('prometer agrada pouco', promise.relationDelta > 0 && promise.relationDelta < grant.relationDelta);
  check('moral acompanha a relação em direção',
    Math.sign(grant.moralDelta) === Math.sign(grant.relationDelta) &&
    Math.sign(challenge.moralDelta) === Math.sign(challenge.relationDelta));
  check('toda escolha tem resposta do manager em pt-BR',
    (['grant', 'challenge', 'promise'] as PlayerRequestChoice[])
      .every((c) => resolveRequest('minutes', c).reply.length > 10));
  check('toda escolha tem rótulo de botão',
    (['grant', 'challenge', 'promise'] as PlayerRequestChoice[]).every((c) => CHOICE_LABEL[c].length > 3));
}

console.log('\n🔗 A PONTE ATÉ O MOTOR\n');

// ── 5) moral → atributos enviados ao Python ───────────────────────────────
{
  check('moral neutra não mexe em nada', moralTilt(50).conf === 0 && moralTilt(50).men === 0);
  check('moral alta empurra confiança pra cima', moralTilt(100).conf > 0);
  check('moral baixa derruba confiança', moralTilt(0).conf < 0);
  check('tilt é pequeno (tempera, não decide)',
    Math.abs(moralTilt(100).conf) <= 5 && Math.abs(moralTilt(0).conf) <= 5);
  check('mentalidade se move menos que confiança',
    Math.abs(moralTilt(100).men) < Math.abs(moralTilt(100).conf));
  check('ausência de moral é neutra', moralTilt(undefined).conf === 0);
  check('valor inválido é neutro', moralTilt(NaN).conf === 0);
  check('moral fora da escala é capada',
    moralTilt(999).conf === moralTilt(100).conf && moralTilt(-999).conf === moralTilt(0).conf);

  // A corrente completa: dar chance sobe a moral, e a moral sobe a confiança.
  const antes = 50;
  const depois = antes + resolveRequest('minutes', 'grant').moralDelta;
  check('dar chance → moral maior → confiança maior no motor',
    moralTilt(depois).conf > moralTilt(antes).conf,
    `${moralTilt(antes).conf} → ${moralTilt(depois).conf}`);
}

console.log(fail === 0 ? '\n✅ TUDO VERDE\n' : `\n❌ ${fail} FALHA(S)\n`);
process.exit(fail === 0 ? 0 : 1);
