/**
 * PARTIDA VIVA — Fase 7: o filme que vai pro servidor (docs/PARTIDA-VIVA-PLANO.md §8).
 *
 * O filme é o roteiro de quadros que reproduz a partida no campo (cliente:
 * src/partidaViva/gravacao.ts). Aqui só a conferência — pura, sem banco:
 * formato, tamanho, placar e QUEM é o adversário.
 *
 * O adversário só vale se o id dele está DENTRO da seed da partida
 * (`<sigla>-<sigla>-<id do adversário>-<hora>`, montada antes do plano ser
 * pedido ao motor) — e a rota ainda confere que existe plano emitido pra
 * essa seed e esse dono. Assim ninguém manda notificação pra um manager
 * qualquer só escrevendo o id dele.
 */

export const TETO_DO_FILME = 350_000; // bytes do JSON
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResumoDoFilme {
  siglaCasa: string;
  siglaFora: string;
  nomeCasa: string;
  nomeFora: string;
  placarCasa: number;
  placarFora: number;
}

export type FilmeConferido =
  | { ok: true; seed: string; adversario: string | null; resumo: ResumoDoFilme; filme: Record<string, unknown> }
  | { ok: false; erro: string };

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const gols = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 30 ? v : null);

export function conferirFilme(corpo: unknown, dono: string): FilmeConferido {
  if (!corpo || typeof corpo !== 'object') return { ok: false, erro: 'corpo inválido' };
  const { filme, adversario } = corpo as { filme?: unknown; adversario?: unknown };
  if (!filme || typeof filme !== 'object') return { ok: false, erro: 'sem filme' };
  const f = filme as Record<string, unknown>;
  if (f.v !== 1 || !Array.isArray(f.trechos) || !f.trechos.length || !Array.isArray(f.fichas)) return { ok: false, erro: 'filme fora do formato' };
  const tamanho = JSON.stringify(f).length;
  if (tamanho > TETO_DO_FILME) return { ok: false, erro: `filme grande demais (${tamanho} bytes)` };
  const seed = texto(f.seed, 200);
  if (!seed) return { ok: false, erro: 'sem seed' };
  const placarCasa = gols(f.placarCasa), placarFora = gols(f.placarFora);
  if (placarCasa === null || placarFora === null) return { ok: false, erro: 'placar inválido' };
  for (const t of f.trechos as unknown[]) {
    const r = (t as { roteiro?: unknown })?.roteiro;
    if (!Array.isArray(r)) return { ok: false, erro: 'trecho sem roteiro' };
  }

  let adv: string | null = null;
  if (adversario != null) {
    if (typeof adversario !== 'string' || !UUID.test(adversario)) return { ok: false, erro: 'adversário inválido' };
    if (adversario === dono) return { ok: false, erro: 'adversário é o próprio dono' };
    // O adversário tem de estar na seed da partida (ela nasce antes do plano).
    if (!seed.includes(`-${adversario}-`)) return { ok: false, erro: 'adversário não é o desta partida' };
    adv = adversario;
  }
  return {
    ok: true,
    seed,
    adversario: adv,
    resumo: {
      siglaCasa: texto(f.siglaCasa, 8), siglaFora: texto(f.siglaFora, 8),
      nomeCasa: texto(f.nomeCasa, 60), nomeFora: texto(f.nomeFora, 60),
      placarCasa, placarFora,
    },
    filme: f,
  };
}

/** A notificação do adversário: o time DELE jogou — com o placar do ponto de vista dele. */
export function avisoDoAdversario(r: ResumoDoFilme): { titulo: string; mensagem: string } {
  const dele = r.placarFora, outro = r.placarCasa;
  const como = dele > outro ? 'venceu' : dele < outro ? 'perdeu' : 'empatou';
  return {
    titulo: `Seu time jogou: ${r.siglaFora} ${dele} × ${outro} ${r.siglaCasa}`,
    mensagem: `O ${r.nomeCasa || r.siglaCasa} desafiou o seu ${r.nomeFora || r.siglaFora}, e o seu time ${como}. Assista a partida em campo.`,
  };
}

/**
 * O time de fora do filme é mesmo o elenco do adversário? Os ids das fichas
 * de fora têm de estar no `manager_squad.players` dele (8 de 11, no mínimo —
 * lesão e troca de elenco no meio do caminho não derrubam).
 */
export function elencoBate(filme: Record<string, unknown>, idsDoElenco: readonly string[]): boolean {
  const fichas = Array.isArray(filme.fichas) ? (filme.fichas as Array<{ id?: unknown; lado?: unknown }>) : [];
  const deFora = fichas.filter((f) => f?.lado === 'away' && typeof f.id === 'string').map((f) => f.id as string);
  if (deFora.length < 8) return false;
  const elenco = new Set(idsDoElenco);
  return deFora.filter((id) => elenco.has(id)).length >= 8;
}

/** Teto de avisos: por dono por dia, e por par (dono → adversário) por dia. */
export const AVISOS_POR_DIA = 10;
export const AVISOS_POR_ADVERSARIO_POR_DIA = 3;

// ── Fase 8: "sua lenda jogou" ───────────────────────────────────────────────

type Entrega = { q?: { emCampo?: unknown; gol?: { chave?: unknown; actorId?: unknown } | null } };

/**
 * Quem pode ser lenda neste filme: os 22 do apito + quem entrou do banco
 * (aparece no `emCampo` de algum quadro). A rota filtra pelos ids que existem
 * em `legacy_players` — aqui só os candidatos.
 */
export function candidatosALenda(filme: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  for (const f of Array.isArray(filme.fichas) ? (filme.fichas as Array<{ id?: unknown }>) : []) {
    if (typeof f?.id === 'string') ids.add(f.id);
  }
  const banco = new Set((Array.isArray(filme.banco) ? (filme.banco as Array<{ id?: unknown }>) : []).flatMap((b) => (typeof b?.id === 'string' ? [b.id] : [])));
  for (const t of Array.isArray(filme.trechos) ? (filme.trechos as Array<{ roteiro?: unknown }>) : []) {
    for (const e of Array.isArray(t?.roteiro) ? (t.roteiro as Entrega[]) : []) {
      const emCampo = e?.q?.emCampo;
      if (Array.isArray(emCampo)) for (const id of emCampo) if (typeof id === 'string' && banco.has(id)) ids.add(id);
    }
  }
  return [...ids].slice(0, 60);
}

/** Gols de cada jogador no filme (gols distintos pela chave da comemoração). */
export function golsNoFilme(filme: Record<string, unknown>): Map<string, number> {
  const porGol = new Map<string, string>();
  for (const t of Array.isArray(filme.trechos) ? (filme.trechos as Array<{ roteiro?: unknown }>) : []) {
    for (const e of Array.isArray(t?.roteiro) ? (t.roteiro as Entrega[]) : []) {
      const g = e?.q?.gol;
      if (g && typeof g.chave === 'string' && typeof g.actorId === 'string') porGol.set(g.chave, g.actorId);
    }
  }
  const gols = new Map<string, number>();
  for (const autor of porGol.values()) gols.set(autor, (gols.get(autor) ?? 0) + 1);
  return gols;
}

/** A notificação do atleta: a lenda dele jogou (e fez gol, quando fez). */
export function avisoDaLenda(nome: string, r: ResumoDoFilme, gols: number): { titulo: string; mensagem: string } {
  const placar = `${r.siglaCasa} ${r.placarCasa} × ${r.placarFora} ${r.siglaFora}`;
  return {
    titulo: gols > 0 ? `${nome} marcou ${gols === 1 ? 'um gol' : `${gols} gols`}! ${placar}` : `${nome} entrou em campo: ${placar}`,
    mensagem: 'Um manager escalou a sua lenda numa partida. Assista com a câmera seguindo você.',
  };
}
