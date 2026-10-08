/**
 * Wallet → Coleção. Prateleira dos colecionáveis do manager.
 *
 * SHELL (2026-07-16): a estrutura e o layout estão prontos, mas NADA popula
 * `items` ainda — o branch do fim de semana pluga a fonte real (os cards Legacy
 * e Genesis que o manager possui, com arte já hospedada em Pinata/IPFS).
 *
 * Regra que vale a pena manter: enquanto não houver fonte, a lista é vazia de
 * propósito. Nunca encher com card de exemplo — colecionável fake vira reclamação
 * de suporte no dia seguinte.
 *
 * Quando for plugar: `WalletCollectible` (@/wallet/types) já é o contrato do item,
 * e `getMyLinkedCards` / `legacy_players` são as fontes candidatas.
 */
import { WalletShell } from './WalletShell';
import type { WalletCollectible } from '@/wallet/types';
import { BotaoRua, DEGRAU_CLASSES, MarcaRua, SecaoRua, degrauDe } from '@/components/ui';

/** Inclinações de lambe colado (até 2°, pra grade não cortar a carta). */
const TORTO = [-2, 1.5, -1, 2, -1.5, 1];
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';

/**
 * DS 2027: a carta mora na ESCADA pelo OVR (<70 chão · 70–79 corre · 80–89
 * respeito · 90+ lenda), colada torta como lambe. O contrato de hoje não traz
 * OVR; quando a fonte plugar e trouxer, a carta sobe o degrau sozinha. Sem OVR,
 * carta que é TUA fica em RESPEITO — valor que já existe.
 */
type ItemDaColecao = WalletCollectible & { ovr?: number };

/** Vazio com saída: tracejado, frase na voz, e o caminho pro mercado. */
function EmptyShelf() {
  return (
    <div className="flex flex-col items-start gap-4 border-2 border-dashed border-fio px-5 py-7">
      {/* Três vagas de carta, tracejadas e tortas: a prateleira esperando. */}
      <div aria-hidden className="flex gap-3 pb-1 pt-2">
        {[-3, 2, -1.5].map((r, i) => (
          <span key={i} className="flex h-[84px] w-[60px] items-center justify-center border-2 border-dashed border-fio" style={{ transform: `rotate(${r}deg)` }}>
            <MarcaRua tipo="escudo" className="h-6 bg-linha" />
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-voz text-[clamp(32px,9vw,44px)] leading-[0.95] text-papel">
          {L('Sua coleção está vazia', 'Your collection is empty')}
        </h3>
        <p className="max-w-sm text-[13.5px] leading-relaxed text-suave">
          {L('Os cards que você comprar aparecem aqui.', 'Cards you buy show up here.')}
        </p>
      </div>
      <BotaoRua to="/mercado/transfer">
        {L('Ver o mercado', 'See the market')} <span aria-hidden>→</span>
      </BotaoRua>
    </div>
  );
}

function CollectibleCard({ item, torto }: { item: ItemDaColecao; torto: number }) {
  const d = typeof item.ovr === 'number' ? degrauDe(item.ovr) : 'respeito';
  const destaque = d === 'respeito' ? 'text-ouro-27' : '';
  return (
    <article
      className={cn(
        'flex min-w-0 flex-col gap-2 p-2.5 shadow-[5px_6px_0_rgba(0,0,0,0.55)] transition-transform duration-200 hover:!rotate-0',
        DEGRAU_CLASSES[d],
      )}
      style={{ transform: `rotate(${torto}deg)` }}
    >
      {typeof item.ovr === 'number' && (
        <span
          className={cn(
            'font-impact text-[34px] leading-[0.85] tabular-nums',
            destaque,
            d === 'chao' && 'text-transparent [-webkit-text-stroke:1.5px_var(--color-asfalto-27)]',
          )}
        >
          {item.ovr}
        </span>
      )}
      <div className={cn('relative aspect-[3/4] w-full overflow-hidden', d === 'respeito' ? 'bg-concreto' : 'bg-asfalto-27/10')}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="absolute inset-0 object-cover"
            style={{ width: '100%', height: '100%', maxWidth: 'none' }}
          />
        ) : (
          <MarcaRua tipo="escudo" className="absolute left-1/2 top-1/2 h-12 -translate-x-1/2 -translate-y-1/2 bg-current opacity-30" />
        )}
      </div>
      <h4 className="block min-w-0 truncate font-voz text-[clamp(20px,5.5vw,24px)] leading-none">{item.name}</h4>
      {item.collectionTitle && (
        <p className="min-w-0 truncate font-prova text-[10.5px] uppercase tracking-[0.06em] opacity-80">{item.collectionTitle}</p>
      )}
      {item.rarityLabel && (
        <span
          className={cn(
            'block min-w-0 truncate px-2 py-1 font-prova text-[10.5px] font-bold uppercase tracking-[0.14em]',
            d === 'chao' && 'border-t-2 border-dashed border-asfalto-27 px-0',
            d === 'corre' && 'bg-asfalto-27 text-rua',
            d === 'respeito' && 'border-2 border-ouro-27 text-ouro-27',
            d === 'lenda' && 'bg-asfalto-27 text-ouro-27',
          )}
        >
          {item.rarityLabel}
        </span>
      )}
    </article>
  );
}

export function CollectionTab() {
  // Fonte real entra no branch do fim de semana. Até lá, vazio de propósito.
  const items: ItemDaColecao[] = [];

  return (
    <WalletShell
      title={L('Coleção', 'Collection')}
      hashtag={L('#colecao', '#collection')}
      heroVariant="compact"
      voltar
      heroStats={[{ label: 'Cards', value: String(items.length) }]}
    >
      <section className="space-y-4">
        <SecaoRua label={L('Tuas cartas', 'Your cards')} aside={items.length > 0 ? String(items.length) : undefined} />
        {items.length === 0 ? (
          <EmptyShelf />
        ) : (
          // Folga em volta pra inclinação não cortar a carta.
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-1 py-2 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, i) => (
              <CollectibleCard key={item.id} item={item} torto={TORTO[i % TORTO.length]!} />
            ))}
          </div>
        )}
      </section>
    </WalletShell>
  );
}
