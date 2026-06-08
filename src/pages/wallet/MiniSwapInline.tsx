export function MiniSwapInline() {
  return (
    <section
      className="relative overflow-hidden border border-white/[0.06] p-5"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-panel-elevated,#0b0b0b)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80">
            Swap Rápido
          </p>
          <h2
            className="mt-1 font-display text-[20px] font-black uppercase leading-none tracking-tight text-white sm:text-[22px]"
            style={{ letterSpacing: '0.005em' }}
          >
            Cripto → In-Game
          </h2>
        </div>
        <span className="shrink-0 rounded-full border border-neon-yellow/30 bg-neon-yellow/10 px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-neon-yellow">
          Em breve
        </span>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-white/50">
        Converta cripto em moedas do jogo diretamente na sua wallet. Paridades reais serão ativadas em breve.
      </p>
    </section>
  );
}
