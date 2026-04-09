import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { AdminLeagueConfig, KnockoutBracketSize, LeagueFormat, LeagueStandingRow } from '@/match/adminLeagues';
import {
  generateKnockoutRounds,
  KNOCKOUT_BRACKET_SIZES,
  LEAGUE_FORMAT_LABELS,
  newLeagueId,
  newTeamId,
  sortStandings,
} from '@/match/adminLeagues';
import { cn } from '@/lib/utils';

function makeStandings(teamCount: number, clubName: string): LeagueStandingRow[] {
  const n = Math.max(2, Math.min(256, Math.floor(teamCount)));
  const rows: LeagueStandingRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      teamId: newTeamId(),
      name: i === 0 ? clubName : `Equipa ${i + 1}`,
      played: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    });
  }
  return rows;
}

export function AdminNewLeagueModal({
  open,
  onClose,
  clubName,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  clubName: string;
  onCreate: (league: AdminLeagueConfig) => void;
}) {
  const [name, setName] = useState('Nova competição');
  const [division, setDivision] = useState('1ª fase');
  const [format, setFormat] = useState<LeagueFormat>('round_robin');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [prizeSummary, setPrizeSummary] = useState('');
  const [hybridQualificationEndDate, setHybridQualificationEndDate] = useState('');
  const [knockoutStartDate, setKnockoutStartDate] = useState('');
  const [teamCount, setTeamCount] = useState(8);
  const [bracketSize, setBracketSize] = useState<KnockoutBracketSize>(8);
  const [drawKnockoutOnCreate, setDrawKnockoutOnCreate] = useState(true);
  const [syncStatsFromSeason, setSyncStatsFromSeason] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('Nova competição');
    setDivision('1ª fase');
    setFormat('round_robin');
    setStartDate('');
    setEndDate('');
    setPrizeSummary('');
    setHybridQualificationEndDate('');
    setKnockoutStartDate('');
    setTeamCount(8);
    setBracketSize(8);
    setDrawKnockoutOnCreate(true);
    setSyncStatsFromSeason(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setBracketSize((prev) => {
      const need = (KNOCKOUT_BRACKET_SIZES.find((s) => s >= teamCount) ?? 256) as KnockoutBracketSize;
      return prev < need ? need : prev;
    });
  }, [teamCount, open]);

  const previewBracket = useMemo(() => {
    if (format === 'round_robin' || !drawKnockoutOnCreate) return null;
    const standings = makeStandings(teamCount, clubName);
    try {
      return generateKnockoutRounds(sortStandings(standings), bracketSize);
    } catch {
      return null;
    }
  }, [format, drawKnockoutOnCreate, teamCount, clubName, bracketSize]);

  if (!open) return null;

  const submit = () => {
    const standings = makeStandings(teamCount, clubName);
    const sorted = sortStandings(standings);
    const id = newLeagueId();
    const base: AdminLeagueConfig = {
      id,
      name: name.trim() || 'Sem nome',
      division: division.trim() || '—',
      syncStatsFromSeason,
      form: ['W', 'D'],
      standings,
      format,
      startDate,
      endDate,
      prizeSummary: prizeSummary.trim(),
      hybridQualificationEndDate: format === 'hybrid' ? hybridQualificationEndDate || undefined : undefined,
      knockoutStartDate:
        format === 'knockout' || format === 'hybrid' ? knockoutStartDate || undefined : undefined,
      knockoutBracketSize: format === 'knockout' || format === 'hybrid' ? bracketSize : undefined,
      knockoutRounds:
        (format === 'knockout' || format === 'hybrid') && drawKnockoutOnCreate
          ? generateKnockoutRounds(sorted, bracketSize)
          : undefined,
    };
    onCreate(base);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-h-[min(92vh,900px)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0d0d0d] p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-black uppercase tracking-wide text-white">Nova liga</h3>
            <p className="mt-1 text-xs text-white/45">
              Nome, período, formato, prémios e chaveamento. Podes refinar tudo depois no painel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
            Divisão / fase
            <input
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Formato</p>
            <div className="flex flex-col gap-2">
              {(['round_robin', 'knockout', 'hybrid'] as const).map((f) => (
                <label
                  key={f}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                    format === f ? 'border-neon-yellow/50 bg-neon-yellow/10 text-white' : 'border-white/10 text-white/70',
                  )}
                >
                  <input
                    type="radio"
                    name="lg-format"
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="border-white/30"
                  />
                  {LEAGUE_FORMAT_LABELS[f]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
              Início
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
              Fim
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
            Prémios / notas
            <textarea
              value={prizeSummary}
              onChange={(e) => setPrizeSummary(e.target.value)}
              rows={2}
              placeholder="Ex.: Taça + OLE ao campeão"
              className="mt-1 w-full resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25"
            />
          </label>

          {format === 'hybrid' ? (
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
              Fim da fase de qualificação (tabela)
              <input
                type="date"
                value={hybridQualificationEndDate}
                onChange={(e) => setHybridQualificationEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
          ) : null}

          {(format === 'knockout' || format === 'hybrid') && (
            <>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                Início do mata-mata (opcional)
                <input
                  type="date"
                  value={knockoutStartDate}
                  onChange={(e) => setKnockoutStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                Nº de equipas inscritas (linhas na tabela)
                <input
                  type="number"
                  min={2}
                  max={256}
                  value={teamCount}
                  onChange={(e) => setTeamCount(Number(e.target.value) || 2)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                Tamanho do bracket
                <select
                  value={bracketSize}
                  onChange={(e) => setBracketSize(Number(e.target.value) as KnockoutBracketSize)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  {KNOCKOUT_BRACKET_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} equipas
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={drawKnockoutOnCreate}
                  onChange={(e) => setDrawKnockoutOnCreate(e.target.checked)}
                  className="rounded border-white/30"
                />
                Sortear chaves ao criar (1.ª ronda aleatória; rondas seguintes com placeholders)
              </label>
            </>
          )}

          {format === 'round_robin' && (
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
              Nº de equipas na tabela
              <input
                type="number"
                min={2}
                max={64}
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value) || 2)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={syncStatsFromSeason}
              onChange={(e) => setSyncStatsFromSeason(e.target.checked)}
              className="rounded border-white/30"
            />
            Sincronizar linha do clube com a temporada (leagueSeason)
          </label>

          {previewBracket && previewBracket.length > 0 ? (
            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase text-white/40">Pré-visualização do sorteio</p>
              <p className="text-[10px] text-white/35">
                {previewBracket[0]!.pairs.length} jogos na 1.ª ronda · recria ao guardar se activares o sorteio.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-neon-yellow px-4 py-2.5 font-display text-xs font-black uppercase text-black hover:bg-white"
          >
            Criar liga
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 px-4 py-2.5 text-xs font-bold uppercase text-white/60 hover:bg-white/10"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
