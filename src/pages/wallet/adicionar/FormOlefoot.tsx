import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hashtag } from '@/components/ui';
import {
  lerEstadoDaPresale, previaDoValor,
  type EstadoDaPresaleCarregado, type MotivoPackFechado,
} from '@/payments/presaleClient';
import { lerMinhaEntrada } from '@/supabase/expansaoPainel';
import { conviteVisto, esquecerConviteVisto } from '@/wallet/conviteVisto';

/**
 * Comprar OLEFOOT na pré-venda — o pack.
 *
 * 🔴 A tela manda QUAL pack, em dólar. Quantos tokens e quantos reais sai do
 * servidor, na lista e de novo na criação do Pix. O que aparece aqui antes do
 * checkout é o preço de agora; o que vale é o do QR.
 *
 * 🔒 Antes de comprar, o convite. Quem compra entra na árvore sozinho, e a
 * posição é permanente. Se a pessoa abriu o convite de alguém e não confirmou,
 * a tela pergunta — senão ela entraria debaixo de outro patrocinador e quem
 * convidou perderia o indicado sem ninguém ter escolhido isso.
 */

export interface PedidoOlefoot {
  readonly usdCents: number;
  /** Reais de agora, em centavos — só pra mostrar antes do QR. */
  readonly brlCents: number;
  readonly recebe: bigint;
  /** Ativação 3×: pack próprio + 1 conta de $10 em cada time. */
  readonly plano?: 'ativacao_3x';
}

const FECHADO: Record<MotivoPackFechado, string> = {
  abaixo_do_minimo: 'abaixo do mínimo',
  nao_inteiro: 'valor inválido',
  acima_do_teto_por_conta: 'acima do teto da conta',
  alocacao_insuficiente: 'esgotado',
  cotacao_invalida: 'sem cotação',
};

const br = (v: bigint) => v.toLocaleString('pt-BR');
const reais = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Dólar escrito como o resto da tela: ponto no milhar, vírgula no centavo.
const dolar = (cents: number) =>
  `$${(cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  })}`;

export function FormOlefoot({
  packInicial,
  onPagar,
  onFechar,
}: {
  /** Pack já escolhido ao abrir, em centavos de dólar (ex.: 1000 vindo do NETWORK). */
  packInicial?: number;
  onPagar: (pedido: PedidoOlefoot) => void;
  onFechar: () => void;
}) {
  const navigate = useNavigate();
  const [carga, setCarga] = useState<EstadoDaPresaleCarregado>({ status: 'carregando' });
  const [escolhido, setEscolhido] = useState<number | 'ativacao_3x' | null>(packInicial ?? null);
  const [outro, setOutro] = useState('');
  // null = ainda não sei; '' = não há convite a perguntar.
  const [convite, setConvite] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    lerEstadoDaPresale()
      .then((estado) => { if (vivo) setCarga({ status: 'ok', estado }); })
      .catch((e: unknown) => {
        if (vivo) setCarga({ status: 'erro', mensagem: e instanceof Error ? e.message : 'erro' });
      });
    // O convite só importa pra quem ainda está FORA da árvore.
    const visto = conviteVisto();
    if (!visto) { setConvite(''); }
    else {
      void lerMinhaEntrada().then((entrada) => {
        if (!vivo) return;
        if (entrada.naArvore) { esquecerConviteVisto(); setConvite(''); }
        else setConvite(visto);
      });
    }
    return () => { vivo = false; };
  }, []);

  const estado = carga.status === 'ok' ? carga.estado : null;

  const outroCents = useMemo(() => {
    const v = parseFloat(outro.replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
  }, [outro]);

  const pedido: PedidoOlefoot | null = useMemo(() => {
    if (!estado) return null;
    if (outroCents != null) {
      if (outroCents < estado.minimoUsdCents) return null;
      const p = previaDoValor(outroCents, estado);
      return p ? { usdCents: outroCents, brlCents: p.brlCents, recebe: p.recebe } : null;
    }
    if (escolhido === 'ativacao_3x') {
      const plano = estado.planos.find((p) => p.kind === 'ativacao_3x' && p.disponivel);
      return plano
        ? { usdCents: plano.usdCents, brlCents: plano.brlCents, recebe: plano.recebePorConta, plano: 'ativacao_3x' }
        : null;
    }
    const pack = estado.packs.find((p) => p.usdCents === escolhido && p.disponivel);
    return pack ? { usdCents: pack.usdCents, brlCents: pack.brlCents, recebe: pack.recebe } : null;
  }, [estado, escolhido, outroCents]);

  if (carga.status === 'carregando' || convite === null) {
    return <p className="py-6 font-mono text-[12px] text-cimento">Carregando a pré-venda…</p>;
  }
  if (carga.status === 'erro' || !estado) {
    return (
      <div className="border border-atencao/40 bg-atencao/10 px-3 py-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-atencao">Pré-venda</p>
        <p className="mt-1 text-xs text-giz">Não deu para carregar os packs agora. Tente de novo em instantes.</p>
      </div>
    );
  }
  if (!estado.aberta) {
    return (
      <div className="border border-white/10 bg-card px-3 py-4">
        <p className="font-impact text-[20px] uppercase leading-[1.1] text-white">Pré-venda fechada</p>
      </div>
    );
  }

  // ── o convite vem antes da compra ─────────────────────────────────────────
  if (convite) {
    return (
      <div className="space-y-3">
        <div className="border-l-2 border-atencao bg-card px-4 py-3.5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-atencao">Antes de comprar</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-giz">
            Você abriu o convite de <strong>@{convite}</strong> e ainda não confirmou.
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-cimento">
            Quem compra entra na rede na hora, e a posição é definitiva. Sem confirmar, você entra
            debaixo de outra pessoa.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { onFechar(); navigate(`/convite-expansao/${encodeURIComponent(convite)}`); }}
          className="ole-num inline-flex h-[50px] w-full items-center justify-center whitespace-nowrap bg-neon-yellow text-[13px] uppercase text-black transition-colors hover:bg-white [--corte:12px] [clip-path:var(--clip-corte)]"
        >
          Confirmar @{convite}
        </button>
        <button
          type="button"
          onClick={() => { esquecerConviteVisto(); setConvite(''); }}
          className="h-[50px] w-full border border-white/30 text-[13px] font-bold text-white transition-colors hover:border-white"
        >
          COMPRAR SEM O CONVITE
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Hashtag>#prevenda · ${estado.preco.replace('.', ',')} por OLEFOOT</Hashtag>

      <div className="border border-white/10">
        {estado.packs.map((p) => {
          const ativo = outroCents == null && escolhido === p.usdCents;
          return (
            <button
              key={p.usdCents}
              type="button"
              disabled={!p.disponivel}
              onClick={() => { setEscolhido(p.usdCents); setOutro(''); }}
              className={cn(
                'flex w-full min-w-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left transition-colors last:border-b-0 disabled:cursor-not-allowed disabled:opacity-40',
                ativo ? 'bg-neon-yellow text-black' : 'bg-deep-black text-white hover:bg-card',
              )}
            >
              <span className="ole-num shrink-0 text-[17px] tabular-nums">{dolar(p.usdCents)}</span>
              {/* Tokens em cima, reais embaixo. Numa linha só os três números
                  não cabem em 320px, e o que cortava era justamente o dado. */}
              <span className="flex min-w-0 flex-col items-end gap-0.5">
                <span className="whitespace-nowrap font-mono text-[11.5px] tabular-nums">
                  {p.disponivel ? `${br(p.recebe)} OLEFOOT` : FECHADO[p.motivo ?? 'cotacao_invalida']}
                </span>
                {p.disponivel && (
                  <span className={cn('whitespace-nowrap font-mono text-[11px] tabular-nums', ativo ? 'text-black' : 'text-cimento')}>
                    R$ {reais(p.brlCents)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── ATIVAÇÃO 3×: você + 1 conta de $10 em cada time ─────────────────
          As duas contas são SUAS: entram uma em cada perna (primeira posição
          ou derramamento) e ativam o seu bônus na hora — "1 em cada time". */}
      {estado.planos.filter((p) => p.kind === 'ativacao_3x').map((plano) => {
        const ativo = outroCents == null && escolhido === 'ativacao_3x';
        return (
          <button
            key={plano.kind}
            type="button"
            disabled={!plano.disponivel}
            onClick={() => { setEscolhido('ativacao_3x'); setOutro(''); }}
            className={cn(
              'block w-full border px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              ativo ? 'border-neon-yellow bg-neon-yellow text-black' : 'border-neon-yellow/40 bg-deep-black text-white hover:bg-card',
            )}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="ole-num shrink-0 text-[15px] uppercase">Ativação 3× · {dolar(plano.usdCents)}</span>
              <span className="whitespace-nowrap font-mono text-[11px] tabular-nums">
                {plano.disponivel ? `R$ ${reais(plano.brlCents)}` : FECHADO[plano.motivo ?? 'cotacao_invalida']}
              </span>
            </span>
            <span className={cn('mt-1.5 block text-[12px] leading-relaxed', ativo ? 'text-black' : 'text-cimento')}>
              Seu pack de $10 + 1 conta de $10 no Time 1 e no Time 2 — as duas são suas.
              Ativa o bônus na hora, com 1 em cada time.
            </span>
          </button>
        );
      })}

      <div>
        <label className="mb-1 block font-mono text-[10.5px] font-medium uppercase tracking-wider text-cimento">
          Ou outro valor, em dólar
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-poeira">$</span>
          <input
            value={outro}
            onChange={(e) => setOutro(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="w-full border border-white/16 bg-deep-black py-2.5 pl-8 pr-3 font-mono text-lg tabular-nums text-white focus:border-neon-yellow/60 focus:outline-none"
          />
        </div>
        {outroCents != null && outroCents < estado.minimoUsdCents && (
          <p className="mt-1 text-[10px] text-baixa">Mínimo de {dolar(estado.minimoUsdCents)}</p>
        )}
      </div>

      {pedido && (
        <div className="flex min-w-0 items-baseline justify-between gap-3 border border-white/10 bg-card px-3 py-2.5">
          <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-wider text-cimento">
            Você recebe
          </span>
          <span className="ole-num min-w-0 truncate text-[16px] text-white tabular-nums">
            {pedido.plano === 'ativacao_3x'
              ? `${br(pedido.recebe)} OLEFOOT × 3 contas`
              : `${br(pedido.recebe)} OLEFOOT`}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => pedido && onPagar(pedido)}
        disabled={!pedido}
        className={cn(
          'ole-num inline-flex h-[50px] w-full items-center justify-center gap-2 whitespace-nowrap text-[13px] uppercase transition-colors [--corte:12px] [clip-path:var(--clip-corte)]',
          pedido ? 'bg-neon-yellow text-black hover:bg-white' : 'cursor-not-allowed bg-card-hi text-poeira',
        )}
      >
        <Zap className="h-4 w-4" />
        {pedido ? `Pagar R$ ${reais(pedido.brlCents)} no Pix` : 'Escolha o pack'}
      </button>

      {/* Texto de custódia e de trava: a pessoa precisa saber ANTES de pagar
          que o token entra travado e ainda não está na carteira dela. */}
      <p className="border-l-2 border-cimento bg-card px-3.5 py-3 text-[12px] leading-relaxed text-cimento">
        O OLEFOOT entra travado na sua posição. O token ainda não foi lançado na Solana; a entrega
        vai para a carteira vinculada.
      </p>
    </div>
  );
}
