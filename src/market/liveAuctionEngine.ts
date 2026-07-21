/**
 * LiveAuctionEngine — Motor de leilões ao vivo
 * Apenas lances reais (placeBid) — sem lances simulados por IA.
 */

import { useState, useEffect } from 'react';
import type { LiveAuction, AuctionBid, ManagerMessage } from './socialTrade';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';

// Configurações de leilão
export const AUCTION_DURATION_MS = 5 * 60 * 1000; // 5 minutos
export const AUCTION_EXTENSION_MS = 30 * 1000; // +30s se lance nos últimos 10s
export const AUCTION_EXTENSION_THRESHOLD_MS = 10 * 1000; // Últimos 10s
export const MIN_BID_INCREMENT = 0.05; // +5% mínimo

// Estado global de leilões (simplificado, sem Zustand por enquanto)
let activeAuctions: Map<string, LiveAuction> = new Map();
let auctionListeners: Set<(auctions: LiveAuction[]) => void> = new Set();
let messageListeners: Set<(message: ManagerMessage) => void> = new Set();

// Notificar listeners
function notifyAuctionListeners() {
  const auctions = Array.from(activeAuctions.values());
  auctionListeners.forEach((listener) => listener(auctions));
}

function notifyMessageListeners(message: ManagerMessage) {
  messageListeners.forEach((listener) => listener(message));
}

// Criar leilão a partir de MockAuctionPlayer
export function createAuctionFromPlayer(player: MockAuctionPlayer): LiveAuction {
  const now = new Date();
  const endTime = new Date(now.getTime() + AUCTION_DURATION_MS);

  const auction: LiveAuction = {
    id: `auction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    playerId: player.id.toString(),
    playerName: player.name,
    playerOvr: player.ovr,
    playerPos: player.pos,
    startPrice: player.buyNow,
    currentBid: player.buyNow,
    currentBidder: null,
    currentBidderName: null,
    bids: [],
    startTime: now,
    endTime,
    status: 'active',
  };

  activeAuctions.set(auction.id, auction);
  notifyAuctionListeners();

  return auction;
}

// Criar leilão (legacy - mantido para compatibilidade)
export function createAuction(
  playerId: string,
  playerName: string,
  playerOvr: number,
  playerPos: string,
  startPrice: number,
): LiveAuction {
  const now = new Date();
  const endTime = new Date(now.getTime() + AUCTION_DURATION_MS);

  const auction: LiveAuction = {
    id: `auction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    playerId,
    playerName,
    playerOvr,
    playerPos,
    startPrice,
    currentBid: startPrice,
    currentBidder: null,
    currentBidderName: null,
    bids: [],
    startTime: now,
    endTime,
    status: 'active',
  };

  activeAuctions.set(auction.id, auction);
  notifyAuctionListeners();

  return auction;
}

// Dar lance (jogador)
export function placeBid(
  auctionId: string,
  bidderId: string,
  bidderName: string,
  amount: number,
): { success: boolean; error?: string } {
  const auction = activeAuctions.get(auctionId);
  if (!auction) return { success: false, error: 'Leilão não encontrado' };
  if (auction.status !== 'active') return { success: false, error: 'Leilão encerrado' };

  const minBid = Math.ceil(auction.currentBid * (1 + MIN_BID_INCREMENT));
  if (amount < minBid) {
    return { success: false, error: `Lance mínimo: ${minBid} EXP` };
  }

  // Registrar lance
  const bid: AuctionBid = {
    bidderId,
    bidderName,
    amount,
    timestamp: new Date(),
    isAI: false,
  };

  auction.bids.unshift(bid);
  auction.currentBid = amount;
  auction.currentBidder = bidderId;
  auction.currentBidderName = bidderName;

  // Extensão automática se lance nos últimos 10s
  const timeLeft = auction.endTime.getTime() - Date.now();
  if (timeLeft < AUCTION_EXTENSION_THRESHOLD_MS && timeLeft > 0) {
    auction.endTime = new Date(Date.now() + AUCTION_EXTENSION_MS);
  }

  activeAuctions.set(auctionId, auction);
  notifyAuctionListeners();

  return { success: true };
}

// Encerrar leilão
function endAuction(auctionId: string) {
  const auction = activeAuctions.get(auctionId);
  if (!auction || auction.status !== 'active') return;

  auction.status = 'ended';
  activeAuctions.set(auctionId, auction);
  notifyAuctionListeners();

  // Notificar vencedor se for jogador
  if (auction.currentBidder && !auction.currentBidder.startsWith('ai_')) {
    const message: ManagerMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'auction_won',
      title: 'Parabéns! Você venceu!',
      message: `Você arrematou ${auction.playerName} por ${formatPrice(auction.currentBid)}. Valor de mercado: ${formatPrice(Math.floor(auction.currentBid * 1.4))}`,
      playerName: auction.playerName,
      price: auction.currentBid,
      urgency: 'medium',
      read: false,
      timestamp: new Date(),
      actionUrl: `/mercado/leiloes`,
    };
    notifyMessageListeners(message);
  }
}

// Hook React para leilões ativos
export function useActiveAuctions() {
  const [auctions, setAuctions] = useState<LiveAuction[]>([]);

  useEffect(() => {
    const listener = (updated: LiveAuction[]) => setAuctions(updated);
    auctionListeners.add(listener);

    // Estado inicial
    setAuctions(Array.from(activeAuctions.values()));

    return () => {
      auctionListeners.delete(listener);
    };
  }, []);

  return auctions;
}

// Hook React para mensagens de leilão
export function useAuctionMessages() {
  const [messages, setMessages] = useState<ManagerMessage[]>([]);

  useEffect(() => {
    const listener = (message: ManagerMessage) => {
      setMessages((prev) => [message, ...prev]);
    };
    messageListeners.add(listener);

    return () => {
      messageListeners.delete(listener);
    };
  }, []);

  return messages;
}

// Hook React para countdown de leilão específico
export function useAuctionCountdown(auctionId: string) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const auction = activeAuctions.get(auctionId);
      if (!auction || auction.status !== 'active') {
        setTimeLeft(0);
        return;
      }

      const left = auction.endTime.getTime() - Date.now();
      // Sem motor de IA, o encerramento acontece aqui quando o tempo expira.
      if (left <= 0) {
        endAuction(auctionId);
        setTimeLeft(0);
        setIsEnding(false);
        return;
      }
      setTimeLeft(Math.max(0, left));
      setIsEnding(left < AUCTION_EXTENSION_THRESHOLD_MS && left > 0);
    }, 100); // Atualiza a cada 100ms para countdown suave

    return () => clearInterval(interval);
  }, [auctionId]);

  return { timeLeft, isEnding };
}

// Formatar preço
function formatPrice(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M EXP`;
  }
  if (amount >= 10_000) {
    return `${(amount / 1000).toFixed(0)}k EXP`;
  }
  return `${amount.toLocaleString('pt-BR')} EXP`;
}

// Gerar leilões a partir de pool de jogadores reais
export function seedAuctionsFromPlayers(players: MockAuctionPlayer[], count: number = 3) {
  // Filtrar jogadores elegíveis (OVR alto, preço razoável)
  const eligible = players
    .filter((p) => p.ovr >= 85 && p.buyNow >= 500_000 && p.buyNow <= 3_000_000)
    .sort((a, b) => b.ovr - a.ovr);

  const toCreate = eligible.slice(0, Math.min(count, eligible.length));

  toCreate.forEach((player) => {
    createAuctionFromPlayer(player);
  });
}

// Limpar todos os leilões (útil para reset)
export function clearAllAuctions() {
  activeAuctions.clear();
  notifyAuctionListeners();
}

// Obter leilão por ID
export function getAuction(auctionId: string): LiveAuction | undefined {
  return activeAuctions.get(auctionId);
}
