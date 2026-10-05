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
import { L } from '@/i18n/L';

/** Campo de formulário VOLT2: asfalto chapado, canto vivo, foco em volt. */
const CAMPO = 'border border-white/16 bg-deep-black px-4 py-3.5 text-sm text-white outline-none placeholder:text-poeira focus:border-neon-yellow';

const TITLE: Record<ContributionKind, string> = {
  correcao: L('Sugerir correção', 'Suggest a fix'),
  historia: L('Contar sua história', 'Tell your story'),
  novo_card: L('Pedir um novo card', 'Request a new card'),
};

const LEDE: Record<ContributionKind, string> = {
  correcao: L('Se tem algo errado — um ano, um clube, um número — nos conte.', "If something's wrong — a year, a club, a number — let us know."),
  historia: L('Grave um áudio contando como foi: um jogo, um gol, um vestiário, uma virada.', 'Record audio telling us how it was: a match, a goal, a dressing room, a comeback.'),
  novo_card: L('Teve uma época marcante que ainda não virou card? Conte qual e a gente estuda.', "Had a standout era that isn't a card yet? Tell us which and we'll look into it."),
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
      setErr(L('Preencha ao menos o ano e o clube.', 'Fill in at least the year and the club.')); setState('error'); return;
    }
    const texto = kind === 'historia' ? (message.trim() || rec.transcript.trim()) : message.trim();
    if (kind !== 'historia' && texto.length < 5) {
      setErr(L('Conta um pouco mais pra gente entender.', 'Tell us a bit more so we understand.')); setState('error'); return;
    }
    if (kind === 'historia' && !rec.blob && texto.length < 5) {
      setErr(L('Grave um áudio ou escreva sua história.', 'Record audio or write your story.')); setState('error'); return;
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
    if (!r.ok) { setErr(r.error ?? L('Não foi possível enviar.', 'Could not send.')); setState('error'); return; }
    setState('sent');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto border border-white/10 bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {state === 'sent' ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-neon-yellow" />
            <h2 className="font-impact text-[28px] uppercase leading-[1.05]">{L('Recebemos', 'Received')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-cimento">
              {kind === 'historia'
                ? L('Sua história vai ser ouvida por uma pessoa da OLEFOOT. Obrigado por contar.', 'Someone at OLEFOOT will listen to your story. Thanks for sharing.')
                : L('Uma pessoa da OLEFOOT vai ler. Se fizer sentido, a gente ajusta.', "Someone at OLEFOOT will read it. If it makes sense, we'll fix it.")}
            </p>
            <button onClick={onClose} className="btn-primary mt-5 flex h-12 w-full items-center justify-center">
              {L('Fechar', 'Close')}
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-impact text-[28px] uppercase leading-[1.05]">{TITLE[kind]}</h2>
            <p className="mt-2 text-sm leading-relaxed text-cimento">{LEDE[kind]}</p>
            {cardName && <p className="mt-3 truncate font-mono text-[11px] uppercase tracking-wider text-poeira">{cardName}</p>}

            <div className="mt-5 space-y-3">
              {kind === 'correcao' && (
                <select
                  value={field} onChange={(e) => setField(e.target.value)}
                  className={`w-full ${CAMPO}`}
                >
                  <option value="">{L('O que está errado? (opcional)', "What's wrong? (optional)")}</option>
                  {CORRECTION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              )}

              {kind === 'novo_card' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={ano} onChange={(e) => setAno(e.target.value)} inputMode="numeric" placeholder={L('Ano (ex.: 2003)', 'Year (e.g. 2003)')}
                      className={`w-full min-w-0 ${CAMPO}`} />
                    <input value={clube} onChange={(e) => setClube(e.target.value)} placeholder={L('Clube', 'Club')}
                      className={`w-full min-w-0 ${CAMPO}`} />
                  </div>
                  <input value={pontoForte} onChange={(e) => setPontoForte(e.target.value)} placeholder={L('Seu ponto forte na época', 'Your main strength back then')}
                    className={`w-full ${CAMPO}`} />
                  <div>
                    <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder={L('Quanto você acha que vale (US$)', "What you think it's worth (US$)")}
                      className={`w-full ${CAMPO}`} />
                    <p className="mt-1.5 text-[11px] leading-snug text-cimento">
                      {L('É a sua opinião, e ela conta. O preço final é definido pela OLEFOOT junto com o resto da coleção.', 'Your opinion counts. The final price is set by OLEFOOT along with the rest of the collection.')}
                    </p>
                  </div>
                </>
              )}

              {kind === 'historia' && (
                <div className="border border-white/16 bg-deep-black p-4">
                  {rec.state === 'unsupported' || rec.state === 'denied' ? (
                    <p className="text-[12px] leading-relaxed text-cimento">
                      {rec.state === 'denied'
                        ? L('Precisamos do microfone para gravar. Libere o acesso e tente de novo — ou escreva abaixo.', 'We need the microphone to record. Allow access and try again — or write below.')
                        : L('Seu navegador não grava áudio. Sem problema: escreva sua história abaixo.', "Your browser can't record audio. No problem: write your story below.")}
                    </p>
                  ) : rec.state === 'recording' ? (
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-baixa" />
                      <span className="ole-num text-lg">{mmss(rec.seconds)}</span>
                      <button onClick={rec.stop} className="ml-auto flex items-center gap-2 border border-white/30 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:border-white">
                        <Square className="h-3.5 w-3.5" /> {L('Parar', 'Stop')}
                      </button>
                    </div>
                  ) : rec.blob ? (
                    <div className="flex items-center gap-3">
                      <audio controls src={URL.createObjectURL(rec.blob)} className="h-9 min-w-0 flex-1" />
                      <button onClick={rec.reset} className="shrink-0 p-2 text-cimento transition-colors hover:text-white" aria-label={L('Descartar gravação', 'Discard recording')}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => void rec.start()} className="btn-primary flex h-12 w-full items-center justify-center gap-2">
                      <Mic className="h-4 w-4" /> {L('Gravar', 'Record')}
                    </button>
                  )}
                  {rec.state === 'recording' && rec.interim && (
                    <p className="mt-3 text-[12px] leading-snug text-poeira">{rec.interim}</p>
                  )}
                  {rec.state !== 'idle' && !rec.canTranscribe && (
                    <p className="mt-3 text-[11px] leading-snug text-cimento">
                      {L('Seu navegador não transcreve automaticamente — mas o áudio é gravado e nós escutamos.', "Your browser doesn't auto-transcribe — but the audio is recorded and we listen to it.")}
                    </p>
                  )}
                </div>
              )}

              <textarea
                value={kind === 'historia' && !message && rec.transcript ? rec.transcript : message}
                onChange={(e) => { setMessage(e.target.value); if (state === 'error') setState('idle'); }}
                rows={kind === 'historia' ? 4 : 5}
                placeholder={
                  kind === 'correcao' ? L('Ex.: joguei no Vasco em 2005 e 2006, não só em 2005.', 'E.g. I played for Vasco in 2005 and 2006, not just 2005.')
                  : kind === 'historia' ? L('Rascunho da transcrição — corrija à vontade, ou escreva direto aqui.', 'Transcript draft — edit freely, or write here directly.')
                  : L('Conte por que essa época merece um card.', 'Tell us why this era deserves a card.')
                }
                className={`w-full resize-none ${CAMPO}`}
              />

              {kind === 'historia' && (
                <p className="text-[11px] leading-snug text-cimento">
                  {L('Ao enviar, você autoriza a OLEFOOT a usar esta história na construção do seu card. Sua voz não é publicada sem falar com você antes.', "By sending, you authorize OLEFOOT to use this story to build your card. Your voice is never published without talking to you first.")}
                </p>
              )}

              {state === 'error' && <p className="text-xs text-baixa">{err}</p>}

              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary flex h-12 flex-1 items-center justify-center px-3">
                  {L('Cancelar', 'Cancel')}
                </button>
                <button
                  onClick={() => void send()}
                  disabled={state === 'sending' || rec.state === 'recording'}
                  className="btn-primary flex h-12 flex-1 items-center justify-center px-3 disabled:opacity-50"
                >
                  {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : L('Enviar', 'Send')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
