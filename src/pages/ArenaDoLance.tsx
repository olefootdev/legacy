/**
 * PARTIDA VIVA — O FILME COMO ARENA (Fase 4 do Motor de Posses).
 *
 * /match/arena            → desafios abertos, o ranking da semana e os seus filmes.
 * /match/arena/:idNuvem   → ASSUMIR O LANCE de um filme: escolha o minuto, dê as
 *                           suas ordens, decida os momentos (sem saber o desfecho),
 *                           veja no campo e compare: "você fez 2×1 onde ele fez 1×1".
 *
 * Tudo o que decide está no servidor (server/src/routes/arena.ts): esta tela só
 * escolhe e mostra. O filme do resultado é o mesmo palco do LEGACY tocando o
 * roteiro do plano que o servidor devolveu (src/partidaViva/arena.ts).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { L } from '@/i18n/L';
import { escolhasVazias, type Escolhas } from '@/match/placarAoVivo';
import { rotuloDaOpcao, textoDoContexto } from '@/match/quickClutch';
import { TACTICAL_INTENSITY_PRESETS, type TacticalIntensityLevel } from '@/match/quickTacticalIntensity';
import { fraseDaProva } from '@/match/provaDeCausa';
import { PartidaVivaPalco } from '@/partidaViva/PartidaVivaPalco';
import { criarCanalAoVivo } from '@/partidaViva/canal';
import { abrirFilmeDaNuvem, listarFilmesDaNuvem, type FilmeNaNuvem, type PapelNoFilme } from '@/partidaViva/filmeServidor';
import type { FilmeDaPartida } from '@/partidaViva/gravacao';
import {
  abrirDesafio, assumirLance, fecharLance, listarDesafios, rankingDaArena, roteiroDaArena,
  type DesafioAberto, type Fechamento, type LinhaDoRanking, type OrdemDaArena, type Placar, type Prancheta,
} from '@/partidaViva/arena';
import { ligarSom } from '@/partidaViva/som';

const ROTULO = 'font-prova text-[11px] font-bold uppercase tracking-[0.18em]';
const ESTILOS: TacticalIntensityLevel[] = ['defend', 'counter', 'possession', 'press', 'attack'];
const GRITOS = [
  { tipo: 'incentivar' as const, rotulo: L('Incentivar', 'Fire up') },
  { tipo: 'cobrar' as const, rotulo: L('Cobrar', 'Demand') },
  { tipo: 'acalmar' as const, rotulo: L('Acalmar', 'Calm down') },
];
const MINUTO_MAX = 85;

/** O servidor responde em português; aqui vira a frase do idioma do jogo. */
function erroDaArena(e: string): string {
  if (e === 'sessão') return L('Entre na sua conta pra assumir um lance.', 'Sign in to take over a play.');
  if (e === 'rede') return L('Sem conexão com o servidor. Tente de novo.', 'No connection to the server. Try again.');
  if (e.startsWith('filme gravado antes') || e.startsWith('partida de antes')) return L('Este filme é de antes da arena: só partidas novas podem ser assumidas.', 'This film predates the arena: only new matches can be taken over.');
  if (e.startsWith('o filme não bate')) return L('O placar deste filme não confere com o servidor — ele não vira arena.', "This film's score doesn't match the server — it can't be an arena.");
  if (e.startsWith('partida sem custódia')) return L('O servidor não guardou esta partida — ela não vira arena.', "The server didn't keep this match — it can't be an arena.");
  if (e.startsWith('só o dono')) return L('Só o dono abre o filme como desafio.', 'Only the owner can open the film as a challenge.');
  if (e.startsWith('desafio ainda não')) return L('Desafios ainda não estão abertos.', "Challenges aren't open yet.");
  return L('A arena não respondeu agora. Tente de novo.', "The arena didn't respond. Try again.");
}

/** O placar do filme antes do minuto (o que o dono tinha quando você assume). */
function placarNoFilme(f: FilmeDaPartida, minuto: number): Placar {
  let p: Placar = [0, 0];
  for (const t of f.trechos) for (const e of t.roteiro) if (e.q.minuto < minuto) p = [e.q.placarCasa, e.q.placarFora];
  return p;
}

/** Os lances do filme pra escolher onde assumir: gols, chances e pênaltis, uma vez cada. */
function lancesDoFilme(f: FilmeDaPartida): { m: number; texto: string }[] {
  const vistos = new Map<number, string>();
  for (const t of f.trechos) {
    for (const e of t.roteiro) {
      const q = e.q;
      if (q.gol && !vistos.has(q.minuto)) vistos.set(q.minuto, L(`Gol — ${q.gol.nome}`, `Goal — ${q.gol.nome}`));
      else if (q.lance && /^(chance|shot|save|woodwork|penalty)_/.test(q.lance.kind) && !vistos.has(q.lance.minute)) {
        vistos.set(q.lance.minute, q.lance.kind.startsWith('penalty') ? L('Pênalti', 'Penalty') : L('Chance', 'Chance'));
      }
    }
  }
  return [...vistos].map(([m, texto]) => ({ m, texto })).filter((x) => x.m >= 2 && x.m <= MINUTO_MAX).sort((a, b) => a.m - b.m);
}

function Botao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-[44px] px-3 py-2 text-left font-sans text-[14px] font-bold ${ativo ? 'bg-rua text-asfalto-27' : 'border border-linha bg-concreto text-papel'}`}>
      {children}
    </button>
  );
}

// ── /match/arena ─────────────────────────────────────────────────────────────

function Hub() {
  const navigate = useNavigate();
  const [desafios, setDesafios] = useState<DesafioAberto[] | null>(null);
  const [meus, setMeus] = useState<FilmeNaNuvem[]>([]);
  const [ranking, setRanking] = useState<Awaited<ReturnType<typeof rankingDaArena>>>(null);
  useEffect(() => {
    void listarDesafios().then(setDesafios);
    void listarFilmesDaNuvem().then(setMeus);
    void rankingDaArena().then(setRanking);
  }, []);
  const ir = (id: string) => { ligarSom(); navigate(`/match/arena/${id}`); };
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6 text-papel">
      <header>
        <p className={`${ROTULO} text-rua`}>— {L('O filme como arena', 'The film as an arena')}</p>
        <h1 className="mt-1 font-impact text-[44px] uppercase leading-none">{L('Assuma o lance', 'Take over')}</h1>
        <p className="mt-1 font-prova text-[12px] text-mudo">
          {L('Pegue o jogo de outro manager num minuto, com os mesmos dados. Você faz melhor que ele?', "Take another manager's game at any minute, same dice. Can you do better?")}
        </p>
      </header>

      <section>
        <p className={`${ROTULO} mb-2 text-mudo`}>— {L('Desafios abertos', 'Open challenges')}</p>
        {desafios === null ? (
          <p className="font-prova text-[12px] text-mudo">{L('Carregando…', 'Loading…')}</p>
        ) : desafios.length === 0 ? (
          <p className="border border-linha px-3 py-4 font-prova text-[12px] text-mudo">{L('Nenhum desafio aberto agora.', 'No open challenges right now.')}</p>
        ) : desafios.map((d) => (
          <button key={d.id} type="button" onClick={() => ir(d.id)} className="mb-2 flex w-full items-center justify-between border border-linha bg-concreto px-3 py-2.5 text-left">
            <span>
              <span className="block font-impact text-[18px] leading-none">{d.resumo.siglaCasa} {d.resumo.placarCasa} × {d.resumo.placarFora} {d.resumo.siglaFora}</span>
              <span className="mt-1 block font-prova text-[11px] text-mudo">{d.resumo.nomeCasa}{d.meuSaldo !== null ? ` · ${L('seu saldo', 'your margin')} ${d.meuSaldo > 0 ? '+' : ''}${d.meuSaldo}` : ''}</span>
            </span>
            <span aria-hidden className="font-impact text-[22px] text-rua">{d.meuSaldo === null ? '▶' : '✓'}</span>
          </button>
        ))}
      </section>

      {meus.length > 0 && (
        <section>
          <p className={`${ROTULO} mb-2 text-mudo`}>— {L('Seus filmes', 'Your films')}</p>
          {meus.slice(0, 8).map((f) => (
            <button key={f.id} type="button" onClick={() => ir(f.id)} className="mb-2 flex w-full items-center justify-between border border-linha px-3 py-2.5 text-left">
              <span className="font-impact text-[18px] leading-none">{f.resumo.siglaCasa} {f.resumo.placarCasa} × {f.resumo.placarFora} {f.resumo.siglaFora}</span>
              <span aria-hidden className="font-impact text-[22px] text-rua">▶</span>
            </button>
          ))}
        </section>
      )}

      <section>
        <p className={`${ROTULO} mb-2 text-mudo`}>— {L(`Ranking da semana${ranking ? ` · ${ranking.semana}` : ''}`, `This week's ranking${ranking ? ` · ${ranking.semana}` : ''}`)}</p>
        {!ranking || ranking.linhas.length === 0 ? (
          <p className="border border-linha px-3 py-4 font-prova text-[12px] text-mudo">{L('Ninguém pontuou ainda. Cada gol de saldo a mais que o dono do filme vale 1 ponto.', 'Nobody has scored yet. Each goal of margin over the film owner is 1 point.')}</p>
        ) : (
          <ol className="flex flex-col">
            {ranking.linhas.map((l: LinhaDoRanking) => (
              <li key={l.pos} className={`flex items-center gap-2 border-b border-linha px-2 py-2 font-prova text-[12px] ${l.eu ? 'bg-rua text-asfalto-27' : ''}`}>
                <span className="w-7 shrink-0 font-impact text-[16px] tabular-nums">{l.pos}</span>
                <span className="min-w-0 flex-1 truncate font-sans text-[14px] font-bold">{l.eu ? L('Você', 'You') : l.nome ?? '—'}</span>
                <span className="w-16 shrink-0 text-right tabular-nums">{l.tentativas} {L('lances', 'plays')}</span>
                <span className="w-9 shrink-0 text-right font-impact text-[16px] tabular-nums">{l.pontos}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <Link to="/match/filme" className="self-start font-prova text-[12px] text-suave underline">{L('Voltar aos filmes', 'Back to films')}</Link>
    </div>
  );
}

// ── /match/arena/:id ─────────────────────────────────────────────────────────

type Etapa = 'minuto' | 'prancheta' | 'momentos' | 'filme' | 'veredito';

function Assumir({ id, voltar }: { id: string; voltar: string }) {
  const navigate = useNavigate();
  const [nuvem, setNuvem] = useState<{ filme: FilmeDaPartida; papel: PapelNoFilme } | null | 'carregando'>('carregando');
  useEffect(() => { void abrirFilmeDaNuvem(id).then((r) => setNuvem(r ? { filme: r.filme, papel: r.papel } : null)); }, [id]);
  const [etapa, setEtapa] = useState<Etapa>('minuto');
  const [minuto, setMinuto] = useState(60);
  const [estilo, setEstilo] = useState<TacticalIntensityLevel | null>(null);
  const [grito, setGrito] = useState<'incentivar' | 'cobrar' | 'acalmar' | null>(null);
  const [marcador, setMarcador] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [prancheta, setPrancheta] = useState<Prancheta | null>(null);
  const [escolhas, setEscolhas] = useState<Escolhas>(escolhasVazias());
  const [fechado, setFechado] = useState<Fechamento | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [desafioAberto, setDesafioAberto] = useState<'nao' | 'abrindo' | 'sim' | string>('nao');
  const canal = useMemo(() => criarCanalAoVivo(), [fechado]); // eslint-disable-line react-hooks/exhaustive-deps

  const filme = nuvem && nuvem !== 'carregando' ? nuvem.filme : null;
  const todas = useMemo(() => (filme ? [...filme.fichas, ...filme.banco] : []), [filme]);
  const nome = (pid: string | undefined | null) => todas.find((f) => f.id === pid)?.nome ?? pid ?? '';
  const lances = useMemo(() => (filme ? lancesDoFilme(filme) : []), [filme]);

  const ordens = (): OrdemDaArena[] => {
    const o: OrdemDaArena[] = [];
    if (estilo) o.push({ minuto, tipo: 'estilo', estilo });
    if (grito) o.push({ minuto, tipo: grito });
    if (marcador && alvo) o.push({ minuto, tipo: 'ordem', ordem: 'marcar', jogador: marcador, alvo });
    return o;
  };
  const rotuloDasOrdens = () => {
    const p: string[] = [];
    if (estilo) p.push(TACTICAL_INTENSITY_PRESETS[estilo].label);
    if (grito) p.push(GRITOS.find((g) => g.tipo === grito)!.rotulo);
    if (marcador && alvo) p.push(L(`${nome(marcador)} marca ${nome(alvo)}`, `${nome(marcador)} marks ${nome(alvo)}`));
    return p.join(' + ') || L('nenhuma ordem', 'no orders');
  };

  const pedirPrancheta = async () => {
    setOcupado(true); setErro(null);
    const r = await assumirLance(id, minuto, ordens());
    setOcupado(false);
    if ('erro' in r) { setErro(erroDaArena(r.erro)); return; }
    setPrancheta(r.dado);
    setEscolhas(escolhasVazias());
    setEtapa('momentos');
  };
  const fechar = async () => {
    if (!prancheta) return;
    setOcupado(true); setErro(null);
    const r = await fecharLance(id, prancheta.minuto, ordens(), escolhas);
    setOcupado(false);
    if ('erro' in r) { setErro(erroDaArena(r.erro)); return; }
    ligarSom();
    setFechado(r.dado);
    setEtapa('filme');
  };
  const abrir = async () => {
    setDesafioAberto('abrindo');
    const r = await abrirDesafio(id);
    setDesafioAberto('erro' in r ? erroDaArena(r.erro) : 'sim');
  };

  const roteiro = useMemo(() => {
    if (!fechado || !filme) return null;
    return roteiroDaArena(fechado.plano, filme.fichas, filme.banco, filme.formacaoCasa, filme.formacaoFora, fechado.escolhas, fechado.veredito.noMinuto, fechado.emCampo, (pid) => nome(pid));
  }, [fechado, filme]); // eslint-disable-line react-hooks/exhaustive-deps

  if (nuvem === 'carregando') return <div className="mx-auto max-w-xl px-4 py-6 font-prova text-[12px] text-mudo">{L('Carregando o filme…', 'Loading the film…')}</div>;
  if (!filme) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 font-prova text-[12px] text-papel">
        <p>{L('Não foi possível abrir este filme (entre na sua conta).', 'Could not open this film (sign in).')}</p>
        <Link to={voltar} className="mt-3 inline-block underline">{L('Voltar', 'Back')}</Link>
      </div>
    );
  }

  if (etapa === 'filme' && fechado && roteiro) {
    return (
      <PartidaVivaPalco
        key={`arena-${id}-${fechado.veredito.minuto}`}
        canal={canal}
        fichas={filme.fichas}
        banco={filme.banco}
        formacaoCasa={filme.formacaoCasa}
        formacaoFora={filme.formacaoFora}
        seed={`${filme.seed}|arena|${fechado.veredito.minuto}`}
        siglaCasa={filme.siglaCasa}
        siglaFora={filme.siglaFora}
        modo="lances"
        velocidade={2}
        pulando={false}
        onModo={() => undefined}
        onVelocidade={() => undefined}
        onPular={() => setEtapa('veredito')}
        onSair={() => setEtapa('veredito')}
        comEntrada={false}
        roteiro={roteiro.roteiro}
        ladoDeQuemAssiste="home"
        onFimDoFilme={() => setEtapa('veredito')}
      />
    );
  }

  const [pc, pf] = placarNoFilme(filme, minuto);
  const casa = filme.fichas.filter((f) => f.lado === 'home');
  const fora = filme.fichas.filter((f) => f.lado === 'away');
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6 text-papel">
      <header>
        <p className={`${ROTULO} text-rua`}>— {L('Assumir o lance', 'Take over')}</p>
        <h1 className="mt-1 font-impact text-[34px] uppercase leading-none">{filme.siglaCasa} {filme.placarCasa} × {filme.placarFora} {filme.siglaFora}</h1>
        <p className="mt-1 font-prova text-[12px] text-mudo">
          {L(`Você comanda ${filme.nomeCasa}. Mesmos dados, suas ordens.`, `You run ${filme.nomeCasa}. Same dice, your orders.`)}
        </p>
      </header>

      {etapa === 'minuto' && (
        <section className="flex flex-col gap-3">
          <p className={`${ROTULO} text-mudo`}>— {L('De que minuto você assume?', 'From which minute?')}</p>
          <div className="flex items-center gap-3 bg-concreto p-3">
            <button type="button" className="min-h-[44px] min-w-[44px] border border-linha font-impact text-[22px]" onClick={() => setMinuto(Math.max(2, minuto - 1))}>−</button>
            <span className="flex-1 text-center">
              <span className="block font-spray text-[44px] font-black leading-none text-rua tabular-nums">{minuto}'</span>
              <span className="mt-1 block font-prova text-[12px] text-suave">{L(`placar: ${pc}×${pf}`, `score: ${pc}–${pf}`)}</span>
            </span>
            <button type="button" className="min-h-[44px] min-w-[44px] border border-linha font-impact text-[22px]" onClick={() => setMinuto(Math.min(MINUTO_MAX, minuto + 1))}>+</button>
          </div>
          <input type="range" min={2} max={MINUTO_MAX} value={minuto} onChange={(e) => setMinuto(Number(e.target.value))} aria-label={L('Minuto', 'Minute')} className="w-full accent-[var(--rua,#e11d48)]" />
          {lances.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {lances.map((x) => (
                <button key={x.m} type="button" onClick={() => setMinuto(Math.max(2, x.m - 1))} className="border border-linha px-2 py-1 font-prova text-[11px] text-suave">
                  {x.m}' · {x.texto}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setEtapa('prancheta')} className="min-h-[56px] bg-rua px-4 text-left font-impact text-[22px] uppercase text-asfalto-27">
            {L(`Assumir no ${minuto}'`, `Take over at ${minuto}'`)}
          </button>
        </section>
      )}

      {etapa === 'prancheta' && (
        <section className="flex flex-col gap-3">
          <p className={`${ROTULO} text-mudo`}>— {L(`Suas ordens no ${minuto}' (${pc}×${pf})`, `Your orders at ${minuto}' (${pc}–${pf})`)}</p>
          <p className="font-prova text-[12px] text-suave">{L('Estilo', 'Style')}</p>
          <div className="grid grid-cols-2 gap-2">
            {ESTILOS.map((s) => <Botao key={s} ativo={estilo === s} onClick={() => setEstilo(estilo === s ? null : s)}>{TACTICAL_INTENSITY_PRESETS[s].label}</Botao>)}
          </div>
          <p className="font-prova text-[12px] text-suave">{L('Grito', 'Shout')}</p>
          <div className="grid grid-cols-3 gap-2">
            {GRITOS.map((g) => <Botao key={g.tipo} ativo={grito === g.tipo} onClick={() => setGrito(grito === g.tipo ? null : g.tipo)}>{g.rotulo}</Botao>)}
          </div>
          <p className="font-prova text-[12px] text-suave">{L('Marcação individual (opcional)', 'Man-marking (optional)')}</p>
          <div className="grid grid-cols-2 gap-2">
            <select value={marcador ?? ''} onChange={(e) => setMarcador(e.target.value || null)} className="min-h-[44px] border border-linha bg-concreto px-2 font-sans text-[14px] text-papel">
              <option value="">{L('Quem marca', 'Who marks')}</option>
              {casa.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <select value={alvo ?? ''} onChange={(e) => setAlvo(e.target.value || null)} className="min-h-[44px] border border-linha bg-concreto px-2 font-sans text-[14px] text-papel">
              <option value="">{L('Quem é marcado', 'Who is marked')}</option>
              {fora.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEtapa('minuto')} className="min-h-[56px] border border-linha px-4 font-prova text-[12px]">{L('Minuto', 'Minute')}</button>
            <button type="button" disabled={ocupado} onClick={() => { void pedirPrancheta(); }} className="min-h-[56px] flex-1 bg-rua px-4 text-left font-impact text-[22px] uppercase text-asfalto-27 disabled:opacity-50">
              {ocupado ? L('O motor está jogando…', 'The engine is playing…') : L('Jogar daqui', 'Play from here')}
            </button>
          </div>
        </section>
      )}

      {etapa === 'momentos' && prancheta && (
        <section className="flex flex-col gap-3">
          {prancheta.jaTentou && (
            <p className="border border-linha px-3 py-2 font-prova text-[12px] text-suave">
              {L(`Você já assumiu este filme (no ${prancheta.jaTentou.minuto}', saldo ${prancheta.jaTentou.saldo}). Pode jogar de novo, mas não conta de novo.`, `You already took this film (at ${prancheta.jaTentou.minuto}', margin ${prancheta.jaTentou.saldo}). You can replay, but it won't count again.`)}
            </p>
          )}
          <p className={`${ROTULO} text-mudo`}>
            — {prancheta.momentos.length
              ? L(`Os momentos que são seus (${prancheta.momentos.length})`, `Your moments (${prancheta.momentos.length})`)
              : L('Nenhum momento decisivo dali pra frente', 'No decisive moments from there on')}
          </p>
          <p className="font-prova text-[11px] text-mudo">{L('Você decide sem ver o fim. Sem escolha, o jogador decide sozinho.', "You decide without seeing the end. If you don't, the player decides alone.")}</p>
          {prancheta.momentos.map((mo) => {
            const k = String(mo.m);
            if (mo.tipo === 'penalti') {
              const atual = escolhas.penaltis[k] ?? mo.sugerido ?? '';
              return (
                <div key={k} className="bg-concreto p-3">
                  <p className="font-impact text-[20px] leading-none">{mo.m}' · {L('Pênalti pra nós', 'Penalty to us')}</p>
                  <select value={atual} onChange={(e) => setEscolhas({ ...escolhas, penaltis: { ...escolhas.penaltis, [k]: e.target.value } })} className="mt-2 min-h-[44px] w-full border border-linha bg-asfalto-27 px-2 font-sans text-[14px] text-papel">
                    {mo.batedores.map((b) => <option key={b} value={b}>{nome(b)}{b === mo.sugerido ? L(' (sugerido)', ' (suggested)') : ''}</option>)}
                  </select>
                </div>
              );
            }
            const atual = escolhas.decisivos[k];
            return (
              <div key={k} className="bg-concreto p-3">
                <p className="font-impact text-[20px] leading-none">{mo.m}' · {textoDoContexto(mo.contexto, mo.intent)}</p>
                <p className="mt-1 font-prova text-[11px] text-mudo">
                  {mo.intent === 'attack' ? L(`${mo.duelo.nosso.nome || nome(mo.duelo.nosso.id)} contra ${mo.duelo.deles.nome || nome(mo.duelo.deles.id)}`, `${mo.duelo.nosso.nome || nome(mo.duelo.nosso.id)} against ${mo.duelo.deles.nome || nome(mo.duelo.deles.id)}`)
                    : L(`${mo.duelo.deles.nome || nome(mo.duelo.deles.id)} vem pra cima de ${mo.duelo.nosso.nome || nome(mo.duelo.nosso.id)}`, `${mo.duelo.deles.nome || nome(mo.duelo.deles.id)} runs at ${mo.duelo.nosso.nome || nome(mo.duelo.nosso.id)}`)}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {mo.opcoes.map((op) => {
                    const r = rotuloDaOpcao(op);
                    const par = mo.duelo.por_opcao[op];
                    return (
                      <Botao key={op} ativo={atual === op} onClick={() => setEscolhas({ ...escolhas, decisivos: { ...escolhas.decisivos, [k]: op } })}>
                        <span className="block">{r.rotulo}</span>
                        {par && <span className="block font-prova text-[10px] font-normal opacity-80 tabular-nums">{Math.round(par[0])} × {Math.round(par[1])}</span>}
                      </Botao>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="font-prova text-[11px] text-mudo">{L(`Ordens: ${rotuloDasOrdens()}`, `Orders: ${rotuloDasOrdens()}`)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEtapa('prancheta')} className="min-h-[56px] border border-linha px-4 font-prova text-[12px]">{L('Ordens', 'Orders')}</button>
            <button type="button" disabled={ocupado} onClick={() => { void fechar(); }} className="min-h-[56px] flex-1 bg-rua px-4 text-left font-impact text-[22px] uppercase text-asfalto-27 disabled:opacity-50">
              {ocupado ? L('Contando…', 'Counting…') : L('Fechar o lance', 'Lock it in')}
            </button>
          </div>
        </section>
      )}

      {etapa === 'veredito' && fechado && (() => {
        const v = fechado.veredito;
        const placar = (p: Placar) => `${p[0]}×${p[1]}`;
        const melhor = v.saldo > 0, igual = v.saldo === 0;
        return (
          <section className="flex flex-col gap-3">
            <div className={`p-4 ${melhor ? 'bg-rua text-asfalto-27' : 'bg-concreto'}`}>
              <p className={`${ROTULO}`}>{L(`Do ${v.minuto}' (${placar(v.noMinuto)}) em diante`, `From ${v.minuto}' (${placar(v.noMinuto)}) on`)}</p>
              <p className="mt-1 font-impact text-[30px] uppercase leading-none">
                {L(`Você fez ${placar(v.voce)} onde ele fez ${placar(v.ele)}`, `You made it ${placar(v.voce)} where they made it ${placar(v.ele)}`)}
              </p>
              <p className="mt-2 font-prova text-[12px]">
                {melhor ? L(`+${v.saldo} de saldo sobre o dono do filme.`, `+${v.saldo} margin over the film owner.`)
                  : igual ? L('Mesmo saldo do dono do filme.', 'Same margin as the film owner.')
                    : L(`${v.saldo} de saldo: o dono do filme fez melhor.`, `${v.saldo} margin: the film owner did better.`)}
              </p>
            </div>
            <p className="font-prova text-[12px] text-suave">
              {L(`Sem mexer em nada, dava ${placar(v.parado)}.`, `Doing nothing, it ended ${placar(v.parado)}.`)}
              {' '}{v.contraParado > 0 ? L(`Suas ordens e escolhas valeram +${v.contraParado}.`, `Your orders and calls were worth +${v.contraParado}.`)
                : v.contraParado < 0 ? L(`Suas ordens e escolhas custaram ${v.contraParado}.`, `Your orders and calls cost ${v.contraParado}.`)
                  : L('Suas ordens e escolhas não mudaram o placar.', "Your orders and calls didn't change the score.")}
            </p>
            {fechado.prova && (
              <p className="border border-linha px-3 py-2 font-prova text-[12px] text-suave">
                {fraseDaProva(fechado.prova, rotuloDasOrdens(), (pid) => nome(pid))}
              </p>
            )}
            <p className="font-prova text-[11px] text-mudo">
              {fechado.registrado ? L('Entrou no ranking da semana.', "Counted in this week's ranking.")
                : fechado.papel === 'dono' ? L('Seu próprio filme não conta no ranking.', "Your own film doesn't count in the ranking.")
                  : L('Não entrou no ranking (já assumido ou ranking ainda fechado).', "Not counted (already taken, or the ranking isn't open yet).")}
              {fechado.lendaAprendeu ? L(' Sua lenda aprendeu com as suas escolhas.', ' Your legend learned from your calls.') : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setEtapa('filme')} className="min-h-[48px] border border-linha px-4 font-prova text-[12px]">{L('Ver de novo', 'Watch again')}</button>
              {nuvem.papel === 'dono' && (
                <button type="button" disabled={desafioAberto === 'abrindo' || desafioAberto === 'sim'} onClick={() => { void abrir(); }} className="min-h-[48px] border border-linha px-4 font-prova text-[12px] disabled:opacity-60">
                  {desafioAberto === 'sim' ? L('Aberto como desafio ✓', 'Open as a challenge ✓') : L('Abrir como desafio', 'Open as a challenge')}
                </button>
              )}
              <button type="button" onClick={() => navigate(voltar)} className="min-h-[48px] bg-rua px-4 font-impact text-[18px] uppercase text-asfalto-27">{L('Voltar', 'Back')}</button>
            </div>
            {desafioAberto !== 'nao' && desafioAberto !== 'abrindo' && desafioAberto !== 'sim' && <p className="font-prova text-[12px] text-baixa">{desafioAberto}</p>}
          </section>
        );
      })()}

      {erro && <p className="font-prova text-[12px] text-baixa">{erro}</p>}
      <Link to={voltar} className="self-start font-prova text-[12px] text-suave underline">{L('Voltar', 'Back')}</Link>
    </div>
  );
}

export default function ArenaDoLance() {
  const { idNuvem } = useParams<{ idNuvem?: string }>();
  // PLAYERVIP: o atleta (que pode não ter clube) volta pro cockpit dele.
  const voltar = useLocation().pathname.startsWith('/playervip') ? '/playervip' : '/match/arena';
  return idNuvem ? <Assumir id={idNuvem} voltar={voltar} /> : <Hub />;
}
