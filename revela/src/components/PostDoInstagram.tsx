/**
 * O POST EM DESTAQUE — o lance que o atleta escolheu mostrar.
 *
 * ── ELE SE MEDE SOZINHO ─────────────────────────────────────────────────────
 * O embed do Instagram tem altura variável (foto quadrada, vídeo vertical,
 * carrossel com legenda longa) e o iframe não sabe disso. O `embed.js` oficial
 * resolve escutando um `postMessage` que o próprio embed dispara com a altura
 * medida — e é só isso que aquela biblioteca de 100 KB faz de útil aqui. Então
 * a gente escuta direto e não carrega script de terceiro nenhum.
 *
 * A mensagem vem como `{"type":"MEASURE","details":{"height":N}}`, às vezes
 * como string e às vezes como objeto, dependendo da versão que o Instagram
 * serve. As duas formas são tratadas.
 *
 * ── FILTRO DE ORIGEM ────────────────────────────────────────────────────────
 * `window.message` é um canal aberto: qualquer iframe da página pode gritar. Se
 * a gente aceitasse qualquer mensagem, um anúncio de terceiro poderia esticar
 * este bloco. Só instagram.com passa.
 */
import { useEffect, useRef, useState } from 'react';

const ALTURA_INICIAL = 480;

export function PostDoInstagram({ embed, titulo }: { embed: string; titulo: string }) {
  const [altura, setAltura] = useState(ALTURA_INICIAL);
  const ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function aoReceber(e: MessageEvent) {
      if (!/^https?:\/\/(www\.)?instagram\.com$/.test(e.origin)) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        const h = Number(d?.details?.height);
        // Teto de 1400: embed com legenda quilométrica não pode empurrar o
        // resto da página pra fora da tela.
        if (d?.type === 'MEASURE' && h > 100) setAltura(Math.min(h, 1400));
      } catch {
        /* mensagem que não é do embed: ignora */
      }
    }
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, []);

  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: 'var(--radius-rev-card)',
        border: '1px solid rgba(237,235,228,.12)',
        background: '#fff',
      }}
    >
      <iframe
        ref={ref}
        src={embed}
        title={titulo}
        loading="lazy"
        scrolling="no"
        allow="encrypted-media; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups"
        style={{ display: 'block', width: '100%', height: altura, border: 0, transition: 'height .3s ease' }}
      />
    </div>
  );
}
