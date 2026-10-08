import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';
import { VERACITY_PILLARS, veracityPillarTooltip, type VeracityPillarDef } from '@/lib/veracityPillarsMap';

const DOT: Record<VeracityPillarDef['id'], string> = {
  active_attrs: 'bg-papel',
  team_match_impact: 'bg-rua',
  evolution: 'bg-ouro-27',
};

function PillarChip({ def }: { def: VeracityPillarDef }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1  border border-linha bg-concreto px-1.5 py-0.5"
      title={veracityPillarTooltip(def)}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[def.id])} aria-hidden />
      <span className="min-w-0 truncate font-medium text-suave">{def.label}</span>
    </span>
  );
}

/**
 * Indicadores compactos dos três pilares de veracidade (tooltip = mapa no código).
 * Tipografia deliberadamente pequena para não competir com o layout existente.
 */
export function VeracityPillarsStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[9px] leading-tight text-gray-500 sm:text-[10px]',
        className,
      )}
      role="note"
      aria-label={L(
        'Rastreabilidade Olefoot: atributos em campo, impacto no XI e evolução. Passe o rato sobre cada etiqueta para ver onde é calculado no código.',
        'Olefoot traceability: on-pitch attributes, XI impact and progression. Hover each tag to see where it is calculated in the code.',
      )}
    >
      <span className="shrink-0 font-semibold uppercase tracking-wide text-gray-600">{L('Veracidade', 'Veracity')}</span>
      <span className="text-gray-600" aria-hidden>
        ·
      </span>
      {VERACITY_PILLARS.map((def) => (
        <Fragment key={def.id}>
          <PillarChip def={def} />
        </Fragment>
      ))}
    </div>
  );
}
