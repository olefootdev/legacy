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
