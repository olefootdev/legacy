/**
 * O RADAR — a assinatura visual do jogador.
 *
 * ── POR QUE ELE EXISTE, JÁ TENDO OS NÚMEROS AO LADO ─────────────────────────
 * Dois atletas de OVR 79 são a mesma linha numa tabela e são jogadores
 * completamente diferentes. O polígono resolve isso sem ninguém ler nada: um
 * lateral que corre puxa a forma pra um lado, um zagueiro de cabeça fria puxa
 * pro outro. É o que faz a ficha parecer inteligente em vez de tabelada.
 *
 * DIVISÃO DE TRABALHO: aqui é FORMA, ao lado é NÚMERO. Por isso os rótulos do
 * radar não repetem os valores — os tiles logo ao lado já dizem, e imprimir
 * "84" duas vezes lado a lado só cansa a leitura.
 *
 * ── A ORDEM DOS EIXOS NÃO É ALEATÓRIA ───────────────────────────────────────
 * Vem de `ATTR_ORDER` na página: os seis do ofício primeiro (velocidade, drible,
 * finalização, passe, marcação, físico), os quatro da cabeça depois (tático,
 * mentalidade, confiança, fair play). Como o traçado começa no topo e gira no
 * sentido do relógio, isso joga o OFÍCIO na metade DIREITA e a CABEÇA na
 * ESQUERDA — e a forma passa a dizer, de relance, de que lado o jogador é forte.
 * Trocar a ordem em `ATTR_ORDER` quebra essa leitura; a legenda embaixo do
 * gráfico só aparece quando os dez eixos estão lá.
 */

export interface EixoRadar {
  key: string;
  label: string;
  value: number;
}

/** Geometria do desenho, em unidades do viewBox. */
const CX = 170;
const CY = 122;
const R = 86;
const R_ROTULO = 101;
const ANEIS = [0.25, 0.5, 0.75, 1];

const LINHA = 'rgba(237,235,228,.14)';

/** Ângulo do eixo `i`: começa no topo e gira no sentido do relógio. */
function ponto(i: number, total: number, raio: number) {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / total;
  return { x: CX + Math.cos(ang) * raio, y: CY + Math.sin(ang) * raio, cos: Math.cos(ang) };
}

function poligono(total: number, raio: number): string {
  return Array.from({ length: total }, (_, i) => {
    const p = ponto(i, total, raio);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(' ');
}

export function RadarAtributos({ eixos }: { eixos: EixoRadar[] }) {
  // Com menos de três eixos não existe polígono — existe uma linha.
  if (eixos.length < 3) return null;

  const n = eixos.length;
  const forma = eixos
    .map((e, i) => {
      const p = ponto(i, n, (Math.max(0, Math.min(100, e.value)) / 100) * R);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(' ');

  return (
    // Sangria horizontal de 22 de cada lado: "MENTALIDADE" e "FINALIZAÇÃO" são
    // os rótulos mais compridos e caem justamente nos eixos mais horizontais,
    // onde o texto sai inteiro pro lado. Sem a folga, encostam na borda e o
    // navegador corta.
    <svg
      viewBox="-22 0 384 262"
      role="img"
      aria-label={`Radar dos atributos: ${eixos.map((e) => `${e.label} ${e.value}`).join(', ')}`}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      {/* ── A teia ────────────────────────────────────────────────────────── */}
      <g fill="none" stroke={LINHA} strokeWidth="1">
        {ANEIS.map((a) => (
          <polygon key={a} points={poligono(n, R * a)} />
        ))}
        {eixos.map((e, i) => {
          const p = ponto(i, n, R);
          return <line key={e.key} x1={CX} y1={CY} x2={p.x} y2={p.y} />;
        })}
      </g>

      {/* ── A forma dele ──────────────────────────────────────────────────── */}
      <polygon
        points={forma}
        fill="var(--color-rev-yellow)"
        fillOpacity=".17"
        stroke="var(--color-rev-yellow)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {eixos.map((e, i) => {
        const p = ponto(i, n, (Math.max(0, Math.min(100, e.value)) / 100) * R);
        return <circle key={e.key} cx={p.x} cy={p.y} r="2.6" fill="var(--color-rev-yellow)" />;
      })}

      {/* ── Os rótulos ────────────────────────────────────────────────────────
          `cos` decide a ancoragem: eixo à direita ancora no início, à esquerda
          no fim, e o que cai em cima/embaixo fica centralizado. Sem isso o
          texto atravessa o desenho. */}
      {eixos.map((e, i) => {
        const p = ponto(i, n, R_ROTULO);
        const anchor = p.cos > 0.25 ? 'start' : p.cos < -0.25 ? 'end' : 'middle';
        return (
          <text
            key={e.key}
            x={p.x}
            y={p.y + 3.4}
            textAnchor={anchor}
            fill="rgba(237,235,228,.5)"
            style={{ fontSize: 9.5, letterSpacing: '.08em', fontWeight: 700 }}
          >
            {e.label.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}
