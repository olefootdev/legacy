/**
 * PRANCHETA VIVA — o time do manager jogando enquanto ele configura (Ato 2 da
 * Fundação do Clube). O campo lê o MESMO DNA que vai pro motor
 * (`dnaDaIdentidade`): mais defesa recua a linha, pressão sobe o bloco e cerca
 * quem tem a bola, criatividade solta os pontas, posse segura a bola, vertical
 * acelera e empurra o ataque. Embaixo, os 7 eixos e o que o motor recebe.
 *
 * Canvas puro (sem lib), 1 requestAnimationFrame. Respeita reduced-motion
 * (desenha parado, sem passe).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormationSchemeId } from '@/match-engine/types';
import { dnaDaIdentidade, dnaEfetivo, dnaParaMotor, EIXOS_DNA, type DnaDoClube, type IdentidadeDoClube } from '@/club/identidade';
import { L } from '@/i18n/L';

type Slot = { r: 'GOL' | 'DEF' | 'MEI' | 'ATA'; x: number; y: number };

const FORM: Record<FormationSchemeId, { d: number[]; m: number[]; m2?: number[]; a: number[]; dx: number; mx: number; m2x?: number; ax: number }> = {
  '4-3-3': { d: [0.15, 0.38, 0.62, 0.85], m: [0.3, 0.5, 0.7], a: [0.2, 0.5, 0.8], dx: 0.22, mx: 0.45, ax: 0.7 },
  '4-4-2': { d: [0.15, 0.38, 0.62, 0.85], m: [0.15, 0.38, 0.62, 0.85], a: [0.38, 0.62], dx: 0.22, mx: 0.45, ax: 0.7 },
  '4-2-3-1': { d: [0.15, 0.38, 0.62, 0.85], m: [0.38, 0.62], m2: [0.2, 0.5, 0.8], a: [0.5], dx: 0.22, mx: 0.38, m2x: 0.56, ax: 0.72 },
  '3-5-2': { d: [0.25, 0.5, 0.75], m: [0.1, 0.32, 0.5, 0.68, 0.9], a: [0.38, 0.62], dx: 0.22, mx: 0.45, ax: 0.7 },
  '4-5-1': { d: [0.15, 0.38, 0.62, 0.85], m: [0.12, 0.31, 0.5, 0.69, 0.88], a: [0.5], dx: 0.22, mx: 0.45, ax: 0.7 },
  '5-3-2': { d: [0.1, 0.3, 0.5, 0.7, 0.9], m: [0.3, 0.5, 0.7], a: [0.38, 0.62], dx: 0.22, mx: 0.45, ax: 0.68 },
  '3-4-3': { d: [0.25, 0.5, 0.75], m: [0.15, 0.38, 0.62, 0.85], a: [0.2, 0.5, 0.8], dx: 0.22, mx: 0.45, ax: 0.7 },
};

function slots(f: FormationSchemeId): Slot[] {
  const F = FORM[f] ?? FORM['4-3-3'];
  const s: Slot[] = [{ r: 'GOL', x: 0.05, y: 0.5 }];
  F.d.forEach((y) => s.push({ r: 'DEF', x: F.dx, y }));
  F.m.forEach((y) => s.push({ r: 'MEI', x: F.mx, y }));
  (F.m2 ?? []).forEach((y) => s.push({ r: 'MEI', x: F.m2x ?? F.mx, y }));
  F.a.forEach((y) => s.push({ r: 'ATA', x: F.ax, y }));
  return s;
}

const NOME_EIXO: Record<keyof DnaDoClube, string> = {
  posse: L('Posse', 'Poss.'),
  pressao: L('Pressão', 'Press'),
  vertical: L('Vertical', 'Direct'),
  criatividade: L('Criação', 'Create'),
  solidez: L('Solidez', 'Solid'),
  disciplina: L('Discipl.', 'Discip.'),
  intensidade: L('Intens.', 'Intens.'),
};

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ri = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1));

type Pose = { lado: 0 | 1; i: number };

export function PranchetaViva({
  identidade,
  formacao,
}: {
  identidade: Pick<IdentidadeDoClube, 'pontos' | 'estilo' | 'tecnico' | 'historico' | 'treino'>;
  formacao: FormationSchemeId;
}) {
  // O que vai no payload (forma) e o que o motor efetivamente joga (× ganho).
  const forma = useMemo(() => dnaDaIdentidade(identidade), [identidade]);
  const motor = useMemo(() => dnaParaMotor(forma), [forma]);
  const dna = useMemo(() => dnaEfetivo(forma), [forma]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vivo = useRef({ dna, formacao, estilo: identidade.estilo });
  vivo.current = { dna, formacao, estilo: identidade.estilo };
  const [posse, setPosse] = useState<number | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const parado = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    let tAnt = 0;
    const bola = { de: { lado: 0, i: 7 } as Pose, para: { lado: 0, i: 8 } as Pose, prog: 0 };
    const conta = { nos: 1, eles: 1 };

    const proximo = (): Pose => {
      const { dna: d, formacao: f } = vivo.current;
      if (bola.para.lado === 0) {
        // Calibrado com o motor: perda e roubada por passe dão a mesma faixa de
        // posse que o Quick Plan entrega (DNA posse 0.88 ≈ 55–58%, não 90%).
        if (Math.random() < 0.3 - (d.posse - 0.5) * 0.2) return { lado: 1, i: ri(1, 10) };
        const sl = slots(f);
        const atual = sl[bola.para.i] ?? sl[0]!;
        const cand = sl.map((s, i) => ({ s, i })).filter((o) => o.i > 0 && o.i !== bola.para.i);
        const pesos = cand.map((o) => Math.max(0.05, 1 + (o.s.x - atual.x) * (d.vertical * 6 - 1.5)));
        let r = Math.random() * pesos.reduce((a, b) => a + b, 0);
        for (let k = 0; k < cand.length; k++) {
          r -= pesos[k]!;
          if (r <= 0) return { lado: 0, i: cand[k]!.i };
        }
        return { lado: 0, i: cand[0]!.i };
      }
      if (Math.random() < 0.3 + (d.pressao - 0.5) * 0.2) return { lado: 0, i: ri(1, 10) };
      return { lado: 1, i: ri(1, 10) };
    };

    const desenha = (ts: number) => {
      const { dna: d, formacao: f, estilo } = vivo.current;
      const W = cv.width, H = cv.height, t = ts / 1000;
      const dt = Math.min(0.05, (ts - tAnt) / 1000 || 0);
      tAnt = ts;
      if (!parado) {
        bola.prog += dt * (1.1 + d.intensidade * 0.9 + (estilo === 'longos' ? 0.4 : 0));
        if (bola.prog >= 1) {
          bola.de = bola.para;
          bola.para = proximo();
          bola.prog = 0;
          if (bola.para.lado === 0) conta.nos++; else conta.eles++;
          if (conta.nos + conta.eles > 60) { conta.nos *= 0.5; conta.eles *= 0.5; }
          setPosse(Math.round((conta.nos / (conta.nos + conta.eles)) * 100));
        }
      }
      const sl = slots(f);
      const linha = (d.pressao - d.solidez) * 0.12;
      const larg = 0.78 + d.criatividade * 0.3;
      const vagar = parado ? 0 : 0.01 + (estilo === 'liberdade' ? 0.035 : 0) + d.criatividade * 0.015;
      const comBola = bola.de.lado === 0;
      const nos = sl.map((s, i) => {
        let x = s.x + (s.r === 'GOL' ? 0 : linha + (comBola ? 0.07 : -0.03) + (s.r === 'ATA' ? d.vertical * 0.08 : 0));
        let y = 0.5 + (s.y - 0.5) * (s.r === 'GOL' ? 1 : larg);
        x += Math.sin(t * 1.3 + i * 1.7) * vagar;
        y += Math.cos(t * 1.1 + i * 2.3) * vagar * 1.4;
        return { x: clamp(x, 0.03, 0.95), y: clamp(y, 0.05, 0.95) };
      });
      const eles = slots('4-4-2').map((s, i) => ({
        x: clamp(1 - s.x + (comBola ? 0.04 : -0.05) + (parado ? 0 : Math.sin(t + i) * 0.012), 0.05, 0.97),
        y: clamp(s.y + (parado ? 0 : Math.cos(t * 0.9 + i) * 0.015), 0.05, 0.95),
      }));
      // Pressão: os mais próximos do portador adversário fecham nele.
      if (!comBola) {
        const alvo = eles[bola.de.i]!;
        nos
          .map((p, i) => ({ i, dd: Math.hypot(p.x - alvo.x, p.y - alvo.y) }))
          .filter((o) => o.i > 0)
          .sort((a, b) => a.dd - b.dd)
          .slice(0, 1 + Math.round(d.pressao * 3))
          .forEach((o) => {
            const p = nos[o.i]!;
            const k = 0.25 + d.pressao * 0.45;
            p.x += (alvo.x - p.x) * k;
            p.y += (alvo.y - p.y) * k;
          });
      }
      // Campo (concreto, linhas de giz).
      ctx.fillStyle = '#1C1C1A';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(238,233,223,.22)';
      ctx.lineWidth = 3;
      ctx.strokeRect(14, 14, W - 28, H - 28);
      ctx.beginPath(); ctx.moveTo(W / 2, 14); ctx.lineTo(W / 2, H - 14); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 58, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(14, H * 0.25, 95, H * 0.5);
      ctx.strokeRect(W - 109, H * 0.25, 95, H * 0.5);
      const P = (p: { x: number; y: number }) => [14 + p.x * (W - 28), 14 + p.y * (H - 28)] as const;
      for (const p of eles) {
        const [x, y] = P(p);
        ctx.fillStyle = '#EEE9DF';
        ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
      }
      nos.forEach((p, i) => {
        const [x, y] = P(p);
        ctx.fillStyle = i === 0 ? '#C9A13B' : '#F2E61E';
        ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0D0D0C'; ctx.lineWidth = 3; ctx.stroke();
      });
      const A = bola.de.lado === 0 ? nos[bola.de.i] : eles[bola.de.i];
      const B = bola.para.lado === 0 ? nos[bola.para.i] : eles[bola.para.i];
      if (A && B) {
        const pr = bola.prog;
        const e = pr < 0.5 ? 2 * pr * pr : 1 - Math.pow(-2 * pr + 2, 2) / 2;
        const [x, y] = P({ x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e });
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x + 2, y + 3, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(desenha);
    };
    raf = requestAnimationFrame(desenha);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section aria-label={L('Prancheta viva: teu time jogando com as escolhas atuais', 'Live board: your team playing with the current choices')} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
        <span>
          {L('Prancheta viva', 'Live board')} · <b className="font-bold text-rua">{formacao}</b>
        </span>
        <span aria-live="off">{posse != null ? L(`posse ${posse}%`, `possession ${posse}%`) : '—'}</span>
      </div>
      <canvas ref={canvasRef} width={800} height={400} className="block aspect-[2/1] w-full max-w-full bg-concreto" aria-hidden />
      <div className="grid grid-cols-7 gap-1" aria-label={L('DNA do clube', 'Club DNA')}>
        {EIXOS_DNA.map((k) => (
          <div key={k} className="flex min-w-0 flex-col gap-1">
            <div className="relative h-6 bg-linha" aria-hidden>
              <i className="absolute inset-x-0 bottom-0 bg-rua transition-[height] duration-300" style={{ height: `${Math.round(dna[k] * 100)}%` }} />
            </div>
            <span className="truncate text-center font-prova text-[9px] font-bold uppercase tracking-[0.04em] text-mudo">
              {NOME_EIXO[k]}
              <span className="sr-only"> {Math.round(dna[k] * 100)}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="font-prova text-[10.5px] leading-snug text-fio">
        → {L('motor', 'engine')}:{' '}
        {EIXOS_DNA.map((k) => `${NOME_EIXO[k].toLowerCase()} ${motor[k].toFixed(2)}`).join(' · ')}
      </p>
    </section>
  );
}
