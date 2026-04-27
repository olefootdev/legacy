/**
 * SmartField — camada dinâmica sobre as zonas estáticas.
 *
 * Objetivos:
 *   1. Raio de atuação EXPANDE quando colega se aproxima (cria espaço).
 *   2. Lateral sobe no flanco quando o portador está na mesma faixa (overlap).
 *   3. Atacante faz corrida profunda pra atrás da zaga quando meio tem a bola
 *      e aponta pra linha — abre alvo pra passe de ruptura.
 *   4. Disciplina preservada: tudo clampeado nas zonas estáticas do snapshot.
 *
 * Todas as funções são puras e operam em coordenadas ENGINE (0–100%).
 * Coordenadas mundo (metros) devem ser convertidas antes por quem chama.
 */

/**
 * Multiplicador de raio por proximidade de companheiros.
 * - Colega a ≤5m: ×1.55 (espaço amplo criado)
 * - Colega a 5–10m: ×1.35
 * - Colega a 10–15m: ×1.15
 * - Sem colega próximo: ×1.0 (raio-base preservado)
 *
 * Escolhe o MAIS PRÓXIMO e aplica escala contínua entre tiers.
 */
export function teammateProximityRadiusMul(
  selfX: number,
  selfZ: number,
  teammates: { playerId: string; x: number; z: number }[],
  selfId?: string,
): number {
  let nearest = Infinity;
  for (const t of teammates) {
    if (t.playerId === selfId) continue;
    const dx = t.x - selfX;
    const dz = t.z - selfZ;
    const d = Math.hypot(dx, dz);
    if (d < nearest) nearest = d;
  }
  if (nearest >= 15) return 1.0;
  if (nearest <= 5) return 1.55;
  // entre 5 e 15: interpolação suave (cubic-ease)
  const t = 1 - (nearest - 5) / 10; // 0..1 (1 quando 5m, 0 quando 15m)
  const eased = t * t * (3 - 2 * t); // smoothstep
  return 1.0 + eased * 0.55;
}

/**
 * Overlap do lateral no flanco quando o portador está no mesmo corredor.
 * Retorna shift (dx, dy) a aplicar no alvo do lateral; (0,0) se não deve subir.
 *
 * Trigger:
 *   - slotId é 'le' ou 'ld'
 *   - hasBall = true (meu time em posse)
 *   - Bola no terço médio ou final
 *   - Portador está na faixa do lateral (±18 em y) ou à frente do lateral
 *
 * Efeito: puxa o lateral +10..18 pra frente em x, e leve pra dentro/fora em y
 * conforme precisa servir o cruzamento. Dosado — não é teletransporte.
 */
export function shouldLateralOverlap(
  slotId: string | undefined,
  role: string,
  selfX: number,
  selfY: number,
  carrier: { x: number; y: number } | null,
  hasBall: boolean,
  ballZone: 'def' | 'mid' | 'att',
  side: 'home' | 'away',
): { dx: number; dy: number; run01: number } {
  if (!hasBall || !carrier) return { dx: 0, dy: 0, run01: 0 };
  if (role !== 'def') return { dx: 0, dy: 0, run01: 0 };
  if (slotId !== 'le' && slotId !== 'ld') return { dx: 0, dy: 0, run01: 0 };
  if (ballZone === 'def') return { dx: 0, dy: 0, run01: 0 };

  const isLeft = slotId === 'le';
  // Corredor do lateral: le < y=35, ld > y=65 (aprox)
  const inFlank = isLeft ? carrier.y < 42 : carrier.y > 58;
  // Portador já à frente do lateral = hora de passar por ele (overlap puro)
  const carrierAhead = side === 'home' ? carrier.x > selfX + 6 : carrier.x < selfX - 6;

  if (!inFlank && !carrierAhead) return { dx: 0, dy: 0, run01: 0 };

  const urgency =
    ballZone === 'att' ? 1.0 : 0.55; // terço final empurra mais
  const dirX = side === 'home' ? 1 : -1;
  const dx = (carrierAhead ? 14 : 9) * urgency * dirX;
  // Aproxima da linha de fundo sem colar — cria ângulo pra cruzamento.
  const targetLateralY = isLeft ? 12 : 88;
  const dy = (targetLateralY - selfY) * 0.10 * urgency;

  return { dx, dy, run01: urgency };
}

/**
 * Corrida profunda do atacante "atrás da zaga" — espaço criado pra passe em profundidade.
 * Retorna shift (dx, dy) quando o atacante deve atacar a linha dos zagueiros.
 *
 * Trigger:
 *   - role = 'attack'
 *   - Meu time em posse
 *   - Portador é um meio (role = 'mid') e está próximo do terço final
 *   - Atacante está em zona ofensiva mas ainda não ultrapassou a última linha
 *
 * Efeito: puxa o atacante +8..14 em x (pra linha dos zagueiros). Se o atacante
 * já está profundo, shift é 0. Assim ele "quebra a linha" em oportunidades reais.
 */
/**
 * Atacante (slot ATA) invade a grande área em ataque.
 * Puxa FORTE pro ponto de pênalti do adversário quando o time tem posse na zona att.
 *
 * Sem isso, o atacante fica parado na entrada da grande área — mesmo com box-raid-boost
 * individual, o pull "pra bola" não é suficiente porque a bola pode estar no flanco.
 * Aqui a referência é o GOL, não a bola.
 */
export function shouldRushOppBox(
  role: string,
  slotId: string | undefined,
  selfX: number,
  selfY: number,
  hasBall: boolean,
  ballZone: 'def' | 'mid' | 'att',
  side: 'home' | 'away',
): { dx: number; dy: number } {
  if (!hasBall) return { dx: 0, dy: 0 };
  if (role !== 'attack' || slotId !== 'ata') return { dx: 0, dy: 0 };
  if (ballZone !== 'att') return { dx: 0, dy: 0 };

  // Ponto de pênalti do adversário (em engine units ~11m = x≈10.5 ou 89.5; y=50).
  const targetX = side === 'home' ? 89 : 11;
  const targetY = 50;

  const dx = (targetX - selfX) * 0.35;
  const dy = (targetY - selfY) * 0.25;
  return { dx, dy };
}

export function shouldRunBehindDefense(
  role: string,
  selfX: number,
  carrier: { x: number; y: number; role?: string } | null,
  hasBall: boolean,
  ballZone: 'def' | 'mid' | 'att',
  side: 'home' | 'away',
): { dx: number; dy: number } {
  if (!hasBall || !carrier) return { dx: 0, dy: 0 };
  if (role !== 'attack') return { dx: 0, dy: 0 };
  if (ballZone === 'def') return { dx: 0, dy: 0 };
  if (carrier.role !== 'mid') return { dx: 0, dy: 0 };

  // Atacante já bem profundo: não quebra mais a linha.
  const deepX = side === 'home' ? 92 : 8;
  const gap = side === 'home' ? deepX - selfX : selfX - deepX;
  if (gap < 4) return { dx: 0, dy: 0 };

  // Shift proporcional ao gap restante (até 14 unidades).
  const dirX = side === 'home' ? 1 : -1;
  const dx = Math.min(14, gap * 0.55) * dirX;
  return { dx, dy: 0 };
}
