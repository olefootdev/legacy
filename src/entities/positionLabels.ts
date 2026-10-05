/** Labels PT-BR das posições. Centraliza o que estava espalhado pelos painéis. */
import { L } from '@/i18n/L';
export const POSITION_LABELS_PT: Record<string, string> = {
  GOL: L('Goleiro', 'Goalkeeper'),
  ZAG: L('Zagueiro', 'Centre-back'),
  LE: L('Lateral Esquerdo', 'Left-back'),
  LD: L('Lateral Direito', 'Right-back'),
  VOL: L('Volante', 'Defensive Midfielder'),
  MC: L('Meia Central', 'Central Midfielder'),
  MEI: L('Meia Atacante', 'Attacking Midfielder'),
  PE: L('Ponta Esquerda', 'Left Winger'),
  PD: L('Ponta Direita', 'Right Winger'),
  ATA: L('Atacante', 'Striker'),
};

/** Posições oferecidas na criação por sorteio (gacha). */
export const GACHA_POSITIONS = ['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'PE', 'PD', 'ATA'] as const;

export function positionLabelPt(pos: string): string {
  return POSITION_LABELS_PT[pos.toUpperCase()] ?? pos;
}
