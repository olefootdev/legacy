/**
 * PARTIDA VIVA — O FILME COMO ARENA (Fase 4 do Motor de Posses).
 *
 * "Assumir o lance": você pega o filme de outro manager (ou o da sua lenda),
 * escolhe um minuto, dá as suas ordens e decide os momentos — com os MESMOS
 * dados. O servidor (server/src/routes/arena.ts) simula e conta; aqui:
 *
 *   - as chamadas (`assumirLance`, `fecharLance`, desafios, ranking);
 *   - `roteiroDaArena`: o plano que o servidor devolveu, com as suas escolhas,
 *     vira um ROTEIRO de filme (os quadros e os passos em que chegam) que o
 *     mesmo palco do LEGACY toca. O placar de cada gol é `golDoLance` — a mesma
 *     porta do jogo ao vivo e da custódia. Nada é sorteado aqui.
 *
 * Tudo nunca lança: sem sessão ou sem rede, devolve null / lista vazia.
 */
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';
import { L } from '@/i18n/L';
import { CABECALHO_IDIOMA } from '@/i18n/cabecalho';
import { golDoLance, lanceDe, type Escolhas } from '@/match/placarAoVivo';
import type { CadeiaDeLance, MatchPlan, MatchPlanEvent } from '@/match/quickPlanTypes';
import type { ProvaDeCausa } from '@/match/provaDeCausa';
import { Coreografo, DT } from './coreografo';
import { msParaMostrar } from './cronograma';
import { comprimirEventos } from './compressao';
import { entregarQuadro, type Entrega } from './gravacao';
import type { Ficha, QuadroAoVivo } from './tipos';

export type Placar = [number, number];

/** Uma ordem da prancheta (as mesmas do LEGACY ao vivo, com o minuto em que vale). */
export type OrdemDaArena =
  | { minuto: number; tipo: 'incentivar' | 'cobrar' | 'acalmar' }
  | { minuto: number; tipo: 'estilo'; estilo: 'defend' | 'counter' | 'possession' | 'press' | 'attack' }
  | { minuto: number; tipo: 'ordem'; ordem: 'segurar' | 'atacar_espaco' | 'marcar'; jogador: string; alvo?: string };

export type MomentoDaArena =
  | { tipo: 'decisivo'; m: number; intent: 'attack' | 'defend'; contexto: string; opcoes: string[];
      duelo: { nosso: { id: string; nome: string }; deles: { id: string; nome: string }; por_opcao: Record<string, [number, number]> };
      auto: string }
  | { tipo: 'penalti'; m: number; sugerido: string | null; batedores: string[] };

export interface VereditoDaArena {
  minuto: number; noMinuto: Placar; ele: Placar; voce: Placar; parado: Placar; saldo: number; contraParado: number;
}

export interface Prancheta {
  papel: 'dono' | 'adversario' | 'lenda' | 'desafio';
  minuto: number;
  noMinuto: Placar;
  ordens: OrdemDaArena[];
  emCampo: string[];
  momentos: MomentoDaArena[];
  jaTentou: { minuto: number; placar_voce: Placar; placar_ele: Placar; saldo: number } | null;
}

export interface Fechamento {
  papel: Prancheta['papel'];
  veredito: VereditoDaArena;
  escolhas: Escolhas;
  momentos: MomentoDaArena[];
  plano: MatchPlan;
  emCampo: string[];
  prova: ProvaDeCausa | null;
  registrado: boolean;
  lendaAprendeu: boolean;
}

async function token(): Promise<string | null> {
  try {
    const sb = getSupabase();
    return sb ? (await sb.auth.getSession()).data.session?.access_token ?? null : null;
  } catch {
    return null;
  }
}

async function chamar<T>(caminho: string, corpo?: unknown): Promise<{ ok: true; dado: T } | { ok: false; erro: string }> {
  const t = await token();
  if (!t) return { ok: false, erro: 'sessão' };
  try {
    const r = await fetch(`${olefootApiBase()}${caminho}`, {
      method: corpo === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...CABECALHO_IDIOMA },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
    const j = (await r.json().catch(() => null)) as (T & { ok?: boolean; erro?: string }) | null;
    if (!r.ok || !j?.ok) return { ok: false, erro: j?.erro ?? `erro ${r.status}` };
    return { ok: true, dado: j };
  } catch {
    return { ok: false, erro: 'rede' };
  }
}

/** A prancheta: o servidor simula dali e devolve os momentos (sem desfecho). Não grava nada. */
export function assumirLance(filme: string, minuto: number, ordens: OrdemDaArena[]) {
  return chamar<Prancheta>('/api/arena/assumir', { filme, minuto, ordens });
}

/** O tiro: o servidor refaz, conta, grava a tentativa e devolve o plano pro campo. */
export function fecharLance(filme: string, minuto: number, ordens: OrdemDaArena[], escolhas: Escolhas) {
  return chamar<Fechamento>('/api/arena/fechar', { filme, minuto, ordens, escolhas });
}

export function abrirDesafio(filme: string) {
  return chamar<Record<string, never>>('/api/arena/abrir', { filme });
}

export interface DesafioAberto { id: string; quando: string; meuSaldo: number | null; resumo: { siglaCasa: string; siglaFora: string; nomeCasa: string; nomeFora: string; placarCasa: number; placarFora: number } }
export async function listarDesafios(): Promise<DesafioAberto[]> {
  const r = await chamar<{ desafios: DesafioAberto[] }>('/api/arena/desafios');
  return r.ok && Array.isArray(r.dado.desafios) ? r.dado.desafios : [];
}

export interface LinhaDoRanking { pos: number; nome?: string; sigla?: string; pontos: number; tentativas: number; melhor: number; eu: boolean }
export async function rankingDaArena(): Promise<{ semana: string; linhas: LinhaDoRanking[]; minha: { pos: number; pontos: number; tentativas: number } | null } | null> {
  const r = await chamar<{ semana: string; linhas: LinhaDoRanking[]; minha: { pos: number; pontos: number; tentativas: number } | null }>('/api/arena/ranking');
  return r.ok ? r.dado : null;
}

// ── o roteiro do filme da arena ──────────────────────────────────────────────

/** Ritmo do LEGACY contínuo: ~1,1 s por minuto sem lance. */
const PASSOS_POR_MINUTO = Math.round(1.1 / DT);
/** Gol: a festa, o replay e o giz param o relógio do palco; folga depois do gol. */
const PASSOS_DEPOIS_DO_GOL = 160;

const lado = (k: string): 'home' | 'away' => (k.endsWith('_home') ? 'home' : 'away');

/**
 * O plano da arena (do minuto assumido ao fim) com as suas escolhas → roteiro
 * de quadros pro palco. `noMinuto` = o placar quando você assumiu. Devolve
 * também o placar final que o roteiro mostra (tem de ser o do veredito).
 */
export function roteiroDaArena(
  plano: MatchPlan, fichas: Ficha[], banco: Ficha[], formacaoCasa: string, formacaoFora: string,
  escolhas: Escolhas, noMinuto: Placar, emCampo: string[], nome: (id: string | undefined) => string,
): { roteiro: Entrega[]; placar: Placar } {
  const co = new Coreografo(fichas, formacaoCasa, formacaoFora, `${plano.seed}|arena|${plano.start_minute ?? 1}`);
  const roteiro: Entrega[] = [];
  const placar: Placar = [noMinuto[0], noMinuto[1]];
  const narracao: QuadroAoVivo['narracao'] = [];
  const inicio = plano.start_minute ?? 1;
  const jogadas = new Map((plano.jogadas ?? []).map((j) => [j.m, j] as const));
  const folego = new Map((plano.folego ?? []).map((f) => [f[0], f[1]] as const));
  const fluxo = new Map((plano.fluxo ?? []).map((f) => [f[0], f] as const));
  // Os mesmos lances comprimidos do LEGACY ao vivo (baixa tensão mostra só o final).
  const eventos = comprimirEventos(plano.events);
  let minuto = inicio;
  const quadro = (extra: Partial<QuadroAoVivo>): QuadroAoVivo => {
    const f = fluxo.get(minuto);
    return {
      minuto, fase: 'playing', placarCasa: placar[0], placarFora: placar[1],
      momento: plano.momentum_curve[minuto - inicio] ?? 50, lance: null, gol: null, narracao: narracao.slice(0, 3),
      posse: f ? { lado: f[1] === 'h' ? 'home' : 'away', zona: f[2], roubou: f[3] === 1, ator: f[4] } : null,
      jogada: jogadas.get(minuto) ?? null, folego: folego.get(minuto), emCampo,
      ...extra,
    };
  };
  const entregar = (q: QuadroAoVivo) => { roteiro.push({ p: co.passos, q }); entregarQuadro(co, q, banco); };
  const passos = (n: number) => { for (let i = 0; i < n; i++) co.passo(); };
  const narrar = (texto: string, chave: string) => { narracao.unshift({ id: chave, minuto, texto }); };

  for (; minuto <= 90; minuto++) {
    const lances = eventos.filter((e) => e.minute === minuto);
    let teveLance = false;
    for (const [i, ev] of lances.entries()) {
      const chave = `arena-${minuto}-${i}`;
      const base = ev.kind.replace(/_(home|away)$/, '');
      if (base === 'goal' || base === 'penalty') {
        const l = lanceDe(ev);
        const gol = !!l && golDoLance(l, escolhas);
        const quem = lado(ev.kind);
        // Pênalti: a marcação primeiro, depois a cobrança.
        let cadeia: CadeiaDeLance | undefined = ev.cadeia;
        let autor = ev.actor_id;
        if (base === 'penalty') {
          entregar(quadro({ lance: ev }));
          passos(70);
          autor = quem === 'home' ? (escolhas.penaltis[String(minuto)] && l?.penalti?.por_batedor && escolhas.penaltis[String(minuto)]! in l.penalti.por_batedor ? escolhas.penaltis[String(minuto)] : l?.penalti?.batedor ?? ev.actor_id) : ev.actor_id;
          cadeia = { inicio: { x: 94, z: 34 }, finalizacao: 'cobranca', acoes: [{ t: 'cobranca', de: autor ?? '', para: null, x: quem === 'home' ? 104.5 : 0.5, z: 34 }] };
        }
        if (gol) {
          placar[quem === 'home' ? 0 : 1] += 1;
          narrar(ev.text, chave);
          entregar(quadro({ fase: 'celebration', gol: { chave, nome: nome(autor), lado: quem, actorId: autor, cadeia, xg: ev.xg } }));
          passos(PASSOS_DEPOIS_DO_GOL);
          entregar(quadro({}));
        } else {
          // A escolha não deu: o mesmo lance, sem a bola entrar (defesa do goleiro / bola pra fora).
          const kind = (quem === 'home' ? 'save_home' : 'chance_away') as MatchPlanEvent['kind'];
          const texto = quem === 'home'
            ? L(`${nome(autor)} finaliza e o goleiro segura.`, `${nome(autor)} shoots and the keeper holds it.`)
            : L(`${nome(autor)} finaliza, mas não passa.`, `${nome(autor)} shoots, but it doesn't get through.`);
          narrar(texto, chave);
          const semGol = { ...ev, kind, cadeia, text: texto } as MatchPlanEvent;
          entregar(quadro({ lance: semGol }));
          passos(cadeia ? Math.round(msParaMostrar(cadeia) / 1000 / DT) : 30);
        }
        teveLance = true;
      } else if (ev.cadeia) {
        narrar(ev.text, chave);
        entregar(quadro({ lance: ev }));
        passos(Math.round(msParaMostrar(ev.cadeia) / 1000 / DT));
        teveLance = true;
      } else if (/^(yellow|red|injury)_/.test(ev.kind)) {
        narrar(ev.text, chave);
      }
    }
    if (!teveLance) entregar(quadro({}));
    passos(PASSOS_POR_MINUTO);
  }
  entregar(quadro({ minuto: 90, fase: 'done' }));
  return { roteiro, placar };
}
