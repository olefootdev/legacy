/**
 * Botão flutuante + modal para enviar bug/feedback dos beta testers.
 * Wire na tabela `bug_reports` via `submitBugReport`.
 */
import { useState } from 'react';
import { Bug, Send, X, Check } from 'lucide-react';
import {
  submitBugReport,
  type BugReportCategory,
  type BugReportSeverity,
} from '@/supabase/bugReports';
import { cn } from '@/lib/utils';

const CATEGORIES: { value: BugReportCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'crash', label: 'Crash' },
  { value: 'ux', label: 'UX' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'suggestion', label: 'Sugestão' },
];

const SEVERITIES: { value: BugReportSeverity; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BugReportCategory>('bug');
  const [severity, setSeverity] = useState<BugReportSeverity>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory('bug');
    setSeverity('medium');
    setDone(false);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 200);
  };

  const submit = async () => {
    if (!title.trim() || !description.trim() || submitting) return;
    setSubmitting(true);
    const row = await submitBugReport({ title, description, category, severity });
    setSubmitting(false);
    if (row) {
      setDone(true);
      setTimeout(close, 1600);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-neon-yellow text-black shadow-lg hover:scale-105 transition-transform"
        aria-label="Reportar bug"
      >
        <Bug className="h-5 w-5" strokeWidth={2.25} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#0a0a0a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <h2 className="font-display text-sm font-black uppercase tracking-wider text-white">
                Reportar bug / feedback
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-gray-500 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <Check className="mb-3 h-10 w-10 text-neon-green" />
                <p className="text-sm font-bold text-white">Obrigado! Recebemos seu feedback.</p>
              </div>
            ) : (
              <div className="space-y-3 px-5 py-4">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Categoria
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        className={cn(
                          'rounded border px-2 py-1 text-xs font-bold transition-colors',
                          category === c.value
                            ? 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow'
                            : 'border-white/10 text-gray-400 hover:border-white/30',
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Severidade
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SEVERITIES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSeverity(s.value)}
                        className={cn(
                          'rounded border px-2 py-1 text-xs font-bold transition-colors',
                          severity === s.value
                            ? 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow'
                            : 'border-white/10 text-gray-400 hover:border-white/30',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Título
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    placeholder="Resumo do problema"
                    className="w-full rounded border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-neon-yellow/60 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Descrição
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="O que aconteceu? Passos para reproduzir?"
                    className="w-full rounded border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-neon-yellow/60 outline-none resize-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={submit}
                  disabled={!title.trim() || !description.trim() || submitting}
                  className="flex w-full items-center justify-center gap-2 rounded bg-neon-yellow py-2 text-sm font-bold text-black hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
