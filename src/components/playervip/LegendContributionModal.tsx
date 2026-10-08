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
import { BotaoRua } from '@/components/ui/Rua';
import { L } from '@/i18n/L';

/** Campo de formulário DS 2027: asfalto chapado, canto vivo, foco em rua. */
const CAMPO = 'border-2 border-linha bg-asfalto-27 px-4 py-3.5 font-sans text-base text-papel outline-none placeholder:text-fio focus:border-rua';

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TITLE[kind]}
        className="rua-grao max-h-[92vh] w-full min-w-0 max-w-md overflow-y-auto border-2 border-linha bg-concreto p-6 text-papel"
        onClick={(e) => e.stopPropagation()}
      >
        {state === 'sent' ? (
          <div className="flex flex-col gap-3">
            <div className="-rotate-1 self-start bg-cal px-4 py-3 text-asfalto-27 shadow-[4px_4px_0_var(--color-rua)]">
              <CheckCircle2 className="mb-1 h-6 w-6" />
              <h2 className="font-voz text-[38px] leading-[0.95]">{L('Recebemos.', 'Received.')}</h2>
            </div>
            <p className="mt-2 font-sans text-[15px] leading-relaxed text-suave">
              {kind === 'historia'
                ? L('Sua história vai ser ouvida por uma pessoa da OLEFOOT. Obrigado por contar.', 'Someone at OLEFOOT will listen to your story. Thanks for sharing.')
                : L('Uma pessoa da OLEFOOT vai ler. Se fizer sentido, a gente ajusta.', "Someone at OLEFOOT will read it. If it makes sense, we'll fix it.")}
            </p>
            <BotaoRua onClick={onClose} className="mt-3 w-full">
              {L('Fechar', 'Close')}
            </BotaoRua>
          </div>
        ) : (
          <>
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('A lenda fala', 'The legend speaks')}</span>
            <h2 className="mt-1 font-impact text-[clamp(28px,8vw,36px)] uppercase leading-[0.95]">{TITLE[kind]}</h2>
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-suave">{LEDE[kind]}</p>
            {cardName && <p className="mt-3 block min-w-0 truncate font-voz text-[24px] leading-none text-ouro-27">{cardName}</p>}

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
                    <p className="mt-1.5 font-sans text-[12px] leading-snug text-mudo">
                      {L('É a sua opinião, e ela conta. O preço final é definido pela OLEFOOT junto com o resto da coleção.', 'Your opinion counts. The final price is set by OLEFOOT along with the rest of the collection.')}
                    </p>
                  </div>
                </>
              )}

              {kind === 'historia' && (
                <div className="border-2 border-linha bg-asfalto-27 p-4">
                  {rec.state === 'unsupported' || rec.state === 'denied' ? (
                    <p className="font-sans text-[13px] leading-relaxed text-suave">
                      {rec.state === 'denied'
                        ? L('Precisamos do microfone para gravar. Libere o acesso e tente de novo — ou escreva abaixo.', 'We need the microphone to record. Allow access and try again — or write below.')
                        : L('Seu navegador não grava áudio. Sem problema: escreva sua história abaixo.', "Your browser can't record audio. No problem: write your story below.")}
                    </p>
                  ) : rec.state === 'recording' ? (
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rua" aria-hidden />
                      <span className="font-spray text-[30px] font-black leading-none tabular-nums text-papel">{mmss(rec.seconds)}</span>
                      <button type="button" onClick={rec.stop} className="ml-auto flex min-h-[44px] items-center gap-2 border-2 border-papel px-3 font-impact text-[16px] uppercase text-papel transition-colors hover:bg-papel hover:text-asfalto-27">
                        <Square className="h-3.5 w-3.5" /> {L('Parar', 'Stop')}
                      </button>
                    </div>
                  ) : rec.blob ? (
                    <div className="flex items-center gap-3">
                      <audio controls src={URL.createObjectURL(rec.blob)} className="h-9 min-w-0 flex-1" />
                      <button type="button" onClick={rec.reset} className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-mudo transition-colors hover:text-papel" aria-label={L('Descartar gravação', 'Discard recording')}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <BotaoRua onClick={() => void rec.start()} className="w-full">
                      <Mic className="h-5 w-5" /> {L('Gravar', 'Record')}
                    </BotaoRua>
                  )}
                  {rec.state === 'recording' && rec.interim && (
                    <p className="mt-3 font-sans text-[13px] leading-snug text-suave">{rec.interim}</p>
                  )}
                  {rec.state !== 'idle' && !rec.canTranscribe && (
                    <p className="mt-3 font-sans text-[12px] leading-snug text-mudo">
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
                <p className="font-sans text-[12px] leading-snug text-mudo">
                  {L('Ao enviar, você autoriza a OLEFOOT a usar esta história na construção do seu card. Sua voz não é publicada sem falar com você antes.', "By sending, you authorize OLEFOOT to use this story to build your card. Your voice is never published without talking to you first.")}
                </p>
              )}

              {state === 'error' && <p className="font-sans text-[13px] font-semibold text-baixa">{err}</p>}

              <div className="flex min-w-0 gap-2 pt-1">
                <BotaoRua variante="contorno" onClick={onClose} className="min-w-0 flex-1 px-3 text-[17px]">
                  {L('Cancelar', 'Cancel')}
                </BotaoRua>
                <BotaoRua
                  onClick={() => void send()}
                  disabled={state === 'sending' || rec.state === 'recording'}
                  className="min-w-0 flex-1 px-3 text-[17px]"
                >
                  {state === 'sending' ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{L('Enviar', 'Send')} <span aria-hidden>→</span></>}
                </BotaoRua>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
