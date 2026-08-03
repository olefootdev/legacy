/**
 * Primitivos do REVELA — os tijolos que todas as seções reusam.
 *
 * Regra: nenhum destes conhece dado de negócio. Recebem props e desenham.
 * Quem sabe o que é um talento é a seção, não o primitivo.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { imagemOtimizada, srcSetOtimizado } from '../data/images';
import type { CardStatus, RevelaAttributes } from '../data/types';

/* ══ Números ═══════════════════════════════════════════════════════════════ */

export function ptBr(n: number): string {
  return n.toLocaleString('pt-BR');
}

/**
 * Contagem crescente ao entrar na tela.
 *
 * Anima só uma vez e respeita prefers-reduced-motion — número que fica pulando
 * a cada scroll vira ruído, não destaque.
 */
export function useCountUp(target: number, durationMs = 1500): number {
  const [value, setValue] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (target <= 0) {
      setValue(0);
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setValue(target);
      done.current = true;
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic: sobe rápido e assenta — leitura esportiva, não elástica.
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
      else done.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

/** Dispara `true` na primeira vez que o elemento aparece na viewport. */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  return { ref, seen };
}

/* ══ Rótulos ═══════════════════════════════════════════════════════════════ */

export function Eyebrow({
  children,
  on = 'dark',
  className = '',
}: {
  children: ReactNode;
  on?: 'dark' | 'yellow' | 'light';
  className?: string;
}) {
  const color = on === 'yellow' || on === 'light' ? 'rgba(13,13,13,.62)' : 'rgba(237,235,228,.58)';
  return (
    <span
      className={`rev-eyebrow ${className}`}
      data-on={on === 'yellow' ? 'yellow' : undefined}
      style={{ color }}
    >
      {children}
    </span>
  );
}

/* ══ Adesivo de status ═════════════════════════════════════════════════════ */

/**
 * Vocabulário de status. Cada cor tem função — não existe adesivo decorativo.
 *   NEW      acabou de entrar          RISING   subindo em apoios
 *   HOT      pico de apoio na semana   VERIFICADO conta validada
 *   SCOUTED  ficha do OLE SCOUT        CARD READY já virou card
 */
const STATUS_STYLE: Record<CardStatus, { bg: string; fg: string; label: string }> = {
  new: { bg: '#EDEBE4', fg: '#0D0D0D', label: 'Novo' },
  rising: { bg: '#FDE100', fg: '#0D0D0D', label: 'Subindo' },
  hot: { bg: '#EF4444', fg: '#FFFFFF', label: 'Em alta' },
  verified: { bg: '#22C55E', fg: '#0D0D0D', label: 'Verificado' },
  scouted: { bg: '#0D0D0D', fg: '#FDE100', label: 'Avaliado' },
  'card-ready': { bg: '#FDE100', fg: '#0D0D0D', label: 'Card pronto' },
};

/* ══ Selo de LEGEND ════════════════════════════════════════════════════════ */

/**
 * Ex-atleta na vitrine (`gameSituation === 'lenda'`).
 *
 * NÃO entra no vocabulário de adesivos acima de propósito. Aqueles medem
 * TRAJETÓRIA — quem acabou de chegar, quem está subindo, quem bombou na semana.
 * A trajetória de um ex-atleta já aconteceu: chamá-lo de "Novo" seria apagar a
 * carreira dele. Este selo diz QUEM é a pessoa, não em que pé está o cadastro,
 * então mora no canto oposto e usa o itálico serifado, que no REVELA é
 * reservado a lenda.
 *
 * O ex-atleta continua na mesma vitrine, recebendo apoio e entrando no ranking
 * da semana como qualquer outro — decisão do fundador. O selo é reconhecimento,
 * não separação.
 */
export function LegendMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="rev-editorial inline-flex items-center"
      style={{
        background: '#0D0D0D',
        color: 'var(--color-rev-yellow)',
        border: '1px solid rgba(253,225,0,.5)',
        borderRadius: 4,
        padding: compact ? '3px 7px' : '4px 10px',
        fontSize: compact ? 12 : 15,
        letterSpacing: '.02em',
        lineHeight: 1,
      }}
    >
      Legend
    </span>
  );
}

/** Único lugar que decide se um talento é ex-atleta. */
export function ehLenda(gameSituation: string | null | undefined): boolean {
  return gameSituation === 'lenda';
}

export function Sticker({ status, rotate = 0 }: { status: CardStatus; rotate?: number }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="rev-sticker"
      style={{
        background: s.bg,
        color: s.fg,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
    >
      {s.label}
    </span>
  );
}

/* ══ Foto ══════════════════════════════════════════════════════════════════ */

/**
 * Retrato com ponto focal. `focusX/focusY` vêm do banco (o admin arrasta o
 * enquadramento) — sem isso, corte quadrado decapita metade das lendas.
 *
 * `width` é a largura de LAYOUT em que este retrato aparece, não a do arquivo:
 * a partir dela o gateway do Pinata entrega a versão certa, em webp, com 1x/2x
 * pra retina (ver data/images.ts). Passar largura errada não quebra nada — só
 * gasta banda à toa, que era exatamente o problema antes: pedíamos o PNG
 * original de 2,4 MB para desenhar num card de 286px.
 *
 * `priority` desliga o lazy-load. Use só no retrato do hero: ele está acima da
 * dobra e lazy ali atrasa a primeira coisa que a pessoa vê.
 */
export function Portrait({
  src,
  alt,
  ratio = '3 / 4',
  focusX = 0.5,
  focusY = 0.12,
  grayscale = false,
  className = '',
  width = 320,
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  ratio?: string;
  focusX?: number;
  focusY?: number;
  grayscale?: boolean;
  className?: string;
  width?: number;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(src) && !failed;
  const otimizada = imagemOtimizada(src, { width, quality: 82 });
  const srcSet = srcSetOtimizado(src, width);

  return (
    <div
      className={`relative overflow-hidden bg-[#0c0c0d] ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {show ? (
        <img
          src={otimizada ?? (src as string)}
          srcSet={srcSet}
          alt={alt}
          width={width}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          style={{
            objectPosition: `${focusX * 100}% ${focusY * 100}%`,
            filter: grayscale ? 'grayscale(1) contrast(1.06)' : undefined,
          }}
        />
      ) : (
        // Sem foto ainda: iniciais em Anton. Melhor que um ícone genérico de
        // "usuário" — mantém a página parecendo pôster, não formulário.
        <div className="grid h-full w-full place-items-center bg-[#161616]">
          <span
            className="rev-display select-none"
            style={{ fontSize: 'clamp(38px,7vw,72px)', color: 'rgba(237,235,228,.14)' }}
          >
            {initials(alt)}
          </span>
        </div>
      )}
      {/* Scrim: garante legibilidade do nome sobre qualquer foto. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(13,13,13,.92) 0%, rgba(13,13,13,0) 58%)' }}
      />
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ══ Atributos ═════════════════════════════════════════════════════════════ */

export const ATTR_LABEL: Record<string, string> = {
  passe: 'Passe',
  marcacao: 'Marcação',
  velocidade: 'Velocidade',
  drible: 'Drible',
  finalizacao: 'Finalização',
  fisico: 'Físico',
  tatico: 'Tático',
  mentalidade: 'Mentalidade',
  confianca: 'Confiança',
  fairPlay: 'Fair play',
};

/** Barra que cresce de 0 até o valor quando revelada. */
export function AttrBar({
  label,
  value,
  active,
  tone = 'yellow',
}: {
  label: string;
  value: number;
  active: boolean;
  tone?: 'yellow' | 'bone';
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3">
      <span
        className="rev-label shrink-0 text-[10px]"
        style={{ width: 78, color: 'rgba(237,235,228,.62)' }}
      >
        {label}
      </span>
      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/12">
        <div
          className="h-full rounded-full"
          style={{
            width: active ? `${pct}%` : '0%',
            background: tone === 'yellow' ? 'var(--color-rev-yellow)' : 'var(--color-rev-bone)',
            transition: 'width .8s var(--ease-rev)',
          }}
        />
      </div>
      <span className="rev-display shrink-0 text-[13px] tabular-nums" style={{ width: 26 }}>
        {pct}
      </span>
    </div>
  );
}

/**
 * Escolhe os 3 atributos que mais dizem sobre o jogador naquela posição.
 * Mostrar os 10 numa hover card é tabela, não retrato.
 */
const KEY_ATTRS_BY_POS: Record<string, string[]> = {
  GOL: ['marcacao', 'fisico', 'tatico'],
  ZAG: ['marcacao', 'fisico', 'tatico'],
  LE: ['velocidade', 'marcacao', 'drible'],
  LD: ['velocidade', 'marcacao', 'drible'],
  LAT: ['velocidade', 'marcacao', 'drible'],
  VOL: ['marcacao', 'passe', 'tatico'],
  MC: ['passe', 'tatico', 'marcacao'],
  MEI: ['passe', 'drible', 'finalizacao'],
  PE: ['velocidade', 'drible', 'finalizacao'],
  PD: ['velocidade', 'drible', 'finalizacao'],
  PON: ['velocidade', 'drible', 'finalizacao'],
  ATA: ['finalizacao', 'velocidade', 'drible'],
};

export function keyAttrs(pos: string, attrs: RevelaAttributes): Array<{ key: string; label: string; value: number }> {
  const keys = KEY_ATTRS_BY_POS[pos?.toUpperCase()] ?? ['passe', 'velocidade', 'finalizacao'];
  return keys
    .map((k) => ({ key: k, label: ATTR_LABEL[k] ?? k, value: Number(attrs?.[k as keyof RevelaAttributes] ?? 0) }))
    .filter((a) => a.value > 0);
}

/* ══ Toast ═════════════════════════════════════════════════════════════════ */

export interface ToastMessage {
  id: number;
  title: string;
  body?: string;
  tone?: 'yellow' | 'green';
}

export function Toast({ message }: { message: ToastMessage | null }) {
  if (!message) return null;
  const green = message.tone === 'green';
  return (
    <div
      key={message.id}
      role="status"
      aria-live="polite"
      className="rev-anim-toast fixed bottom-6 left-1/2 z-[80] max-w-[92vw]"
      style={{
        background: green ? 'var(--color-rev-success)' : 'var(--color-rev-yellow)',
        color: '#0D0D0D',
        border: '3px solid #0D0D0D',
        borderRadius: 'var(--radius-rev-btn)',
        boxShadow: 'var(--shadow-rev-md)',
        padding: '12px 20px',
      }}
    >
      <p className="rev-label text-[12px]">{message.title}</p>
      {message.body && <p className="mt-1 text-[12px] leading-snug opacity-75">{message.body}</p>}
    </div>
  );
}

/** Fila de toast com auto-dismiss. Um por vez — dois empilhados viram spam. */
export function useToast(ms = 2600) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), ms);
    return () => clearTimeout(t);
  }, [message, ms]);

  const push = useMemo(
    () => (title: string, body?: string, tone: 'yellow' | 'green' = 'yellow') => {
      seq.current += 1;
      setMessage({ id: seq.current, title, body, tone });
    },
    [],
  );

  return { message, push };
}

/* ══ Selo de OVR ═══════════════════════════════════════════════════════════ */

/**
 * O OVR é o número mais importante do card. Playfair porque é nota, não dado
 * de tabela — a mesma regra que separa nome próprio de rótulo.
 */
export function OvrBadge({
  value,
  tone = 'dark',
  style,
}: {
  value: number | null;
  tone?: 'dark' | 'yellow';
  style?: CSSProperties;
}) {
  if (value == null) return null;
  const dark = tone === 'dark';
  return (
    <span
      className="inline-flex items-baseline gap-1 rounded-lg px-2.5 py-1"
      style={{
        background: dark ? 'rgba(13,13,13,.86)' : 'var(--color-rev-yellow)',
        color: dark ? 'var(--color-rev-yellow)' : '#0D0D0D',
        backdropFilter: dark ? 'blur(4px)' : undefined,
        ...style,
      }}
    >
      <span
        style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontWeight: 800, fontSize: 20, lineHeight: 1 }}
      >
        {value}
      </span>
      <span className="rev-label text-[9px] opacity-70">OVR</span>
    </span>
  );
}
