/**
 * BarraAcao — o botão de seguir, sempre à vista, nunca em cima do conteúdo.
 *
 * Antes desta peça a barra fixa do onboarding estava copiada cinco vezes, e
 * cada cópia reservava espaço com um `pb-32` chutado. Três jeitos de o botão
 * "sumir" no celular vinham daí:
 *
 *  1. Desabilitado ele virava uma caixa transparente de borda tracejada cinza
 *     sobre fundo preto — sumia de verdade. Aqui ele continua um bloco amarelo,
 *     só mais apagado, e a linha de `ajuda` diz o que falta para liberar.
 *  2. O espaço reservado não acompanhava a safe-area nem um rótulo em duas
 *     linhas: o fim da página ficava atrás da barra. Aqui um espaçador no fluxo
 *     mede a altura real da barra (ResizeObserver) e reserva exatamente ela.
 *  3. Com o teclado aberto a barra cobria o campo (Android) ou ficava atrás do
 *     teclado (iOS). Aqui, enquanto alguém digita num aparelho de toque, a barra
 *     deixa de ser fixa e desce para o fim do conteúdo.
 */
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const CAMPOS_DE_TEXTO = new Set(['text', 'email', 'tel', 'password', 'number', 'search', 'url']);

function ehCampoDeTexto(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return CAMPOS_DE_TEXTO.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Teclado virtual aberto = campo de texto focado num aparelho de toque.
 *
 * Não dá para medir o teclado de um jeito que valha nas duas plataformas: o
 * Android (com `interactive-widget=resizes-content`) encolhe a página inteira e
 * o iOS só o `visualViewport`. O foco, sim, é igual nos dois.
 */
export function useTecladoAberto(): boolean {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    // Checado a cada foco, não na montagem: tablet com teclado acoplado e
    // DevTools emulando celular trocam de modo com a página aberta.
    const atualizar = () => {
      const toque = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      setAberto(toque && ehCampoDeTexto(document.activeElement));
    };
    document.addEventListener('focusin', atualizar);
    // `focusout` dispara antes de o próximo campo receber o foco: espera um
    // quadro para não piscar a barra ao pular de um campo para outro.
    const aoSair = () => requestAnimationFrame(atualizar);
    document.addEventListener('focusout', aoSair);
    return () => {
      document.removeEventListener('focusin', atualizar);
      document.removeEventListener('focusout', aoSair);
    };
  }, []);
  return aberto;
}

/** Tela a partir de 640px (o `sm` do Tailwind). Só observa quando `ativo`. */
function useLargo(ativo: boolean): boolean {
  const consulta = '(min-width: 640px)';
  const [largo, setLargo] = useState(() => ativo && typeof window !== 'undefined' && window.matchMedia(consulta).matches);
  useEffect(() => {
    if (!ativo) return;
    const mq = window.matchMedia(consulta);
    const atualizar = () => setLargo(mq.matches);
    atualizar();
    mq.addEventListener('change', atualizar);
    return () => mq.removeEventListener('change', atualizar);
  }, [ativo]);
  return ativo && largo;
}

type BarraAcaoProps = {
  children: ReactNode;
  /** O que falta para liberar o botão. Aparece acima dele, em uma linha. */
  ajuda?: ReactNode;
  /**
   * `'sm'`: fixa só abaixo de 640px; dali para cima a barra fica no fluxo, onde
   * a tela já tinha os botões (cadastro). Padrão: fixa sempre.
   * Os ajustes de layout para o modo largo vêm por `className`.
   */
  fixaAte?: 'sm';
  /**
   * `false`: não reserva espaço no ponto onde a barra está — para quando há
   * conteúdo depois dela (o rodapé do cadastro). A página então usa
   * `--altura-barra-acao` como padding no fim.
   */
  espacador?: boolean;
  className?: string;
};

export function BarraAcao({ children, ajuda, fixaAte, espacador = true, className }: BarraAcaoProps) {
  const barra = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState(0);
  const teclado = useTecladoAberto();
  const largo = useLargo(fixaAte === 'sm');
  const fixa = !teclado && !largo;

  useEffect(() => {
    const el = barra.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setAltura(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
    // A barra troca de pai (portal ↔ fluxo) quando `fixa` muda: é outro nó.
  }, [fixa]);

  // Só ocupa espaço no fim da página enquanto está fixa: com o teclado aberto
  // ela já está no fluxo, e reservar a altura de novo abriria um buraco.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty('--altura-barra-acao', `${fixa ? altura : 0}px`);
    return () => {
      raiz.style.removeProperty('--altura-barra-acao');
    };
  }, [fixa, altura]);

  const conteudo = (
    <div
      ref={barra}
      className={cn(
        'z-30 flex flex-col items-center gap-2',
        fixa
          ? 'fixed inset-x-0 bottom-0 bg-black/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3'
          : largo
            ? 'relative'
            : 'relative px-4 pb-4 pt-3',
        className,
      )}
    >
      {ajuda ? (
        <p
          aria-live="polite"
          className="w-full max-w-[408px] text-center font-prova text-[12px] font-bold uppercase tracking-[0.12em] text-mudo"
        >
          {ajuda}
        </p>
      ) : null}
      <div className="flex w-full max-w-[408px] gap-2">{children}</div>
    </div>
  );

  return (
    <>
      {/* Espaçador: ocupa no fluxo a altura exata da barra fixa. */}
      {fixa && espacador && <div aria-hidden style={{ height: altura }} className="shrink-0" />}
      {/* Fixa, a barra vai direto para o <body>: dentro da página ela herdava a
          camada (z-index) de algum bloco pai, e um irmão posterior — o rodapé do
          cadastro — era pintado por cima dela. */}
      {fixa ? createPortal(conteudo, document.body) : conteudo}
    </>
  );
}

/**
 * O botão principal da barra. Desabilitado continua sendo um bloco amarelo:
 * botão que some quando não pode ser tocado lê como "a tela quebrou".
 */
export function BotaoBarra({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'min-h-[56px] w-full flex-1 bg-rua px-3 font-impact text-[22px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow,opacity]',
        '[@media(hover:hover)]:hover:-translate-x-0.5 [@media(hover:hover)]:hover:-translate-y-0.5',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none [@media(hover:hover)]:disabled:hover:translate-x-0 [@media(hover:hover)]:disabled:hover:translate-y-0',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Ação secundária da barra (pular, voltar): contorno, nunca compete com a principal. */
export function BotaoBarraSecundario({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'min-h-[56px] w-full flex-1 border-2 border-linha bg-black px-3 font-impact text-[20px] uppercase leading-none text-papel [@media(hover:hover)]:hover:border-papel',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Publica a altura real de um elemento numa variável CSS do documento.
 * Usado pelo header do onboarding: o que fica fixo abaixo dele (`sticky`)
 * precisa saber onde ele termina — um número cravado erra no PWA, onde a
 * safe-area de cima soma 47–59px.
 */
export function useAlturaComoVariavel(ref: RefObject<HTMLElement | null>, variavel: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const raiz = document.documentElement;
    const ro = new ResizeObserver(() => raiz.style.setProperty(variavel, `${el.getBoundingClientRect().height}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      raiz.style.removeProperty(variavel);
    };
  }, [ref, variavel]);
}
