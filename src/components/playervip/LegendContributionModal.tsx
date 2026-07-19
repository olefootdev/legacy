/**
 * A LENDA FALA — modal único das três contribuições.
 *
 *   correcao   → aponta erro num card específico
 *   historia   → grava a própria história (áudio + rascunho de transcrição)
 *   novo_card  → pede um card de outro período da carreira
 *
 * Um modal só porque o fluxo é idêntico (escrever/gravar → enviar → aguardar
 * leitura). Três componentes seriam três lugares pra manter a mesma coisa.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mic, Square, Trash2 } from 'lucide-react';
import {
  submitContribution, uploadStoryAudio, CORRECTION_FIELDS,
  type ContributionKind,
} from '@/supabase/legendContributions';
import { useStoryRecorder } from '@/hooks/useStoryRecorder';

const YELLOW = 'var(--color-neon-yellow)';

const TITLE: Record<ContributionKind, string> = {
  correcao: 'Sugerir correção',
  historia: 'Contar sua história',
  novo_card: 'Pedir um novo card',
};

const LEDE: Record<ContributionKind, string> = {
  correcao: 'Este card é sobre você. Se tem algo errado — um ano, um clube, um número — nos conte. Ninguém sabe melhor do que quem viveu.',
  historia: 'Grave um áudio contando como foi. Um jogo, um gol, um vestiário, uma virada. É a sua voz que vira a história do card.',
  novo_card: 'Teve uma época marcante que ainda não virou card? Conte qual e a gente estuda.',
};

function mmss(total: number): string {
  const m = Math.floor(total / 60), s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function LegendContributionModal({
  kind, cardId, cardName, onClose,
}: {
  kind: ContributionKind | null;
  cardId?: string | null;
  cardName?: string;
  onClose: () => void;
}) {
  const [field, setField] = useState('');
  const [message, setMessage] = useState('');
  const [ano, setAno] = useState('');
  const [clube, setClube] = useState('');
  const [pontoForte, setPontoForte] = useState('');
  const [preco, setPreco] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  const rec = useStoryRecorder();

  useEffect(() => {
    if (kind) {
      setField(''); setMessage(''); setAno(''); setClube(''); setPontoForte(''); setPreco('');
      setState('idle'); setErr(''); rec.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  if (!kind) return null;

  async function send() {
    if (!kind) return;
    setErr('');

    if (kind === 'novo_card' && (!ano.trim() || !clube.trim())) {
      setErr('Preencha ao menos o ano e o clube.'); setState('error'); return;
    }
    const texto = kind === 'historia' ? (message.trim() || rec.transcript.trim()) : message.trim();
    if (kind !== 'historia' && texto.length < 5) {
      setErr('Conta um pouco mais pra gente entender.'); setState('error'); return;
    }
    if (kind === 'historia' && !rec.blob && texto.length < 5) {
      setErr('Grave um áudio ou escreva sua história.'); setState('error'); return;
    }

    setState('sending');

    let audioPath: string | null = null;
    if (kind === 'historia' && rec.blob) {
      const up = await uploadStoryAudio(rec.blob);
      if (up.error) { setErr(up.error); setState('error'); return; }
      audioPath = up.path ?? null;
    }

    const payload: Record<string, unknown> =
      kind === 'correcao' ? { campo: field || null }
      : kind === 'novo_card' ? { ano: ano.trim(), clube: clube.trim(), pontoForte: pontoForte.trim() || null, precoSugerido: preco.trim() || null }
      : { transcricaoAutomatica: Boolean(rec.transcript), segundos: rec.seconds };

    const r = await submitContribution({
      kind, message: texto || undefined, legacyPlayerId: cardId ?? null, payload, audioPath,
    });
    if (!r.ok) { setErr(r.error ?? 'Não foi possível enviar.'); setState('error'); return; }
    setState('sent');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#131315] p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {state === 'sent' ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-4 h-10 w-10" style={{ color: YELLOW }} />
            <h2 className="ole-headline-italic text-2xl">Recebemos</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              {kind === 'historia'
                ? 'Sua história vai ser ouvida por uma pessoa da OLEFOOT. Obrigado por contar.'
                : 'Uma pessoa da OLEFOOT vai ler. Se fizer sentido, a gente ajusta.'}
            </p>
            <button onClick={onClose} className="mt-5 w-full rounded-xl py-3.5 font-display text-sm font-black uppercase tracking-wider text-black" style={{ background: YELLOW }}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            <h2 className="ole-headline-italic text-2xl">{TITLE[kind]}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{LEDE[kind]}</p>
            {cardName && <p className="mt-3 text-[11px] uppercase tracking-wider text-white/30">{cardName}</p>}

            <div className="mt-5 space-y-3">
              {kind === 'correcao' && (
                <select
                  value={field} onChange={(e) => setField(e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-[#0c0c0d] px-4 py-3.5 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="">O que está errado? (opcional)</option>
                  {CORRECTION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              )}

              {kind === 'novo_card' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={ano} onChange={(e) => setAno(e.target.value)} inputMode="numeric" placeholder="Ano (ex.: 2003)"
                      className="rounded-xl border border-white/12 bg-[#0c0c0d] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30" />
                    <input value={clube} onChange={(e) => setClube(e.target.value)} placeholder="Clube"
                      className="rounded-xl border border-white/12 bg-[#0c0c0d] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30" />
                  </div>
                  <input value={pontoForte} onChange={(e) => setPontoForte(e.target.value)} placeholder="Seu ponto forte na época"
                    className="w-full rounded-xl border border-white/12 bg-[#0c0c0d] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30" />
                  <div>
                    <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="Quanto você acha que vale (US$)"
                      className="w-full rounded-xl border border-white/12 bg-[#0c0c0d] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30" />
                    <p className="mt-1.5 text-[11px] leading-snug text-white/30">
                      É a sua opinião, e ela conta. O preço final é definido pela OLEFOOT junto com o resto da coleção.
                    </p>
                  </div>
                </>
              )}

              {kind === 'historia' && (
                <div className="rounded-xl border border-white/12 bg-[#0c0c0d] p-4">
                  {rec.state === 'unsupported' || rec.state === 'denied' ? (
                    <p className="text-[12px] leading-relaxed text-white/50">
                      {rec.state === 'denied'
                        ? 'Precisamos do microfone para gravar. Libere o acesso e tente de novo — ou escreva abaixo.'
                        : 'Seu navegador não grava áudio. Sem problema: escreva sua história abaixo.'}
                    </p>
                  ) : rec.state === 'recording' ? (
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                      <span className="font-display text-lg font-black tabular-nums">{mmss(rec.seconds)}</span>
                      <button onClick={rec.stop} className="ml-auto flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-white/20">
                        <Square className="h-3.5 w-3.5" /> Parar
                      </button>
                    </div>
                  ) : rec.blob ? (
                    <div className="flex items-center gap-3">
                      <audio controls src={URL.createObjectURL(rec.blob)} className="h-9 min-w-0 flex-1" />
                      <button onClick={rec.reset} className="shrink-0 rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white" aria-label="Descartar gravação">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => void rec.start()} className="flex w-full items-center justify-center gap-2 rounded-lg py-3 font-display text-sm font-black uppercase tracking-wider text-black" style={{ background: YELLOW }}>
                      <Mic className="h-4 w-4" /> Gravar
                    </button>
                  )}
                  {rec.state === 'recording' && rec.interim && (
                    <p className="mt-3 text-[12px] italic leading-snug text-white/30">{rec.interim}</p>
                  )}
                  {rec.state !== 'idle' && !rec.canTranscribe && (
                    <p className="mt-3 text-[11px] leading-snug text-white/30">
                      Seu navegador não transcreve automaticamente — mas o áudio é gravado e nós escutamos.
                    </p>
                  )}
                </div>
              )}

              <textarea
                value={kind === 'historia' && !message && rec.transcript ? rec.transcript : message}
                onChange={(e) => { setMessage(e.target.value); if (state === 'error') setState('idle'); }}
                rows={kind === 'historia' ? 4 : 5}
                placeholder={
                  kind === 'correcao' ? 'Ex.: joguei no Vasco em 2005 e 2006, não só em 2005.'
                  : kind === 'historia' ? 'Rascunho da transcrição — corrija à vontade, ou escreva direto aqui.'
                  : 'Conte por que essa época merece um card.'
                }
                className="w-full resize-none rounded-xl border border-white/12 bg-[#0c0c0d] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
              />

              {kind === 'historia' && (
                <p className="text-[11px] leading-snug text-white/30">
                  Ao enviar, você autoriza a OLEFOOT a usar esta história na construção do seu card. Sua voz não é publicada sem falar com você antes.
                </p>
              )}

              {state === 'error' && <p className="text-xs text-red-400">{err}</p>}

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 rounded-xl border border-white/12 py-3.5 text-sm font-bold uppercase tracking-wider text-white/60 hover:border-white/30">
                  Cancelar
                </button>
                <button
                  onClick={() => void send()}
                  disabled={state === 'sending' || rec.state === 'recording'}
                  className="flex flex-1 items-center justify-center rounded-xl py-3.5 font-display text-sm font-black uppercase tracking-wider text-black disabled:opacity-50"
                  style={{ background: YELLOW }}
                >
                  {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
