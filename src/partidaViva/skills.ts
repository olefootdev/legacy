/**
 * PARTIDA VIVA — skills com nome (Fase 10).
 *
 * O motor (server/smartfield/cadeia_lances.py, `nomear_skills`) marca a ação
 * com o CÓDIGO da skill só quando o jogador tem atributo pra ela — e manda a
 * nota que justifica. Aqui só o nome no idioma do jogo e o atributo por trás.
 * Mostrado no trilho, nunca por cima do campo.
 */
import { L } from '@/i18n/L';

interface Nome { nome: string; atributo: string }

const DRIBLE = L('drible', 'dribbling'), PASSE = L('passe', 'passing'), FIN = L('finalização', 'finishing');
const CAB = L('cabeceio', 'heading'), BOLA = L('bola parada', 'set pieces');

export const SKILLS: Record<string, Nome> = {
  arrancada: { nome: L('Arrancada', 'Burst of pace'), atributo: DRIBLE },
  elastico: { nome: L('Elástico', 'Elastico'), atributo: DRIBLE },
  caneta: { nome: L('Caneta', 'Nutmeg'), atributo: DRIBLE },
  chapeu: { nome: L('Chapéu', 'Rainbow flick'), atributo: DRIBLE },
  corte_seco: { nome: L('Corte seco', 'Sharp cut'), atributo: DRIBLE },
  disparada: { nome: L('Disparada', 'Sprint'), atributo: L('velocidade', 'pace') },
  passe_milimetrico: { nome: L('Passe milimétrico', 'Pinpoint pass'), atributo: PASSE },
  lancamento_longo: { nome: L('Lançamento de 40 metros', '40-yard ball'), atributo: PASSE },
  enfiada: { nome: L('Enfiada', 'Through ball'), atributo: PASSE },
  cruzamento_medida: { nome: L('Cruzamento na medida', 'Pinpoint cross'), atributo: L('cruzamento', 'crossing') },
  bomba: { nome: L('Bomba de fora', 'Thunderbolt'), atributo: FIN },
  cavadinha: { nome: L('Cavadinha', 'Chip'), atributo: FIN },
  de_primeira: { nome: L('De primeira', 'First-time finish'), atributo: FIN },
  chute_colocado: { nome: L('Chute colocado', 'Placed finish'), atributo: FIN },
  cabecada_contrape: { nome: L('Cabeçada no contrapé', 'Glancing header'), atributo: CAB },
  testada: { nome: L('Testada firme', 'Bullet header'), atributo: L('físico', 'strength') },
  desarme_limpo: { nome: L('Desarme limpo', 'Clean tackle'), atributo: L('marcação', 'marking') },
  cobranca_perfeita: { nome: L('Cobrança na medida', 'Perfect delivery'), atributo: BOLA },
  cobranca_fria: { nome: L('Frieza na cobrança', 'Ice-cold penalty'), atributo: L('pênalti', 'penalties') },
};

/** Skill que acabou de acontecer (o trilho mostra por alguns segundos). */
export interface SkillEmCampo { codigo: string; nota: number; jogador: string; lado: 'home' | 'away'; id: number }

export function nomeDaSkill(codigo: string): Nome | null {
  return SKILLS[codigo] ?? null;
}
