/**
 * A marca visual do SELO DO OLE SCOUT.
 *
 * ── POR QUE É DESENHO, E NÃO MAIS UM CHIP DE TEXTO ──────────────────────────
 * A vitrine já tem chip pra "Subindo", "Em alta", "Card pronto" e "Novo". Mais
 * um retângulo escrito some no meio — e este precisa do contrário: ele é a
 * única marca da página que diz que uma PESSOA conferiu aquilo. Escudo com o
 * visto dentro é a forma que a cabeça já lê como "verificado" sem legenda.
 *
 * Duas medidas só: `sm` pro canto do card na vitrine, `md` pro lado do nome no
 * perfil. Sem tamanho intermediário — três variações de um selo viram três
 * selos diferentes na memória de quem vê.
 */
export function SeloScout({
  size = 'sm',
  titulo = 'Ficha completa e avaliada pelo OLE SCOUT',
}: {
  size?: 'sm' | 'md';
  titulo?: string;
}) {
  const px = size === 'md' ? 30 : 22;
  return (
    <span
      role="img"
      aria-label={titulo}
      title={titulo}
      className="inline-flex shrink-0 align-middle"
      style={{ width: px, height: px, lineHeight: 0 }}
    >
      <svg viewBox="0 0 24 24" width={px} height={px} fill="none" aria-hidden>
        <path
          d="M12 1.8 3.6 5v6.4c0 5.2 3.6 9.4 8.4 10.8 4.8-1.4 8.4-5.6 8.4-10.8V5L12 1.8Z"
          fill="var(--color-rev-yellow)"
          stroke="#0D0D0D"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path
          d="m8 12.2 2.7 2.7L16.2 9.4"
          stroke="#0D0D0D"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
