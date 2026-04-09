import { useEffect, useState } from 'react';
import { Gift, Inbox, UserPlus, UserCheck, RotateCcw, Copy, Skull } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { getGameState } from '@/game/store';
import { formatBroFromCents, formatExp } from '@/systems/economy';

function parseBroToCents(s: string): number | null {
  const t = s.replace(',', '.').trim();
  if (!t) return 0;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export function AdminUserPanel() {
  const dispatch = useGameDispatch();
  const club = useGameStore((s) => s.club);
  const leagueSeason = useGameStore((s) => s.leagueSeason);
  const form = useGameStore((s) => s.form);
  const oleBal = useGameStore((s) => s.finance.ole);
  const broBal = useGameStore((s) => s.finance.broCents);

  const [clubName, setClubName] = useState(club.name);
  const [clubShort, setClubShort] = useState(club.shortName);
  const [city, setCity] = useState(club.city);

  const [earnedExp, setEarnedExp] = useState('');
  const [oleDelta, setOleDelta] = useState('');
  const [broGame, setBroGame] = useState('');
  const [broSpot, setBroSpot] = useState('');

  const [seasonPlayed, setSeasonPlayed] = useState(String(leagueSeason.played));
  const [seasonPts, setSeasonPts] = useState(String(leagueSeason.points));
  const [seasonGf, setSeasonGf] = useState(String(leagueSeason.goalsFor));
  const [seasonGa, setSeasonGa] = useState(String(leagueSeason.goalsAgainst));

  const [formStr, setFormStr] = useState(form.join(''));

  const [inboxTitle, setInboxTitle] = useState('Comunicado Admin');
  const [inboxBody, setInboxBody] = useState('');
  const [inboxLink, setInboxLink] = useState('/');

  const [mgrId, setMgrId] = useState('mgr_demo');
  const [mgrClub, setMgrClub] = useState('DEMO FC');

  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    setClubName(club.name);
    setClubShort(club.shortName);
    setCity(club.city);
  }, [club.name, club.shortName, club.city]);

  useEffect(() => {
    setSeasonPlayed(String(leagueSeason.played));
    setSeasonPts(String(leagueSeason.points));
    setSeasonGf(String(leagueSeason.goalsFor));
    setSeasonGa(String(leagueSeason.goalsAgainst));
  }, [leagueSeason.played, leagueSeason.points, leagueSeason.goalsFor, leagueSeason.goalsAgainst]);

  useEffect(() => {
    setFormStr(form.join(''));
  }, [form]);

  const applyIdentity = () => {
    dispatch({
      type: 'ADMIN_PATCH_CLUB',
      partial: {
        name: clubName.trim() || club.name,
        shortName: clubShort.trim().slice(0, 8).toUpperCase() || club.shortName,
        city: city.trim() || club.city,
      },
    });
  };

  const applyEconomy = () => {
    const ee = earnedExp.trim() ? Number(earnedExp) : 0;
    const od = oleDelta.trim() ? Number(oleDelta) : 0;
    const bg = broGame.trim() ? parseBroToCents(broGame) : 0;
    const bs = broSpot.trim() ? parseBroToCents(broSpot) : 0;
    if (bg === null || bs === null) {
      alert('BRO inválido. Usa formato como 10 ou 10,50');
      return;
    }
    dispatch({
      type: 'ADMIN_GRANT_RESOURCES',
      earnedExp: ee || undefined,
      oleDelta: od || undefined,
      broCentsDelta: bg || undefined,
      spotBroCentsDelta: bs || undefined,
    });
    setEarnedExp('');
    setOleDelta('');
    setBroGame('');
    setBroSpot('');
  };

  const applySeason = () => {
    dispatch({
      type: 'ADMIN_SET_LEAGUE_SEASON',
      partial: {
        played: Math.max(0, Number(seasonPlayed) || 0),
        points: Math.max(0, Number(seasonPts) || 0),
        goalsFor: Math.max(0, Number(seasonGf) || 0),
        goalsAgainst: Math.max(0, Number(seasonGa) || 0),
      },
    });
  };

  const applyForm = () => {
    const letters = formStr
      .toUpperCase()
      .split('')
      .filter((c) => c === 'W' || c === 'D' || c === 'L') as ('W' | 'D' | 'L')[];
    if (letters.length === 0) {
      alert('Indica apenas W, D ou L (ex.: WWDLW).');
      return;
    }
    dispatch({ type: 'ADMIN_SET_FORM', form: letters });
  };

  const copyState = () => {
    void navigator.clipboard.writeText(JSON.stringify(getGameState(), null, 2));
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/55">
        O cliente tem um único save local — aqui simulas ações de <strong className="text-white/80">operador</strong>{' '}
        (créditos, identidade, temporada, social). Tudo persiste no mesmo estado que o jogo usa.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
            <UserCheck className="h-4 w-4" />
            Identidade do clube
          </h3>
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase text-white/40">
              Nome completo
              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-[10px] font-bold uppercase text-white/40">
              Sigla (max 8)
              <input
                value={clubShort}
                onChange={(e) => setClubShort(e.target.value)}
                maxLength={8}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-[10px] font-bold uppercase text-white/40">
              Cidade
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <button
              type="button"
              onClick={applyIdentity}
              className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-white/20"
            >
              Aplicar identidade
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
            <Gift className="h-4 w-4" />
            Economia
          </h3>
          <p className="mb-2 text-[10px] text-white/35">
            Saldo atual: {formatExp(oleBal)} EXP · {formatBroFromCents(broBal)} BRO jogo
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[10px] font-bold uppercase text-white/40">
              EXP ganho (lifetime + saldo)
              <input
                value={earnedExp}
                onChange={(e) => setEarnedExp(e.target.value)}
                placeholder="ex: 500"
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-white/40">
              Ajuste EXP (só saldo)
              <input
                value={oleDelta}
                onChange={(e) => setOleDelta(e.target.value)}
                placeholder="ex: -100"
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-white/40">
              BRO jogo (Δ)
              <input
                value={broGame}
                onChange={(e) => setBroGame(e.target.value)}
                placeholder="ex: 25 ou -10,5"
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-white/40">
              BRO SPOT wallet (Δ)
              <input
                value={broSpot}
                onChange={(e) => setBroSpot(e.target.value)}
                placeholder="ex: 100"
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={applyEconomy}
            className="mt-3 rounded-lg bg-emerald-600/80 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-emerald-500"
          >
            Aplicar economia
          </button>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
            Temporada (leagueSeason)
          </h3>
          <p className="mb-2 text-[10px] text-white/35">
            Usado pela liga principal quando a sincronização está activa.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Jogos', seasonPlayed, setSeasonPlayed],
              ['Pontos', seasonPts, setSeasonPts],
              ['GF', seasonGf, setSeasonGf],
              ['GA', seasonGa, setSeasonGa],
            ].map(([label, val, set]) => (
              <label key={String(label)} className="text-[10px] font-bold uppercase text-white/40">
                {label}
                <input
                  value={val as string}
                  onChange={(e) => (set as (s: string) => void)(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-white"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={applySeason}
            className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-white/20"
          >
            Aplicar temporada
          </button>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
            Forma (W / D / L)
          </h3>
          <input
            value={formStr}
            onChange={(e) => setFormStr(e.target.value)}
            placeholder="WWDLW"
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm uppercase text-white"
          />
          <button
            type="button"
            onClick={applyForm}
            className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-white/20"
          >
            Aplicar forma
          </button>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
            <Inbox className="h-4 w-4" />
            Inbox & social
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-white/40">
                Título
                <input
                  value={inboxTitle}
                  onChange={(e) => setInboxTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-[10px] font-bold uppercase text-white/40">
                Corpo
                <textarea
                  value={inboxBody}
                  onChange={(e) => setInboxBody(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-[10px] font-bold uppercase text-white/40">
                Deep link
                <input
                  value={inboxLink}
                  onChange={(e) => setInboxLink(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'ADMIN_POST_INBOX',
                    title: inboxTitle.trim() || 'Admin',
                    body: inboxBody.trim() || undefined,
                    deepLink: inboxLink.trim() || undefined,
                  })
                }
                className="rounded-lg bg-amber-600/80 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-amber-500"
              >
                Enviar notificação
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-white/40">
                Manager ID
                <input
                  value={mgrId}
                  onChange={(e) => setMgrId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white"
                />
              </label>
              <label className="text-[10px] font-bold uppercase text-white/40">
                Clube (nome)
                <input
                  value={mgrClub}
                  onChange={(e) => setMgrClub(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'ADMIN_SIMULATE_FRIEND_REQUEST', managerId: mgrId.trim(), clubName: mgrClub.trim() })
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-white/10"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Simular pedido
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'ADMIN_ADD_FRIEND', managerId: mgrId.trim(), clubName: mgrClub.trim() })
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-neon-yellow/40 px-3 py-2 text-xs font-bold uppercase text-neon-yellow hover:bg-neon-yellow/10"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Adicionar amigo
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-red-300/90">
            <Skull className="h-4 w-4" />
            Operações
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'WORLD_CATCH_UP', nowMs: Date.now() })}
              className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              World catch-up
            </button>
            <button
              type="button"
              onClick={copyState}
              className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-white/10"
            >
              <Copy className="h-4 w-4" />
              Copiar JSON
            </button>
            {!resetOpen ? (
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase text-red-200 hover:bg-red-500/20"
              >
                Reset save
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'RESET' });
                    setResetOpen(false);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white"
                >
                  Confirmar reset
                </button>
                <button
                  type="button"
                  onClick={() => setResetOpen(false)}
                  className="text-xs text-white/50 hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
