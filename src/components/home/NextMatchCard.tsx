/**
 * NextMatchCard — módulo "Próxima Partida" do layout v3.
 *
 * Card do confronto da próxima rodada da Liga Global: brasão do time do coração
 * de cada clube, contagem regressiva ao vivo (só números) sobre "RODADA GLOBAL",
 * selo Nemesis na revanche e um CTA central "Ver Liga". Dados por props — Home
 * liga em useNextGlobalFixture + state.ligaOleNemesis.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Shield } from 'lucide-react';

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${p(h)}:${p(m)}`;
  return `${p(h)}:${p(m)}:${p(ss)}`;
}

/** Brasão do clube — usa o time do coração; sem escudo (ou img quebrada), cai num shield neutro. */
function ClubCrest({ name, crestUrl }: { name: string; crestUrl: string | null }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [crestUrl]);
  const showImg = !!crestUrl && !broken;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <span
        className="grid h-9 w-9 place-items-center overflow-hidden bg-black/40"
        style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
      >
        {showImg ? (
          <img
            src={crestUrl!}
            alt=""
            aria-hidden
            className="h-full w-full object-contain"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <Shield className="h-4 w-4 text-white/40" aria-hidden />
        )}
      </span>
      <span className="max-w-full truncate font-impact uppercase text-white" style={{ fontSize: '11px' }}>
        {name}
      </span>
    </div>
  );
}

export function NextMatchCard({
  clubName,
  opponentName,
  kickoffMs,
  isLive,
  isNemesis,
  myCrestUrl,
  opponentCrestUrl,
}: {
  clubName: string;
  opponentName: string | null;
  /** Timestamp do kickoff — vira contagem regressiva ao vivo. */
  kickoffMs: number | null;
  isLive: boolean;
  isNemesis: boolean;
  /** Brasão do time do coração do meu clube. */
  myCrestUrl: string | null;
  /** Brasão do time do coração do adversário; null = shield neutro. */
  opponentCrestUrl?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (kickoffMs == null || isLive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [kickoffMs, isLive]);

  const remaining = kickoffMs != null ? kickoffMs - now : null;
  const live = isLive || (remaining != null && remaining <= 0);
  const countdown = live ? 'AO VIVO' : remaining != null ? fmtCountdown(remaining) : '—';

  const verLigaCta = (
    <Link
      to="/competicao/standings"
      className="inline-flex min-h-[44px] items-center gap-1.5 border border-neon-yellow/40 bg-neon-yellow/[0.08] px-6 py-2.5 font-display font-black uppercase text-neon-yellow transition-colors hover:bg-neon-yellow/[0.16]"
      style={{ fontSize: '10px', letterSpacing: '0.18em', borderRadius: 'var(--radius-sm)' }}
    >
      Ver Liga
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );

  return (
    <section
      aria-label="Próxima partida"
      className="border border-[var(--color-border)] bg-dark-gray p-4"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center justify-between">
        <span
          className="font-display font-black uppercase text-white/45"
          style={{ fontSize: '9px', letterSpacing: '0.2em' }}
        >
          Próxima partida
        </span>
        {opponentName ? (
          <span
            className="inline-flex items-center gap-1.5 font-display font-black uppercase"
            style={{ fontSize: '8px', letterSpacing: '0.12em', color: live ? 'var(--color-danger)' : 'var(--color-text-soft)' }}
          >
            {live && <i aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-danger)' }} />}
            {live ? 'Ao vivo' : 'Começa em'}
          </span>
        ) : null}
      </div>

      {opponentName ? (
        <>
          <div className="mt-3 flex items-center justify-between gap-2">
            <ClubCrest name={clubName} crestUrl={myCrestUrl} />
            <div className="shrink-0 text-center">
              <span
                className="block font-impact tabular-nums text-white"
                style={{ fontSize: live ? '20px' : '26px', lineHeight: 0.9 }}
              >
                {countdown}
              </span>
              <span
                className="mt-1 block font-display font-black uppercase text-neon-yellow/70"
                style={{ fontSize: '8px', letterSpacing: '0.16em' }}
              >
                Rodada Global
              </span>
            </div>
            {/* Adversário — brasão do coração dele (denormalizado na Liga Global); shield neutro se ausente. */}
            <ClubCrest name={opponentName} crestUrl={opponentCrestUrl ?? null} />
          </div>

          {isNemesis ? (
            <div className="mt-3 flex justify-center">
              <span
                className="inline-flex items-center font-display font-black uppercase"
                style={{
                  fontSize: '8.5px',
                  letterSpacing: '0.12em',
                  color: 'var(--color-danger)',
                  border: '1px solid rgba(255,61,61,0.4)',
                  background: 'rgba(255,61,61,0.08)',
                  padding: '3px 8px',
                  borderRadius: '999px',
                }}
              >
                Nemesis · revanche
              </span>
            </div>
          ) : null}

          <div className="mt-4 flex justify-center">{verLigaCta}</div>
        </>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-3 text-center">
          <p className="text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
            Sem rodada agendada.
          </p>
          {verLigaCta}
        </div>
      )}
    </section>
  );
}
