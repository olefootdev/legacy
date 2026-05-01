/**
 * Social Trade — Sistema minimalista de atividades de mercado
 * Sem conexão externa (Twitter/X), apenas feed interno
 */

export interface MarketActivity {
  id: string;
  type: 'purchase' | 'sale' | 'auction_won' | 'auction_lost' | 'listing';
  userId: string;
  userName: string;
  playerName: string;
  playerOvr: number;
  playerPos: string;
  price: number;
  currency: 'EXP' | 'BRO';
  profit?: number; // Se venda, lucro vs preço de compra
  timestamp: Date;
  isAI?: boolean; // Se foi ação de IA
}

export interface LiveAuction {
  id: string;
  playerId: string;
  playerName: string;
  playerOvr: number;
  playerPos: string;
  startPrice: number;
  currentBid: number;
  currentBidder: string | null; // 'ai_real_madrid' | 'player_123'
  currentBidderName: string | null;
  bids: AuctionBid[];
  startTime: Date;
  endTime: Date;
  status: 'active' | 'ended' | 'cancelled';
  isAI?: boolean;
}

export interface AuctionBid {
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: Date;
  isAI: boolean;
}

export interface AIBidder {
  id: string;
  name: string;
  personality: 'aggressive' | 'cautious' | 'strategic';
  budget: number;
  targetPositions: string[];
}

export interface ManagerMessage {
  id: string;
  type: 'auction_outbid' | 'auction_won' | 'auction_lost' | 'opportunity' | 'system';
  title: string;
  message: string;
  playerName?: string;
  price?: number;
  urgency: 'high' | 'medium' | 'low';
  read: boolean;
  timestamp: Date;
  actionUrl?: string;
}

// IA Bidders (3 personalidades)
export const AI_BIDDERS: AIBidder[] = [
  {
    id: 'ai_real_madrid',
    name: 'Real Madrid',
    personality: 'aggressive',
    budget: 50_000_000,
    targetPositions: ['ATA', 'MEI', 'PD', 'PE'],
  },
  {
    id: 'ai_barcelona',
    name: 'Barcelona',
    personality: 'strategic',
    budget: 40_000_000,
    targetPositions: ['MEI', 'MC', 'ATA'],
  },
  {
    id: 'ai_bayern',
    name: 'Bayern Munich',
    personality: 'cautious',
    budget: 35_000_000,
    targetPositions: ['VOL', 'ZAG', 'ATA'],
  },
];

// Gerar atividades mock (seed inicial)
export function generateMockActivities(count: number): MarketActivity[] {
  const activities: MarketActivity[] = [];
  const now = Date.now();

  const players = [
    { name: 'Mbappé', ovr: 94, pos: 'ATA' },
    { name: 'Haaland', ovr: 93, pos: 'ATA' },
    { name: 'Vini Jr', ovr: 91, pos: 'PE' },
    { name: 'Bellingham', ovr: 90, pos: 'MEI' },
    { name: 'Rodri', ovr: 89, pos: 'VOL' },
    { name: 'Salah', ovr: 90, pos: 'PD' },
    { name: 'De Bruyne', ovr: 91, pos: 'MEI' },
    { name: 'Neymar', ovr: 92, pos: 'MEI' },
  ];

  const users = [
    'João Silva', 'Maria FC', 'Pedro Manager', 'Ana Costa', 'Carlos Santos',
    'Real Madrid', 'Barcelona', 'Bayern Munich',
  ];

  for (let i = 0; i < count; i++) {
    const player = players[Math.floor(Math.random() * players.length)]!;
    const user = users[Math.floor(Math.random() * users.length)]!;
    const isAI = user.includes('Madrid') || user.includes('Barcelona') || user.includes('Bayern');
    const type = Math.random() > 0.5 ? 'purchase' : 'auction_won';
    const price = Math.floor(500_000 + Math.random() * 2_000_000);
    const profit = undefined;

    activities.push({
      id: `act_${now}_${i}`,
      type,
      userId: isAI ? `ai_${user.toLowerCase().replace(/\s/g, '_')}` : `user_${i}`,
      userName: user,
      playerName: player.name,
      playerOvr: player.ovr,
      playerPos: player.pos,
      price,
      currency: 'EXP',
      profit,
      timestamp: new Date(now - i * 1000 * 60 * Math.random() * 30), // Últimos 30min
      isAI,
    });
  }

  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Gerar mensagens mock para o manager
export function generateMockMessages(count: number): ManagerMessage[] {
  const messages: ManagerMessage[] = [];
  const now = Date.now();

  const templates = [
    {
      type: 'auction_outbid' as const,
      title: 'Você foi superado!',
      message: 'Real Madrid ofereceu 1.5M por Mbappé. Seu lance: 1.3M',
      urgency: 'high' as const,
    },
    {
      type: 'opportunity' as const,
      title: 'Oportunidade de Ouro!',
      message: 'Neymar está 40% abaixo do mercado. Termina em 5 minutos',
      urgency: 'high' as const,
    },
    {
      type: 'auction_won' as const,
      title: 'Parabéns! Você venceu!',
      message: 'Você arrematou Haaland por 1.8M. Valor de mercado: 2.5M',
      urgency: 'medium' as const,
    },
    {
      type: 'system' as const,
      title: 'Novo jogador disponível',
      message: 'Cristiano Ronaldo entrou no mercado. Preço inicial: 800k',
      urgency: 'low' as const,
    },
  ];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length]!;
    messages.push({
      id: `msg_${now}_${i}`,
      ...template,
      read: Math.random() > 0.5,
      timestamp: new Date(now - i * 1000 * 60 * Math.random() * 60), // Última hora
      actionUrl: '/transfer',
    });
  }

  return messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Simular lances de IA em leilão
export function simulateAIBid(
  auction: LiveAuction,
  aiBidder: AIBidder,
): { shouldBid: boolean; bidAmount: number } {
  const timeLeft = auction.endTime.getTime() - Date.now();
  const timeLeftSec = Math.floor(timeLeft / 1000);

  // Não dar lance se já vencendo
  if (auction.currentBidder === aiBidder.id) {
    return { shouldBid: false, bidAmount: 0 };
  }

  // Não dar lance se acima do orçamento
  if (auction.currentBid >= aiBidder.budget) {
    return { shouldBid: false, bidAmount: 0 };
  }

  // Personalidade define estratégia
  switch (aiBidder.personality) {
    case 'aggressive':
      // Lança logo no início, valores altos
      if (timeLeftSec > 60 && Math.random() > 0.3) {
        const increment = Math.floor(auction.currentBid * 0.15); // +15%
        return { shouldBid: true, bidAmount: auction.currentBid + increment };
      }
      break;

    case 'strategic':
      // Espera até metade do tempo, lances calculados
      if (timeLeftSec < 150 && timeLeftSec > 30 && Math.random() > 0.5) {
        const increment = Math.floor(auction.currentBid * 0.08); // +8%
        return { shouldBid: true, bidAmount: auction.currentBid + increment };
      }
      break;

    case 'cautious':
      // Só lança nos últimos segundos, incrementos mínimos
      if (timeLeftSec < 30 && Math.random() > 0.6) {
        const increment = Math.floor(auction.currentBid * 0.05); // +5%
        return { shouldBid: true, bidAmount: auction.currentBid + increment };
      }
      break;
  }

  return { shouldBid: false, bidAmount: 0 };
}

// Formatar tempo restante
export function formatTimeLeft(endTime: Date): string {
  const now = Date.now();
  const diff = endTime.getTime() - now;

  if (diff <= 0) return 'Encerrado';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Formatar preço
export function formatPrice(amount: number, currency: 'EXP' | 'BRO'): string {
  if (currency === 'BRO') {
    const bro = amount / 100;
    return `${bro.toFixed(2)} BRO`;
  }

  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M EXP`;
  }
  if (amount >= 10_000) {
    return `${(amount / 1000).toFixed(0)}k EXP`;
  }
  return `${amount.toLocaleString('pt-BR')} EXP`;
}
