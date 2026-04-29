import type { GenesisMarketPlayerRow } from '@/supabase/genesisMarket';

/**
 * Pool de emergência — 28 jogadores mock distribuídos pelas 4 raridades
 * com goleiros suficientes. SÓ é usado se o Supabase devolver pool insuficiente
 * (admin ainda não habilitou jogadores listados).
 *
 * Não persiste em prod — esses jogadores entram no plantel local mas não
 * existem no `genesis_market_players`. Por isso, ao final, o admin deve
 * popular o catálogo. Aviso para console.
 */

const FIRST_NAMES = [
  'Diego', 'Rafa', 'Bruno', 'Léo', 'João', 'Pedro', 'Tiago', 'Lucas',
  'Felipe', 'Caio', 'Murilo', 'André', 'Vinícius', 'Matheus', 'Arthur',
  'Davi', 'Gabriel', 'Igor', 'Júlio', 'Renan', 'Otávio', 'Henrique',
  'Mauro', 'Sandro', 'Vitor', 'Yuri', 'Augusto', 'Fred',
];
const LAST_NAMES = [
  'Silva', 'Santos', 'Costa', 'Pereira', 'Almeida', 'Souza', 'Rocha',
  'Lima', 'Mendes', 'Barros', 'Teixeira', 'Pinto', 'Cardoso', 'Nunes',
  'Moura', 'Ramos', 'Vieira', 'Carvalho', 'Cavalcanti', 'Magalhães',
  'Oliveira', 'Ferreira', 'Tavares', 'Macedo', 'Reis', 'Brito',
  'Gomes', 'Faria',
];

const POSITIONS_FIELD = ['ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'ATA'];

interface FallbackTierSpec {
  count: number;
  rarityLabel: string;
  ovrMin: number;
  ovrMax: number;
}

const TIER_SPECS: FallbackTierSpec[] = [
  { count: 18, rarityLabel: 'basic',     ovrMin: 55, ovrMax: 68 },
  { count:  6, rarityLabel: 'rare',      ovrMin: 68, ovrMax: 76 },
  { count:  3, rarityLabel: 'gold',      ovrMin: 76, ovrMax: 82 }, // 'gold' classifica como 'epic' tier
  { count:  1, rarityLabel: 'legendary', ovrMin: 84, ovrMax: 88 },
];

function makeAttrs(ovr: number): Record<string, number> {
  // Gera atributos espalhados ao redor do OVR-alvo. Pequena variação fixa
  // para manter o pool determinístico (baseado no índice).
  const a = ovr - 4;
  const b = ovr;
  const c = ovr + 3;
  return {
    passe: a, marcacao: a, velocidade: b, drible: a,
    finalizacao: b, fisico: c, tatico: a, mentalidade: b,
    confianca: b, fairPlay: 75,
  };
}

/**
 * Gera 28 jogadores mock — 4 deles GOL (2 basic + 1 rare + 1 gold) pra
 * garantir cobertura de goleiros. Total 28 (cobre o requisito de 25 com folga).
 */
export function buildFallbackOnboardingPool(): GenesisMarketPlayerRow[] {
  console.warn(
    '[onboarding] usando pool de fallback mock — admin precisa popular genesis_market_players',
  );
  const rows: GenesisMarketPlayerRow[] = [];
  let kit = 1;
  let nameIdx = 0;

  const golQuotaByTier: Record<string, number> = {
    basic: 2,
    rare: 1,
    gold: 1,
    legendary: 0,
  };

  for (const spec of TIER_SPECS) {
    let golLeft = golQuotaByTier[spec.rarityLabel] ?? 0;
    for (let i = 0; i < spec.count; i++) {
      const t = spec.count > 1 ? i / (spec.count - 1) : 0.5;
      const ovr = Math.round(spec.ovrMin + (spec.ovrMax - spec.ovrMin) * t);
      const isGol = golLeft > 0;
      if (isGol) golLeft--;
      const pos = isGol ? 'GOL' : POSITIONS_FIELD[i % POSITIONS_FIELD.length] ?? 'MC';
      const fn = FIRST_NAMES[nameIdx % FIRST_NAMES.length] ?? 'Jogador';
      const ln = LAST_NAMES[(nameIdx * 7) % LAST_NAMES.length] ?? 'Olefoot';
      nameIdx++;
      rows.push({
        id: `fallback-${kit}`,
        kit_number: kit,
        name: `${fn} ${ln}`,
        pos,
        pos_original: pos,
        archetype: 'profissional',
        zone: pos === 'GOL' ? 'defesa' : pos === 'ATA' || pos === 'PD' || pos === 'PE' ? 'ataque' : 'meio',
        behavior: 'equilibrado',
        attributes: makeAttrs(ovr),
        fatigue: 0,
        injury_risk: 0,
        evolution_xp: 0,
        out_for_matches: 0,
        market_value_bro_cents: 0,
        price_bro_cents: 0,
        country: 'BR',
        age: 22 + (kit % 12),
        strong_foot: kit % 4 === 0 ? 'left' : 'right',
        creator_label: null,
        rarity_label: spec.rarityLabel,
        bio: null,
        listed_on_market: true,
        admin_market_tag: null,
        mint_overall: ovr,
        evolution_rate: null,
        collection_id: 'fallback',
        card_supply: null,
        spirit_notes: null,
        portrait_storage_path: null,
        portrait_public_url: null,
        portrait_token_public_url: null,
        portrait_media_refs: null,
        updated_at: null,
      });
      kit++;
    }
  }
  return rows;
}
