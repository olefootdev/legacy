/**
 * O CAMPO — onde ele joga, desenhado.
 *
 * "LD" não diz nada pra quem não é do meio, e "Lateral-direito" só diz um pouco
 * mais. Um ponto aceso num campo diz tudo em meio segundo, e é a diferença
 * entre um perfilzinho de internet e uma peça de scouting.
 *
 * ── POR QUE VERTICAL, ATACANDO PRA CIMA ─────────────────────────────────────
 * Num campo deitado, o time que ataca pra direita tem o lado DIREITO desenhado
 * embaixo — está certo, e ninguém entende. O atleta olharia a própria ficha e
 * perguntaria por que o ponto dele está do lado errado. Em pé, atacando pra
 * cima, a direita do jogador é a direita da tela. Some a pergunta.
 *
 * ── AS MEDIDAS SÃO AS DE VERDADE ────────────────────────────────────────────
 * `viewBox` 68×105 são os metros do campo — a mesma unidade que o motor do jogo
 * usa (`src/simulation/field.ts`). Grande área 40,32 × 16,5; pequena 18,32 × 5,5;
 * círculo central 9,15 de raio. Não é campo estilizado: é campo.
 */
import { SETORES } from '../data/posicoes';

/** Onde cada sigla mora no campo, em metros. Origem no canto do gol de defesa. */
const ONDE: Record<string, { x: number; y: number }> = {
  GOL: { x: 34, y: 99 },
  ZAG: { x: 34, y: 86 },
  LD: { x: 57, y: 81 },
  LE: { x: 11, y: 81 },
  VOL: { x: 34, y: 69 },
  MC: { x: 34, y: 56 },
  MEI: { x: 34, y: 42 },
  PD: { x: 57, y: 29 },
  PE: { x: 11, y: 29 },
  ATA: { x: 34, y: 21 },
};

const TODAS = SETORES.flatMap((s) => s.posicoes.map((p) => p.code));

const LINHA = 'rgba(237,235,228,.22)';
const LINHA_FRACA = 'rgba(237,235,228,.13)';

export function CampoPosicao({ pos, className }: { pos: string | null; className?: string }) {
  const code = (pos ?? '').toUpperCase();
  const dele = ONDE[code] ?? null;

  return (
    <svg
      viewBox="0 0 68 105"
      className={className}
      role="img"
      aria-label={dele ? `Campo de futebol com a posição ${code} destacada` : 'Campo de futebol'}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <rect x="0" y="0" width="68" height="105" rx="3" fill="rgba(237,235,228,.035)" />

      {/* ── As linhas ─────────────────────────────────────────────────────── */}
      <g fill="none" stroke={LINHA} strokeWidth="0.55">
        <rect x="2.5" y="2.5" width="63" height="100" />
        <line x1="2.5" y1="52.5" x2="65.5" y2="52.5" />
        <circle cx="34" cy="52.5" r="9.15" />
        {/* Grande área — 40,32 × 16,5 */}
        <rect x="13.84" y="2.5" width="40.32" height="16.5" />
        <rect x="13.84" y="86" width="40.32" height="16.5" />
        {/* Pequena área — 18,32 × 5,5 */}
        <rect x="24.84" y="2.5" width="18.32" height="5.5" />
        <rect x="24.84" y="97" width="18.32" height="5.5" />
        {/* Gols */}
        <rect x="30.34" y="1.1" width="7.32" height="1.4" />
        <rect x="30.34" y="102.5" width="7.32" height="1.4" />
      </g>
      <g fill={LINHA}>
        <circle cx="34" cy="52.5" r="0.7" />
        <circle cx="34" cy="13.5" r="0.7" />
        <circle cx="34" cy="91.5" r="0.7" />
      </g>

      {/* ── O sentido do ataque ───────────────────────────────────────────── */}
      <text
        x="34"
        y="9"
        textAnchor="middle"
        fill={LINHA_FRACA}
        style={{ fontSize: 3.4, letterSpacing: '.09em', fontWeight: 700 }}
      >
        ATAQUE
      </text>

      {/* ── As outras posições, apagadas ──────────────────────────────────── */}
      {TODAS.filter((c) => c !== code).map((c) => (
        <circle key={c} cx={ONDE[c].x} cy={ONDE[c].y} r="1.7" fill="rgba(237,235,228,.15)" />
      ))}

      {/* ── A dele ────────────────────────────────────────────────────────── */}
      {dele && (
        <g>
          <circle cx={dele.x} cy={dele.y} r="10.5" fill="var(--color-rev-yellow)" opacity=".12" />
          <circle
            className="rev-campo-pulso"
            cx={dele.x}
            cy={dele.y}
            r="8"
            fill="none"
            stroke="var(--color-rev-yellow)"
            strokeWidth=".5"
            opacity=".45"
          />
          <circle cx={dele.x} cy={dele.y} r="6.2" fill="var(--color-rev-yellow)" />
          <text
            x={dele.x}
            y={dele.y + 1.7}
            textAnchor="middle"
            fill="#0D0D0D"
            style={{ fontSize: 4.6, fontWeight: 800, letterSpacing: '.02em' }}
          >
            {code}
          </text>
        </g>
      )}
    </svg>
  );
}
