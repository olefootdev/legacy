/**
 * PARTIDA VIVA — teste de ESTRESSE do campo com partidas reais do motor.
 *
 * Bug do fundador (10/10): "no 16' o jogo travou no loop de uma jogada — o
 * Adriano tocando pro Savinho". Este teste toca partidas inteiras do motor no
 * coreógrafo, no ritmo do LEGACY (posse do fluxo minuto a minuto, lances com o
 * tempo de encenação, gols), e caça laços:
 *   - PINGUE-PONGUE: a bola indo e voltando entre os MESMOS dois jogadores;
 *   - bola parada que nunca solta; reinício (lateral/tiro de meta) que nunca acaba;
 *   - bola parada no pé de alguém por muito tempo; fila de encenação que não esvazia.
 *
 *   npx tsx scripts/estresse-partida-viva.ts <planos.json>
 *   (planos.json: [{ plan, home:[{id,pos}], away:[{id,pos}] }] — gerado pelo motor)
 */
import { readFileSync } from 'node:fs';
import { Coreografo, DT } from '../src/partidaViva/coreografo';
import { montarFichas } from '../src/partidaViva/escalacao';
import { cronogramaDaCadeia, msParaMostrar } from '../src/partidaViva/cronograma';
import { entregarQuadro } from '../src/partidaViva/gravacao';
import type { QuadroAoVivo } from '../src/partidaViva/tipos';
import type { MatchPlan } from '../src/match/quickPlanTypes';

type Entrada = { plan: MatchPlan; home: { id: string; pos: string }[]; away: { id: string; pos: string }[] };
const arquivo = process.argv[2];
if (!arquivo) { console.error('uso: estresse-partida-viva.ts <planos.json>'); process.exit(2); }
const partidas = JSON.parse(readFileSync(arquivo, 'utf8')) as Entrada[];

const PASSOS_POR_MINUTO = Math.round(1.1 / DT);
let problemas = 0;

for (const [n, e] of partidas.entries()) {
  if (process.env.SO && Number(process.env.SO) !== n) continue;
  // Perfis de verdade (o time do fundador tem armadores, dribladores, velocistas):
  // sem eles o laço não aparece.
  const CLASSES = ['regista', 'maestro', 'ponta_driblador', 'velocista', 'box_to_box', 'matador', undefined];
  const perfil = (i: number) => ({ classe: CLASSES[(i + n) % CLASSES.length], passe: 70 + ((i * 7 + n) % 25), drible: 65 + ((i * 11 + n) % 30) });
  const fichas = [
    ...montarFichas('home', e.home.map((p, i) => ({ id: p.id, nome: `Casa${i}`, pos: p.pos, fadiga: (i * 13) % 90, classe: perfil(i).classe }))),
    ...montarFichas('away', e.away.map((p, i) => ({ id: p.id, nome: `Fora${i}`, pos: p.pos, fadiga: (i * 17) % 90, classe: perfil(i + 3).classe }))),
  ].map((f, i) => ({ ...f, passe: perfil(i).passe, drible: perfil(i).drible }));
  const co = new Coreografo(fichas, '4-3-3', '4-3-3', e.plan.seed, true);
  const achados: string[] = [];
  let minuto = 0;
  // Detectores
  const donos: string[] = [];
  let naoNumero = false, vooDesde = -1;
  const cobrancas: { em: number; de: string; minuto: number }[] = [];
  const presos = new Map<unknown, { k: string; desde: number; avisado?: boolean }>();
  let posicionadosDesde = -1, filaDesde = -1, paradaDesde = -1, ultimaBola = { x: 0, z: 0 };
  const passo = () => {
    const antes = co.dono?.f.id ?? null;
    co.passo();
    const agora = co.dono?.f.id ?? null;
    if (agora && agora !== antes && agora !== donos[donos.length - 1]) {
      donos.push(agora);
      if (donos.length > 14) donos.shift();
      const ult = donos.slice(-14);
      if (process.env.PP && ult.length >= Number(process.env.PP) && new Set(ult.slice(-Number(process.env.PP))).size === 2) { achados.push(`${minuto}': PINGUE-PONGUE entre ${[...new Set(ult)].join(' e ')}`); donos.length = 0; }
    }
    if (co.posicionados.size) { if (posicionadosDesde < 0) posicionadosDesde = co.t; else if (co.t - posicionadosDesde > 15) { achados.push(`${minuto}': bola parada presa (${co.posicionados.size} posicionados há 15 s)`); posicionadosDesde = co.t + 1e9; } }
    else posicionadosDesde = -1;
    if (co.fila.length) { if (filaDesde < 0) filaDesde = co.t; else if (co.t - filaDesde > 25) { achados.push(`${minuto}': encenação que não acaba (fila há 25 s: ${co.fila.length} itens, próximos em ${co.fila.slice(0, 4).map((f) => (f.em - co.t).toFixed(1)).join(', ')} s; festa=${!!co.festa}, posse=${co.posse}, reinício=${(co.reinicioAte - co.t).toFixed(1)})`); filaDesde = co.t + 1e9; } }
    else filaDesde = -1;
    const b = co.quadro(1).bola;
    if (minuto > 0 && Math.hypot(b.x - ultimaBola.x, b.z - ultimaBola.z) < 0.05 && !co.festa && co.posicionados.size === 0) {
      if (paradaDesde < 0) paradaDesde = co.t; else if (co.t - paradaDesde > 10) { achados.push(`${minuto}': bola parada no lugar há 10 s (dono=${co.dono?.f.nome ?? '-'}, voo=${!!co.voo}, fila=${co.fila.length}, prox=${(co.proxToque - co.t).toFixed(1)}, reinício=${(co.reinicioAte - co.t).toFixed(1)}, posse=${co.posse})`); paradaDesde = co.t + 1e9; }
    } else paradaDesde = -1;
    ultimaBola = { x: b.x, z: b.z };
    // Escanteio: na hora da cobrança (no tempo do CAMPO) o cobrador tem que estar na bola.
    while (cobrancas.length && co.t >= cobrancas[0]!.em) {
      const k = cobrancas.shift()!;
      // O cobrador pode ter sido o titular trocado no 12' (o corpo continua; a ficha é a do reserva).
      const c = co.corpos.find((x) => x.f.id === (emCampo && k.de === sai ? entra : k.de));
      const d = c ? Math.hypot(c.x - co.bola.x, c.z - co.bola.z) : Infinity;
      const cantoOk = Math.abs(co.bola.z - 34) > 30 && (co.bola.x < 3 || co.bola.x > 102);
      if (d > 2.5 || !cantoOk) achados.push(`${k.minuto}': escanteio SEM cobrador (cobrador a ${d.toFixed(1)} m; bola em ${co.bola.x.toFixed(0)},${co.bola.z.toFixed(0)})`);
    }
    // NaN congela o campo pra sempre (a bola some, o passe nunca chega).
    if (!naoNumero && (!Number.isFinite(co.bola.x + co.bola.z) || co.corpos.some((c) => !Number.isFinite(c.x + c.z)) || !Number.isFinite(co.escalaDoTempo()))) { naoNumero = true; achados.push(`${minuto}': NaN no campo (bola ${co.bola.x}, ${co.bola.z}; escala ${co.escalaDoTempo()})`); }
    // Jogador PRESO num alvo velho (limpeza perdida): parado no mesmo ponto com alvo há 20 s.
    for (const c of co.corpos) {
      const k = c.alvo ? `${c.alvo.x.toFixed(1)},${c.alvo.z.toFixed(1)}` : '';
      const a = presos.get(c);
      if (!k || co.posicionados.has(c) || co.festa) { presos.delete(c); continue; }
      if (!a || a.k !== k) presos.set(c, { k, desde: co.t });
      else if (co.t - a.desde > 20 && !a.avisado) { a.avisado = true; achados.push(`${minuto}': ${c.f.nome} PRESO no alvo ${k} há 20 s`); }
    }
    // Passe que nunca chega.
    if (co.voo) { if (vooDesde < 0) vooDesde = co.t; else if (co.t - vooDesde > 6) { achados.push(`${minuto}': bola no ar há 6 s`); vooDesde = co.t + 1e9; } } else vooDesde = -1;
  };
  // Tempo de RELÓGIO (como o palco): a câmera lenta do chute faz o campo andar menos
  // que o relógio da Rápida — o próximo minuto chega com a jogada ainda em campo.
  let acumulado = 0;
  const esperar = (passosDeRelogio: number, aoPasso?: (i: number) => void) => {
    let n = 0;
    for (let i = 0; i < passosDeRelogio; i++) {
      acumulado += DT * co.escalaDoTempo();
      while (acumulado >= DT) { aoPasso?.(n++); passo(); acumulado -= DT; }
    }
  };
  const quadro = (extra: Partial<QuadroAoVivo>): QuadroAoVivo => {
    const f = (e.plan.fluxo ?? []).find((x) => x[0] === minuto);
    return {
      minuto, fase: 'playing', placarCasa: 0, placarFora: 0, momento: e.plan.momentum_curve[Math.max(0, minuto - 1)] ?? 50,
      lance: null, gol: null, narracao: [],
      posse: f ? { lado: f[1] === 'h' ? 'home' : 'away', zona: f[2], roubou: f[3] === 1, ator: f[4] } : null,
      emCampo,
      ...extra,
    };
  };
  // Pré-apito
  for (let i = 0; i < 300 && !co.consumirApito(); i++) passo();
  // Substituição no 12' (reserva SEM número de fôlego — o caso que virava NaN) e
  // daí em diante os lances passam por quem entrou (é o que o replan faz).
  const casaIds = e.home.map((p) => p.id);
  const sai = casaIds[6]!, entra = `reserva-${n}`;
  const banco = [{ id: entra, nome: 'Reserva', iniciais: 'RE', lado: 'home' as const, slot: '', rosto: null, fadiga: undefined as unknown as number, velocidade: Number.NaN }];
  let emCampo: string[] | undefined;
  const trocado = (ev: (typeof e.plan.events)[number]) => (emCampo ? JSON.parse(JSON.stringify(ev).split(`"${sai}"`).join(`"${entra}"`)) as typeof ev : ev);
  for (minuto = 1; minuto <= 90; minuto++) {
    if (minuto === 12) {
      emCampo = casaIds.map((id) => (id === sai ? entra : id));
      const feitas = entregarQuadro(co, quadro({ emCampo }), banco);
      if (!feitas.length) achados.push(`12': a substituição não entrou`);
    }
    entregarQuadro(co, quadro({}), []);
    for (const ev of e.plan.events.filter((x) => x.minute === minuto).map(trocado)) {
      if (ev.kind.startsWith('goal_') && ev.cadeia) {
        filaDesde = -1; cobrancas.length = 0;
        entregarQuadro(co, quadro({ gol: { chave: `g-${minuto}-${ev.actor_id}`, nome: 'x', lado: ev.actor_side, actorId: ev.actor_id, cadeia: ev.cadeia, xg: ev.xg } }), []);
        for (let i = 0; i < 160; i++) passo();
        entregarQuadro(co, quadro({}), []);
      } else if (ev.kind.startsWith('penalty_') && ev.cadeia) {
        // Como a Rápida: o pênalti marcado (falta + posicionamento), depois a cobrança.
        cobrancas.length = 0; entregarQuadro(co, quadro({ lance: ev }), []); filaDesde = -1; // lance novo: a encenação recomeça
        for (let i = 0; i < 70; i++) passo();
        const cobranca = { inicio: { x: 94, z: 34 }, finalizacao: 'cobranca' as const, acoes: [{ t: 'cobranca' as const, de: ev.actor_id, para: null, x: ev.actor_side === 'home' ? 104.5 : 0.5, z: 34 }] };
        entregarQuadro(co, quadro({ lance: { ...ev, kind: ev.actor_side === 'home' ? 'save_home' : 'save_away', cadeia: cobranca } }), []);
        for (let i = 0; i < 60; i++) passo();
      } else if (ev.cadeia) {
        cobrancas.length = 0; entregarQuadro(co, quadro({ lance: ev }), []); filaDesde = -1; // lance novo: a encenação recomeça
        const hold = Math.round(msParaMostrar(ev.cadeia) / 1000 / DT * Number(process.env.HOLD ?? 1));
        // Escanteio: na hora da cobrança o cobrador TEM que estar na bola.
        const ie = ev.cadeia.acoes.findIndex((x) => x.t === 'escanteio');
        const passoDaCobranca = ie >= 0 ? Math.round(cronogramaDaCadeia(ev.cadeia).tempos[ie]!.ini / DT) - 1 : -1;
        if (ie >= 0) cobrancas.push({ em: co.t + passoDaCobranca * DT - 0.15, de: ev.cadeia.acoes[ie]!.de!, minuto });
        esperar(hold);
      }
    }
    entregarQuadro(co, quadro({}), []);
    esperar(PASSOS_POR_MINUTO);
  }
  if (achados.length) {
    problemas += achados.length;
    console.log(`✗ partida ${n} (${e.plan.seed}):\n   ${achados.slice(0, 6).join('\n   ')}`);
  }
}
console.log(problemas ? `\n${problemas} problema(s) em ${partidas.length} partidas` : `\n✓ ${partidas.length} partidas inteiras sem laço`);
if (problemas) process.exit(1);
