/**
 * ManagerOfDay — módulo "Manager do Dia" do layout v3.
 *
 * Holofote dourado no LÍDER REAL do ranking da Liga Global (clube #1). Rótulo
 * honesto ("No topo agora") — NÃO inventa manager. Dados por props; se não
 * houver ranking, Home não renderiza este módulo.
 */

export function ManagerOfDay({
  clubName,
  points,
  overall,
}: {
  clubName: string;
  points: number;
  overall: number;
}) {
  return (
    <section
      aria-label="Manager do dia"
      className="relative flex flex-col justify-end overflow-hidden p-5"
      style={{
        minHeight: 220,
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(199,166,78,0.4)',
        background: 'linear-gradient(160deg,#171307,#0f0d08 60%,#0c0c0c)',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(70% 55% at 72% 20%, rgba(199,166,78,0.34), transparent 60%)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-2 right-2 select-none font-impact leading-[0.7] text-[rgba(199,166,78,0.14)]"
        style={{ fontSize: '130px' }}
      >
        1
      </span>

      <div className="relative">
        <span
          className="inline-flex items-center gap-2 font-display font-black uppercase"
          style={{ fontSize: '10px', letterSpacing: '0.24em', color: '#C7A64E' }}
        >
          <span aria-hidden className="h-0.5 w-5" style={{ background: '#C7A64E' }} />
          No topo agora
        </span>
        <div className="mt-3 flex items-center gap-3.5">
          <span
            aria-hidden
            className="h-14 w-14 flex-none rounded-full"
            style={{ background: 'linear-gradient(140deg,#3a3423,#14110a)', border: '2px solid #C7A64E' }}
          />
          <div className="min-w-0">
            <p className="truncate font-impact uppercase text-white" style={{ fontSize: '30px', lineHeight: 0.82 }}>
              {clubName}
            </p>
            <p
              className="mt-1 uppercase text-white/60"
              style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', letterSpacing: '0.14em' }}
            >
              Líder do dia · #1 no mundo
            </p>
          </div>
        </div>
        <div
          className="mt-4 flex flex-wrap gap-5 pt-3.5"
          style={{ borderTop: '1px solid rgba(199,166,78,0.25)' }}
        >
          <div className="flex flex-col">
            <span className="font-impact tabular-nums leading-none" style={{ fontSize: '24px', color: '#C7A64E' }}>
              {points.toLocaleString('pt-BR')}
            </span>
            <span
              className="mt-1 font-display font-black uppercase text-white/40"
              style={{ fontSize: '8.5px', letterSpacing: '0.12em' }}
            >
              pontos de temporada
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-impact tabular-nums leading-none" style={{ fontSize: '24px', color: '#C7A64E' }}>
              {overall}
            </span>
            <span
              className="mt-1 font-display font-black uppercase text-white/40"
              style={{ fontSize: '8.5px', letterSpacing: '0.12em' }}
            >
              overall do elenco
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
