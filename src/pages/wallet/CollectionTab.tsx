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

function EmptyShelf() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-xl">
        ◈
      </div>
      <h3 className="font-display text-sm font-black uppercase tracking-[0.18em] text-white/70">
        Sua coleção está vazia
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-white/45">
        Os cards que você comprar aparecem aqui.
      </p>
    </div>
  );
}

function CollectibleCard({ item }: { item: WalletCollectible }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-[#121214]">
      <div className="relative aspect-[3/4] overflow-hidden bg-black/40">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/20">◈</div>
        )}
        {item.rarityLabel && (
          <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/60 px-2 py-0.5 font-display text-[9px] font-black uppercase tracking-[0.16em] text-white/80 backdrop-blur-sm">
            {item.rarityLabel}
          </span>
        )}
      </div>
      <div className="p-3">
        <h4 className="truncate text-sm font-bold text-white">{item.name}</h4>
        {item.collectionTitle && (
          <p className="mt-0.5 truncate text-[11px] text-white/45">{item.collectionTitle}</p>
        )}
      </div>
    </article>
  );
}

export function CollectionTab() {
  // Fonte real entra no branch do fim de semana. Até lá, vazio de propósito.
  const items: WalletCollectible[] = [];

  return (
    <WalletShell
      title="Coleção"
      heroVariant="compact"
      heroStats={[{ label: 'Cards', value: String(items.length) }]}
    >
      <section className="space-y-4">
        {items.length === 0 ? (
          <EmptyShelf />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <CollectibleCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </WalletShell>
  );
}
