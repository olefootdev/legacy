/**
 * Rótulo de TELA da posição — um só, pro jogo inteiro. O valor ('ZAG', 'ATA'…)
 * continua o mesmo no código, no banco e nas comparações; só o que a pessoa lê
 * muda de idioma.
 */
import { emIngles } from './L';

const POS_EN: Record<string, string> = {
  GOL: 'GK', GK: 'GK',
  ZAG: 'CB', ZC: 'CB',
  LAT: 'FB', LD: 'RB', LE: 'LB', ALA: 'WB',
  VOL: 'DM',
  MEI: 'AM', MC: 'CM', MD: 'RM', ME: 'LM',
  PE: 'LW', PD: 'RW',
  ATA: 'ST', CA: 'ST', SA: 'SS',
};

export function posLabel(pos: string | null | undefined): string {
  if (!pos) return '';
  if (!emIngles()) return pos;
  return POS_EN[pos.toUpperCase()] ?? pos;
}
