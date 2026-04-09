import type { GatCategory } from '@/wallet/types';
import type { ClubStructureId } from './types';

/** Mapeia estrutura do clube para categoria GAT (upgrade pago em BRO). */
export function gatCategoryForStructure(id: ClubStructureId): GatCategory {
  if (id === 'stadium') return 'stadium_upgrade';
  if (id === 'training_center') return 'training_facility';
  return 'structure_upgrade';
}
