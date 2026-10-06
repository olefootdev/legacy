/**
 * SMART-PROFILE — o bloco da ficha dentro do painel do jogador.
 * Some quando a ficha ainda não existe (visitante, servidor fora, migration
 * pendente): é complemento, nunca bloqueia a tela.
 */
import { useState } from 'react';
import { L } from '@/i18n/L';
import { mexerNoCerebro, useFicha, type IdeiaDoCatalogo } from './cliente';
import { COMO_SE_GANHA, DESCRICAO_DA_CLASSE, NOME_DA_IDEIA, NOME_DA_RARIDADE, NOME_DO_ATRIBUTO, NOME_DO_EIXO, NOME_DO_TEMPERAMENTO, NOME_DO_TRACO, QUANDO_A_IDEIA_VALE, RECUSA_DO_JOGADOR, nomeDaClasse } from './rotulos';

const ROTULO = { fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em' } as const;

export function FichaDoJogador({ playerId }: { playerId: string }) {
  const { ficha, rpg } = useFicha(playerId);
  if (!ficha) return null;

  const eixos = ['ousadia', 'frieza', 'ambicao', 'lealdade'] as const;
  return (
    <section className="border border-white/10 bg-black/25 p-4 scroll-snap-section" style={{ borderRadius: 'var(--radius-md)' }}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="shrink-0 w-[3px] h-5 bg-neon-yellow" />
          <h3 className="text-neon-yellow uppercase" style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em' }}>
            {L('Ficha', 'Profile')}
          </h3>
        </div>
        <span className="border border-white/20 px-2 py-0.5 text-white/80 uppercase" style={ROTULO}>
          {NOME_DA_RARIDADE[ficha.raridade] ?? ficha.raridade}
        </span>
      </div>

      <div className="mt-3">
        <p className="text-gray-500 uppercase" style={ROTULO}>{L('Classe', 'Class')}</p>
        <p className="font-impact text-[26px] uppercase leading-[1.05] text-white">{nomeDaClasse(ficha.classe)}</p>
        <p className="mt-1 text-[12px] leading-snug text-white/60">{DESCRICAO_DA_CLASSE[ficha.classe] ?? ''}</p>
        {ficha.classe_afinidade && (
          <p className="mt-1.5 text-[11px] text-white/45">
            {L('Afinidade', 'Affinity')}: <span className="text-white/75">{nomeDaClasse(ficha.classe_afinidade)}</span>
          </p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-gray-500 uppercase" style={ROTULO}>{L('Temperamento', 'Temperament')}</p>
        <dl className="mt-2 space-y-1.5">
          {eixos.map((k) => (
            <div key={k} className="grid grid-cols-[84px_1fr_28px] items-center gap-2">
              <dt className="text-[11px] text-white/70">{NOME_DO_TEMPERAMENTO[k]}</dt>
              <div className="h-1.5 bg-white/10" aria-hidden>
                <div className="h-full bg-neon-yellow" style={{ width: `${ficha.temperamento[k]}%` }} />
              </div>
              <dd className="text-right font-mono text-[11px] tabular-nums text-white/80">{ficha.temperamento[k]}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* FASE 4 (RPG) — o nível deixou de ser número solto: tem barra de XP e os
          traços que o jogador conquistou, com o efeito que eles têm em campo. A
          curva e o catálogo vêm do servidor (useFicha → rpg), então a tela não
          duplica nenhum número da regra. */}
      {rpg ? (() => {
        const curva = rpg.curvaDeXp;
        const maximo = curva.length - 1;
        const doNivel = curva[Math.min(ficha.nivel, maximo)] ?? 0;
        const doProximo = ficha.nivel >= maximo ? doNivel : (curva[ficha.nivel + 1] ?? doNivel);
        const faixa = Math.max(1, doProximo - doNivel);
        const andado = Math.max(0, Math.min(faixa, ficha.xp - doNivel));
        const pct = ficha.nivel >= maximo ? 100 : Math.round((andado / faixa) * 100);
        const ganhos = rpg.tracos.filter((t) => ficha.tracos.some((x) =>
          x === t.id || (x as { id?: unknown })?.id === t.id));
        return (
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-gray-500 uppercase" style={ROTULO}>{L('Nível', 'Level')} {ficha.nivel}</span>
              <span className="font-mono text-[10.5px] tabular-nums text-white/50">
                {ficha.nivel >= maximo
                  ? L('máximo', 'max')
                  : `${ficha.xp} / ${doProximo} XP`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 bg-white/10" aria-hidden>
              <div className="h-full bg-neon-yellow" style={{ width: `${pct}%` }} />
            </div>

            <dt className="mt-3 text-gray-500 uppercase" style={ROTULO}>{L('Traços', 'Traits')}</dt>
            {ganhos.length === 0 ? (
              <p className="mt-1 text-[11px] text-white/40">
                {L('Nenhum ainda. Jogando, ele conquista.', 'None yet. He earns them by playing.')}
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {ganhos.map((t) => (
                  <li key={t.id} className="border border-neon-yellow/40 bg-neon-yellow/10 px-2 py-0.5">
                    <span className="text-[11px] font-semibold text-white">{NOME_DO_TRACO[t.id] ?? t.id}</span>
                    <span className="ml-1.5 font-mono text-[10px] tabular-nums text-neon-yellow">
                      +{t.bonus} {NOME_DO_ATRIBUTO[t.atributo] ?? t.atributo}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {/* O que ainda falta conquistar — o RPG só puxa se o jogador vê o alvo. */}
            {ganhos.length < rpg.tracos.length && (
              <p className="mt-1.5 text-[10.5px] text-white/35">
                {L('A conquistar', 'To earn')}: {rpg.tracos.filter((t) => !ganhos.includes(t))
                  .map((t) => `${NOME_DO_TRACO[t.id] ?? t.id} (${COMO_SE_GANHA[t.id] ?? t.comoSeGanha})`).join(' · ')}
              </p>
            )}
          </div>
        );
      })() : null}

      {/* FASE 5 (MANAGER-IDEAS) — o cérebro. É aqui que o manager age: ensina a
          ideia, ela ocupa um espaço (vem da raridade) e só acorda quando a
          partida pede. A regra de quem aceita é do SERVIDOR; esta tela manda a
          intenção e mostra a recusa na voz do jogador. */}
      {rpg?.ideias?.length ? (
        <Cerebro
          playerId={playerId}
          espacos={ficha.cerebro.espacos}
          sabidas={ficha.cerebro.ideias}
          catalogo={rpg.ideias}
        />
      ) : null}

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
        <div>
          <dt className="text-gray-500 uppercase" style={ROTULO}>{L('XP', 'XP')}</dt>
          <dd className="font-mono text-[15px] tabular-nums text-white">{ficha.xp}</dd>
        </div>
        <div>
          <dt className="text-gray-500 uppercase" style={ROTULO}>{L('Cérebro', 'Brain')}</dt>
          <dd className="font-mono text-[15px] tabular-nums text-white">
            {ficha.cerebro.ideias.length}/{ficha.cerebro.espacos}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500 uppercase" style={ROTULO}>{L('OVR de nascimento', 'Birth OVR')}</dt>
          <dd className="font-mono text-[15px] tabular-nums text-white">{ficha.genese.ovr}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10.5px] text-white/35">
        {L('Gênese selada', 'Sealed genesis')} · <span className="font-mono">{ficha.genese_hash.slice(0, 12)}</span>
      </p>
    </section>
  );
}

/**
 * O CÉREBRO na tela. Mostra o que o jogador já sabe (com o efeito e quando
 * vale) e o que o manager pode ensinar. A recusa vem do servidor e aparece como
 * frase, não como código de erro: "ele não topa — não é do temperamento dele"
 * diz mais ao manager do que `nao-topa`.
 */
function Cerebro({ playerId, espacos, sabidas, catalogo }: {
  playerId: string; espacos: number; sabidas: unknown[]; catalogo: IdeiaDoCatalogo[];
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<{ erro: string; detalhe?: string } | null>(null);

  const sabeId = (id: string) => sabidas.some((x) => x === id || (x as { id?: unknown })?.id === id);
  const sabe = catalogo.filter((i) => sabeId(i.id));
  const resto = catalogo.filter((i) => !sabeId(i.id));
  const cheio = sabe.length >= espacos;

  const agir = async (acao: { ensinar: string } | { esquecer: string }, id: string) => {
    setOcupado(id);
    setRecusa(null);
    const r = await mexerNoCerebro(playerId, acao);
    if (r.ok === false) setRecusa({ erro: r.erro, detalhe: r.detalhe });
    setOcupado(null);
  };

  const efeitoEmTexto = (efeito: Record<string, number>) =>
    Object.entries(efeito)
      .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${NOME_DO_ATRIBUTO[k] ?? k}`)
      .join(' · ');

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-gray-500 uppercase" style={ROTULO}>{L('Cérebro', 'Brain')}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-white/50">{sabe.length}/{espacos}</span>
      </div>

      {sabe.length === 0 ? (
        <p className="mt-1 text-[11px] text-white/40">
          {L('Nada ensinado. Toda ideia abaixo é uma escolha sua.', 'Nothing taught yet. Every idea below is your call.')}
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {sabe.map((i) => (
            <li key={i.id} className="border border-neon-yellow/40 bg-neon-yellow/10 px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11.5px] font-semibold text-white">{NOME_DA_IDEIA[i.id] ?? i.id}</span>
                  <span className="ml-1.5 text-[10.5px] text-white/50">
                    {QUANDO_A_IDEIA_VALE[i.id] ?? ''}
                  </span>
                  <div className="font-mono text-[10px] tabular-nums text-neon-yellow">{efeitoEmTexto(i.efeito)}</div>
                </div>
                <button
                  type="button"
                  disabled={ocupado === i.id}
                  onClick={() => void agir({ esquecer: i.id }, i.id)}
                  className="shrink-0 border border-white/20 px-1.5 py-0.5 text-[10px] uppercase text-white/60 disabled:opacity-40"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.14em' }}
                >
                  {L('Esquecer', 'Forget')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {resto.length > 0 && (
        <>
          <p className="mt-2.5 text-gray-500 uppercase" style={ROTULO}>
            {cheio ? L('Cérebro cheio — esqueça uma para ensinar outra', 'Brain full — forget one to teach another') : L('Ensinar', 'Teach')}
          </p>
          <ul className="mt-1.5 space-y-1">
            {resto.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-2 border border-white/10 px-2 py-1.5">
                <div>
                  <span className="text-[11.5px] text-white/85">{NOME_DA_IDEIA[i.id] ?? i.id}</span>
                  <span className="ml-1.5 text-[10.5px] text-white/45">{QUANDO_A_IDEIA_VALE[i.id] ?? ''}</span>
                  <div className="font-mono text-[10px] tabular-nums text-white/55">{efeitoEmTexto(i.efeito)}</div>
                  <div className="text-[10px] text-white/35">
                    {L('Exige', 'Requires')}: {L('nível', 'level')} {i.nivel} · {NOME_DO_EIXO[i.exige.eixo] ?? i.exige.eixo} {i.exige.minimo}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={ocupado === i.id || cheio}
                  onClick={() => void agir({ ensinar: i.id }, i.id)}
                  className="shrink-0 bg-neon-yellow px-2 py-0.5 text-[10px] uppercase text-black disabled:bg-white/10 disabled:text-white/30"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.14em' }}
                >
                  {ocupado === i.id ? L('…', '…') : L('Ensinar', 'Teach')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {recusa && (
        <p className="mt-2 text-[11px] text-danger">
          {RECUSA_DO_JOGADOR[recusa.erro] ?? recusa.erro}
          {recusa.detalhe ? <span className="text-white/40"> ({recusa.detalhe})</span> : null}
        </p>
      )}
    </div>
  );
}
