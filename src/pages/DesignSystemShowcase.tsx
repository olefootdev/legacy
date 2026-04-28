import { LegacyHeader } from '@/components/ui/LegacyHeader';
import { DataCard } from '@/components/ui/DataCard';
import { PlayerPortrait } from '@/components/ui/PlayerPortrait';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';

/**
 * Showcase Sprint A — verificação visual dos 4 primitivos novos.
 * Rota: /design-system (não-pública; só pra revisão de DS).
 */
export function DesignSystemShowcase() {
  return (
    <div className="min-h-screen bg-deep-black px-5 pb-32 pt-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12">

        {/* HEADER PADRÃO */}
        <section className="flex flex-col gap-6">
          <LegacyHeader
            eyebrow="Sprint A · Legacy Tech"
            title="Design System"
            subtitle="primitivos"
            size="xl"
          />
          <p className="text-center text-[13px] leading-relaxed text-white/55">
            4 componentes novos — texto-claro, sem ícones pequenos, hierarquia editorial.
            Reaproveitam tokens existentes (MORET, neon-yellow, deep-black) e adicionam
            superfícies elevadas + glow para respeito ao jogador.
          </p>
        </section>

        {/* HEADER ALINHADO À ESQUERDA */}
        <section className="flex flex-col gap-4">
          <LegacyHeader
            eyebrow="Variante · Internal Page"
            title="Plantel"
            subtitle="Principal"
            align="start"
            size="lg"
          />
        </section>

        {/* STAT TILES */}
        <section className="flex flex-col gap-4">
          <LegacyHeader
            eyebrow="Stat Tile · Métricas Frias"
            title="Performance"
            align="start"
            size="md"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile value="22%" label="Apoio" tone="accent" />
            <StatTile value="0" label="Vitórias" />
            <StatTile value="0" label="Empates" />
            <StatTile value="—" label="Ranking" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile size="lg" value="10M" label="EXP" tone="accent" hint="saldo do manager" />
            <StatTile size="lg" value="0,00" label="BRO" hint="conta SPOT" />
            <StatTile size="lg" value="25" label="Elenco" tone="success" hint="jogadores ativos" />
          </div>
        </section>

        {/* DATA CARDS */}
        <section className="flex flex-col gap-4">
          <LegacyHeader
            eyebrow="Data Card · Painéis"
            title="Cards"
            subtitle="elevados"
            align="start"
            size="md"
          />
          <DataCard
            eyebrow="Jogadores"
            title="Transfer Market"
            description="Comprar e vender jogadores no mercado global. Negocia com outros clubes e monta o plantel ideal."
            actions={
              <>
                <Button variant="primary" size="md">Explorar Mercado</Button>
                <Button variant="secondary" size="md">Ver favoritos</Button>
              </>
            }
          />
          <DataCard
            variant="hero"
            eyebrow="Câmbio"
            title="Exchange EXP ↔ BRO"
            description="Anuncia lotes de EXP ou compra ofertas de outros managers em tempo real."
            actions={
              <Button variant="primary" size="md">Ver Ofertas</Button>
            }
          />
          <DataCard
            variant="soft"
            eyebrow="Itens"
            title="Loja Olefoot"
            description="Packs de jogadores, boosters de partida e itens especiais."
            actions={
              <Button variant="secondary" size="md">Abrir Loja</Button>
            }
          />
        </section>

        {/* PLAYER PORTRAITS */}
        <section className="flex flex-col gap-4">
          <LegacyHeader
            eyebrow="Player Portrait · Hero"
            title="Respeito"
            subtitle="ao jogador"
            align="start"
            size="md"
          />

          <div className="flex flex-wrap gap-4">
            <PlayerPortrait name="Adrien Ayo" position="MC" overall={50} rarity="genesis" size="md" />
            <PlayerPortrait name="Marinho Souza" position="MC" overall={68} rarity="ouro" size="md" />
            <PlayerPortrait name="Sun Tsung" position="LD" overall={55} rarity="epico" size="md" />
            <PlayerPortrait name="Ruiz Pacheco" position="PD" overall={67} rarity="lenda" size="md" />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <PlayerPortrait name="Caue" position="ZAG" overall={52} rarity="normal" size="sm" />
            <PlayerPortrait name="Adrien Ayo" position="MC" overall={50} rarity="genesis" size="lg" />
          </div>
        </section>

        {/* COMPOSIÇÃO REAL — exemplo "Plantel" */}
        <section className="flex flex-col gap-4">
          <LegacyHeader
            eyebrow="Composição · Tela Real"
            title="Plantel Reescrito"
            subtitle="exemplo"
            align="start"
            size="md"
          />
          <DataCard
            eyebrow="Ole Football · Meu Time"
            title="Plantel Principal"
            description="Temporada 2026 · 4-3-3 tático"
            actions={
              <>
                <Button variant="primary" size="md">Escolher Formação</Button>
                <Button variant="secondary" size="md">Criar Jogador</Button>
              </>
            }
          >
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
              <StatTile value="11" label="Titulares" tone="accent" />
              <StatTile value="9" label="Reservas" />
              <StatTile value="50" label="OVR Médio" tone="success" />
            </div>
          </DataCard>
        </section>

      </div>
    </div>
  );
}
