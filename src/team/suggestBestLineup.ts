/**
 * Sugestão de escalação (GameSpirit OLE): encaixa o elenco nos slots da formação
 * por OVR e posição, com desempates estáveis.
 */

export type LineupSlotUi = { id: string; label: string };

export type SquadPlayerLite = {
  id: string;
  pos: string;
  ovr: number;
  outForMatches: number;
};

/** Posições aceites como “perto” se faltar titular puro (1ª = preferida). */
const FLEX: Record<string, string[]> = {
  GOL: ['GOL'],
  ZAG: ['ZAG', 'LE', 'LD', 'VOL'],
  LE: ['LE', 'ZAG', 'LD'],
  LD: ['LD', 'ZAG', 'LE'],
  VOL: ['VOL', 'MC', 'ZAG'],
  MC: ['MC', 'VOL', 'PE', 'PD'],
  PE: ['PE', 'PD', 'MC', 'ATA'],
  PD: ['PD', 'PE', 'MC', 'ATA'],
  ATA: ['ATA', 'PE', 'PD', 'MC'],
};

function posKey(p: string): string {
  return p.trim().toUpperCase();
}

export function suggestBestLineup(
  slots: LineupSlotUi[],
  squad: SquadPlayerLite[],
): { slotToPlayerId: Record<string, string>; note: string } | { error: string } {
  const eligible = squad.filter((p) => p.outForMatches <= 0);
  if (eligible.length < slots.length) {
    return { error: 'Jogadores em campo ou suspensões: não há 11 disponíveis para sugerir.' };
  }

  const used = new Set<string>();
  const slotToPlayerId: Record<string, string> = {};

  const pickForSlot = (slotLabel: string): string | null => {
    const label = posKey(slotLabel);
    const tiers = FLEX[label] ?? [label];
    for (const want of tiers) {
      const cands = eligible
        .filter((p) => !used.has(p.id) && posKey(p.pos) === want)
        .sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id));
      if (cands[0]) return cands[0].id;
    }
    return null;
  };

  for (const s of slots) {
    const id = pickForSlot(s.label);
    if (id) {
      slotToPlayerId[s.id] = id;
      used.add(id);
    }
  }

  for (const s of slots) {
    if (slotToPlayerId[s.id]) continue;
    const rest = eligible.filter((p) => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id));
    if (!rest[0]) return { error: 'Não foi possível fechar os 11 lugares com o elenco actual.' };
    slotToPlayerId[s.id] = rest[0].id;
    used.add(rest[0].id);
  }

  const starters = Object.values(slotToPlayerId).map((pid) => eligible.find((p) => p.id === pid)!);
  const avg = starters.reduce((a, p) => a + p.ovr, 0) / starters.length;
  const note =
    avg >= 82
      ? 'GameSpirit: onze forte em OVR; confirma no relvado se encaixa no teu plano tático.'
      : avg >= 72
        ? 'GameSpirit: equilíbrio entre posição e força; rever titulares antes de gravar.'
        : 'GameSpirit: prioridade à posição certa; pensa em reforços no mercado.';

  return { slotToPlayerId, note };
}
