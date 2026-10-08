/**
 * PvpStandings — Liga Rápida e Liga Clássica.
 *
 * Tabela agregada de todos os managers que jogaram Quick/Classic. Pontos
 * conta 3 por vitória, 1 por empate. Crítica de desempate: saldo de gols,
 * depois gols pró.
 */
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Zap, Target } from 'lucide-react';
import { fetchPvpStandings, type PvpStandingRow, type PvpMatchMode } from '@/supabase/pvpMatches';
import { localCrestUrl } from '@/settings/crestUrl';
import { cn } from '@/lib/utils';
import { BackButton } from '@/components/BackButton';
import { SecaoRua } from '@/components/ui/Rua';
import { AbasRua, CabecalhoRua, FaltaRua, VazioRua, posRua } from '@/components/leagues/RuaTabela';
import { useGameStore } from '@/game/store';
import { L, LOCALE } from '@/i18n/L';

const MODE_LABEL: Record<PvpMatchMode, string> = {
  quick: L('Liga Rápida', 'Quick League'),
  classic: L('Liga Clássica', 'Classic League'),
};

export function PvpStandings() {
  const [mode, setMode] = useState<PvpMatchMode>('quick');
  const myClubName = useGameStore((s) => s.club?.name);
  const [rows, setRows] = useState<PvpStandingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const data = await fetchPvpStandings(mode, 100);
      if (cancelled) return;
      setRows(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const myIdx = rows.findIndex((r) => !!r.clubName && r.clubName === myClubName);
  const me = myIdx >= 0 ? rows[myIdx] : null;
  const above = myIdx > 0 ? rows[myIdx - 1] : null;
  const gapAbove = me && above ? Math.max(0, above.points - me.points) : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-8 overflow-x-hidden px-3 py-6 sm:px-4">
      <BackButton to="/competicao" label={L('Competição', 'Competition')} />

      <CabecalhoRua
        rotulo={L('#pvp · classificação', '#pvp · standings')}
        titulo={MODE_LABEL[mode]}
        voz={L('Vitória vale 3. Respeito vale mais.', 'A win is worth 3. Respect is worth more.')}
      />

      <AbasRua
        ariaLabel={L('Modo', 'Mode')}
        ativa={mode}
        onChange={setMode}
        abas={(['quick', 'classic'] as PvpMatchMode[]).map((m) => {
          const Icon = m === 'quick' ? Zap : Target;
          return {
            id: m,
            label: (
              <span className="inline-flex items-center gap-2">
                <Icon aria-hidden className="h-4 w-4" />
                {MODE_LABEL[m]}
              </span>
            ),
          };
        })}
      />

      {loading ? (
        <div className="border-2 border-dashed border-fio p-6">
          <p className="font-prova text-[12px] uppercase tracking-[0.14em] text-mudo">{L('Carregando classificação…', 'Loading standings…')}</p>
        </div>
      ) : rows.length === 0 ? (
        <VazioRua titulo={L('Tabela em branco', 'Blank table')} frase={L('Nenhuma partida nesta liga ainda. A primeira é tua.', 'No matches in this league yet. The first one is yours.')} />
      ) : (
        <>
          {me && (
            <div className="flex flex-col gap-1">
              {gapAbove != null ? (
                <FaltaRua
                  valor={gapAbove}
                  unidade={L('pts', 'pts')}
                  frase={L(`é o que separa tu do ${posRua(above!.rank)}.`, `is all that's between you and ${posRua(above!.rank)}.`)}
                />
              ) : (
                <span className="font-spray font-black uppercase leading-[0.85] text-ouro-27" style={{ fontSize: 'clamp(56px, 16vw, 96px)' }}>
                  {L('Topo', 'Top')}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <SecaoRua label={L('Classificação', 'Standings')} aside={`${rows.length} managers`} />
            {/* Linhas em concreto; V-E-D e saldo descem pra linha mono — cabe em 320px sem rolar. */}
            <div className="flex flex-col gap-1.5">
              {rows.map((row, idx) => {
                const isMe = !!row.clubName && row.clubName === myClubName;
                const leader = row.rank === 1;
                const below = myIdx >= 0 && idx > myIdx;
                const gd = `${row.goalDiff > 0 ? '+' : ''}${row.goalDiff}`;
                const crest = row.favoriteTeamId ? (
                  <img src={localCrestUrl(row.favoriteTeamId)} alt="" className="h-8 w-8 shrink-0 object-contain" loading="lazy" />
                ) : (
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center font-prova text-[9px] font-bold',
                      isMe ? 'bg-asfalto-27 text-rua' : 'bg-asfalto-27 text-mudo',
                    )}
                  >
                    {(row.clubShort ?? '—').slice(0, 3)}
                  </span>
                );
                const sub = `${row.displayName ?? '—'} · ${L('J', 'P')}${row.played} ${L('V', 'W')}${row.wins} ${L('E', 'D')}${row.draws} ${L('D', 'L')}${row.losses} · ${L('SG', 'GD')} ${gd}`;
                const nome = row.clubName ?? row.displayName ?? 'Manager';
                if (isMe) {
                  return (
                    <div
                      key={row.userId}
                      className="relative z-[1] my-1 flex min-h-[64px] min-w-0 -rotate-1 items-center gap-3 bg-rua px-4 py-2 text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)]"
                    >
                      <span className="w-12 shrink-0 font-impact text-[24px] leading-none">{posRua(row.rank)}</span>
                      {crest}
                      <span className="flex min-w-0 grow flex-col gap-1">
                        <span className="truncate font-impact text-[22px] uppercase leading-none">{nome}</span>
                        <span className="truncate font-prova text-[10px] font-bold uppercase tracking-[0.1em] text-asfalto-27/70">{sub}</span>
                      </span>
                      <span className="shrink-0 font-impact text-[28px] leading-none">{row.points.toLocaleString(LOCALE)}</span>
                    </div>
                  );
                }
                return (
                  <motion.div
                    key={row.userId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(0.02 * idx, 0.4) }}
                    className={cn(
                      'flex min-h-[56px] min-w-0 items-center gap-3 px-4 py-2',
                      leader ? 'border-2 border-ouro-27 text-ouro-27' : 'bg-concreto',
                      !leader && (below ? 'text-mudo' : 'text-papel'),
                    )}
                  >
                    <span className={cn('w-12 shrink-0 font-impact text-[20px] leading-none', !leader && row.rank <= 3 && 'text-rua')}>{posRua(row.rank)}</span>
                    {crest}
                    <span className="flex min-w-0 grow flex-col gap-1">
                      <span className="truncate font-impact text-[19px] uppercase leading-none">{nome}</span>
                      <span className={cn('truncate font-prova text-[10px] font-bold uppercase tracking-[0.1em]', leader ? 'text-ouro-27/80' : 'text-mudo')}>{sub}</span>
                    </span>
                    <span className="shrink-0 font-impact text-[21px] leading-none">{row.points.toLocaleString(LOCALE)}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <p className="pt-2 font-prova text-[10.5px] uppercase tracking-[0.12em] text-mudo">
        {L('Vitória 3 · empate 1 · derrota 0 · desempate: saldo, depois gols pró', 'Win 3 · draw 1 · loss 0 · tiebreak: goal difference, then goals for')}
      </p>
    </div>
  );
}
