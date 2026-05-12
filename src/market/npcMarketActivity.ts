/**
 * NPC Market Activity — Gera atividades sintéticas de clubes AI
 * para popular o feed de Social Trade e dar vida ao mercado.
 *
 * Roda periodicamente (a cada ~30min) e insere 1-3 atividades no Supabase.
 * Todos os managers veem essas atividades no feed público.
 */

import { useEffect, useRef } from 'react';
import { recordMarketActivity } from '@/supabase/marketActivities';
import { isSupabaseConfigured } from '@/supabase/client';

const NPC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos
const STORAGE_KEY = 'olefoot_npc_market_last_gen';

const NPC_CLUBS = [
  { name: 'Estrela do Norte FC', short: 'ENF' },
  { name: 'Atlético Dourado', short: 'ATD' },
  { name: 'SC Maré Alta', short: 'SMA' },
  { name: 'Leões da Serra', short: 'LDS' },
  { name: 'Furacão Azul', short: 'FAZ' },
  { name: 'Dragões do Sul', short: 'DDS' },
  { name: 'Falcões Negros', short: 'FNG' },
  { name: 'Tubarões FC', short: 'TFC' },
  { name: 'Águias Reais', short: 'AGR' },
  { name: 'Trovão EC', short: 'TEC' },
  { name: 'Fênix United', short: 'FXU' },
  { name: 'Lobos da Noite', short: 'LDN' },
];

const NPC_PLAYERS = [
  { name: 'Rafael Mendes', pos: 'ATA', ovr: 78 },
  { name: 'Lucas Ferreira', pos: 'MEI', ovr: 74 },
  { name: 'Bruno Almeida', pos: 'ZAG', ovr: 72 },
  { name: 'Thiago Santos', pos: 'VOL', ovr: 76 },
  { name: 'Gabriel Costa', pos: 'PE', ovr: 80 },
  { name: 'Matheus Oliveira', pos: 'PD', ovr: 77 },
  { name: 'Pedro Henrique', pos: 'ATA', ovr: 82 },
  { name: 'André Souza', pos: 'MC', ovr: 73 },
  { name: 'Felipe Rocha', pos: 'LD', ovr: 71 },
  { name: 'Caio Ribeiro', pos: 'GOL', ovr: 75 },
  { name: 'Vinícius Lima', pos: 'MEI', ovr: 79 },
  { name: 'Diego Martins', pos: 'ATA', ovr: 84 },
  { name: 'Rodrigo Neves', pos: 'ZAG', ovr: 76 },
  { name: 'Gustavo Pires', pos: 'VOL', ovr: 70 },
  { name: 'Leonardo Dias', pos: 'PE', ovr: 81 },
  { name: 'Henrique Barros', pos: 'MC', ovr: 73 },
  { name: 'Marcos Vieira', pos: 'LE', ovr: 72 },
  { name: 'João Pedro', pos: 'ATA', ovr: 85 },
  { name: 'Danilo Freitas', pos: 'GOL', ovr: 77 },
  { name: 'Renato Cardoso', pos: 'MEI', ovr: 78 },
];

const ACTIVITY_TYPES: Array<'purchase' | 'sale' | 'listing'> = ['purchase', 'sale', 'listing'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomPrice(ovr: number): number {
  const base = ovr * ovr * 80;
  const variance = 0.7 + Math.random() * 0.6;
  return Math.round(base * variance);
}

function generateNpcActivity() {
  const club = pick(NPC_CLUBS);
  const player = pick(NPC_PLAYERS);
  const type = pick(ACTIVITY_TYPES);

  return {
    type,
    managerId: null,
    managerName: club.name,
    clubName: club.name,
    playerName: player.name,
    playerOvr: player.ovr,
    playerPos: player.pos,
    priceExp: randomPrice(player.ovr),
  };
}

function shouldGenerate(): boolean {
  const last = localStorage.getItem(STORAGE_KEY);
  if (!last) return true;
  const elapsed = Date.now() - Number(last);
  return elapsed >= NPC_INTERVAL_MS;
}

function markGenerated() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

async function generateAndInsert() {
  if (!isSupabaseConfigured()) return;
  if (!shouldGenerate()) return;

  const count = 1 + Math.floor(Math.random() * 3); // 1-3 atividades
  for (let i = 0; i < count; i++) {
    const activity = generateNpcActivity();
    await recordMarketActivity(activity);
  }
  markGenerated();
}

/**
 * Hook que gera atividades NPC periodicamente.
 * Montar uma vez no App (junto com outros hooks globais).
 */
export function useNpcMarketActivity() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void generateAndInsert();

    const interval = setInterval(() => {
      void generateAndInsert();
    }, NPC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}
