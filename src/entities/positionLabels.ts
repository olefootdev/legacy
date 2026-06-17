/** Labels PT-BR das posições. Centraliza o que estava espalhado pelos painéis. */
export const POSITION_LABELS_PT: Record<string, string> = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LE: 'Lateral Esquerdo',
  LD: 'Lateral Direito',
  VOL: 'Volante',
  MC: 'Meia Central',
  MEI: 'Meia Atacante',
  PE: 'Ponta Esquerda',
  PD: 'Ponta Direita',
  ATA: 'Atacante',
};

/** Posições oferecidas na criação por sorteio (gacha). */
export const GACHA_POSITIONS = ['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'PE', 'PD', 'ATA'] as const;

export function positionLabelPt(pos: string): string {
  return POSITION_LABELS_PT[pos.toUpperCase()] ?? pos;
}
