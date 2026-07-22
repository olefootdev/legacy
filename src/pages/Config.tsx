import { motion } from 'motion/react';
import {
  Settings,
  Volume2,
  VolumeX,
  Globe,
  Trash2,
  RotateCcw,
  Monitor,
  Info,
  Lock,
  Download,
  Upload,
  Building2,
  Clock,
  Save,
  User,
  Shield,
  Check,
} from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useGameDispatch, useGameStore, getGameState } from '@/game/store';
import { cn } from '@/lib/utils';
import { StoreSectionHeadline } from '@/store/StoreSectionHeadline';
import { tryHydrateGameState } from '@/game/persistence';
import type { GraphicQualityId, ReduceMotionPreference } from '@/game/types';
import {
  hasLocalPassword,
  setLocalPassword,
  changeLocalPassword,
  clearLocalPassword,
} from '@/settings/localAccountAuth';
import { playUiChime } from '@/settings/soundFeedback';
import { useTrainerAvatarUpload } from '@/hooks/useTrainerAvatarUpload';

export function Config() {
  const dispatch = useGameDispatch();
  const clubName = useGameStore((s) => s.club.name);
  const userSettings = useGameStore((s) => s.userSettings);
  const trainerAvatar = userSettings.trainerAvatarDataUrl;
  const { onFileChange: onTrainerAvatarFile, error: trainerAvatarErr, clearAvatar } =
    useTrainerAvatarUpload();
  const trainerPhotoInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [clubDraft, setClubDraft] = useState(clubName);
  const [clubSaved, setClubSaved] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [hasPwd, setHasPwd] = useState(hasLocalPassword);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importId = useId();

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [securityExpanded, setSecurityExpanded] = useState(false);
  type SecurityMode = 'idle' | 'create' | 'change' | 'forgot';
  const [securityMode, setSecurityMode] = useState<SecurityMode>('idle');
  const [forgotConfirm, setForgotConfirm] = useState('');

  useEffect(() => {
    setClubDraft(clubName);
  }, [clubName]);

  useEffect(() => {
    setHasPwd(hasLocalPassword());
  }, [pwdMsg]);

  const resetSecurityFields = () => {
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setForgotConfirm('');
    setPwdMsg(null);
  };

  const saveClubName = useCallback(() => {
    dispatch({ type: 'SET_CLUB_NAME', name: clubDraft });
    setClubSaved(true);
    window.setTimeout(() => setClubSaved(false), 2000);
  }, [dispatch, clubDraft]);

  const toggleSound = (on: boolean) => {
    dispatch({ type: 'SET_USER_SETTINGS', partial: { soundEnabled: on } });
    if (on) playUiChime();
  };

  const setQuality = (graphicQuality: GraphicQualityId) => {
    dispatch({ type: 'SET_USER_SETTINGS', partial: { graphicQuality } });
  };

  const setReduceMotion = (reduceMotion: ReduceMotionPreference) => {
    dispatch({ type: 'SET_USER_SETTINGS', partial: { reduceMotion } });
  };

  const setBackgroundSim = (worldSimulateInBackground: boolean) => {
    dispatch({ type: 'SET_USER_SETTINGS', partial: { worldSimulateInBackground } });
  };

  const handleDefinePassword = async () => {
    setPwdMsg(null);
    if (newPw.length < 6) {
      setPwdMsg('Senha muito curta (mín. 6).');
      return;
    }
    if (newPw !== confirmPw) {
      setPwdMsg('As senhas não coincidem.');
      return;
    }
    const r = await setLocalPassword(newPw);
    setPwdMsg(r.ok ? '✓ Senha local definida.' : r.error ?? 'Erro.');
    if (r.ok) {
      resetSecurityFields();
      setSecurityMode('idle');
    }
  };

  const handleChangePassword = async () => {
    setPwdMsg(null);
    if (!currentPw.trim()) {
      setPwdMsg('Informa a senha atual.');
      return;
    }
    if (newPw.length < 6) {
      setPwdMsg('Nova senha muito curta (mín. 6).');
      return;
    }
    if (newPw !== confirmPw) {
      setPwdMsg('A nova senha e a confirmação não coincidem.');
      return;
    }
    const r = await changeLocalPassword(currentPw, newPw);
    setPwdMsg(r.ok ? '✓ Senha atualizada.' : r.error ?? 'Erro.');
    if (r.ok) {
      resetSecurityFields();
      setSecurityMode('idle');
    }
  };

  const handleForgotReset = () => {
    setPwdMsg(null);
    if (forgotConfirm.trim().toUpperCase() !== 'REMOVER') {
      setPwdMsg('Digita REMOVER (em maiúsculas) para confirmar.');
      return;
    }
    clearLocalPassword();
    setHasPwd(false);
    setPwdMsg('✓ Senha local removida. Podes definir uma nova abaixo.');
    resetSecurityFields();
    setSecurityMode('idle');
  };

  const cancelPasswordChangeFlow = () => {
    setSecurityMode('idle');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwdMsg(null);
  };

  const downloadBackup = () => {
    const data = getGameState();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `olefoot-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      alert('Ficheiro demasiado grande (máx. 6 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const next = tryHydrateGameState(text);
      if (!next) {
        alert('Save inválido ou versão incompatível.');
        return;
      }
      if (!window.confirm('Substituir o progresso atual por este backup? Não podes desfazer.')) return;
      dispatch({ type: 'IMPORT_GAME_STATE', state: next });
      setClubDraft(next.club.name);
      alert('Save importado. A página vai recarregar para aplicar tudo.');
      window.location.reload();
    };
    reader.readAsText(file);
  };

  const rowClass = 'px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 last:border-0';

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6 pb-8 overflow-x-hidden">
      <div className="px-3 sm:px-4 lg:px-8">
        <BackButton to="/manager" label="Manager" />
      </div>
      {/* ── HERO BVB — amarelo full + watermark + Agency caps + Moret italic ── */}
      <section
        aria-label="Configurações"
        className="relative w-full overflow-hidden bg-neon-yellow -mx-3 -mt-3 sm:-mx-4 sm:-mt-4 lg:-mx-8 lg:-mt-8 mb-2"
      >
        {/* Watermark */}
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <span
            className="font-display font-black uppercase whitespace-nowrap text-black/[0.05]"
            style={{
              fontSize: 'clamp(140px, 28vw, 360px)',
              lineHeight: '0.85',
              letterSpacing: '-0.05em',
            }}
          >
            CONFIG
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-14 text-center"
        >
          <div
            className="ole-eyebrow !text-black mb-5 sm:mb-6"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            <span className="!text-black">Preferências</span>
          </div>
          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.5rem, 8vw, 5.5rem)',
                letterSpacing: '0.005em',
              }}
            >
              Configurações
            </span>
            <span
              className="block italic text-black"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(1.75rem, 5.5vw, 3.5rem)',
                marginTop: '0.04em',
                letterSpacing: '-0.01em',
              }}
            >
              do seu jogo.
            </span>
          </h1>
          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />
          <p
            className="mt-5 text-black/65 mx-auto max-w-md"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(0.85rem, 1vw, 0.95rem)',
              lineHeight: 1.55,
            }}
          >
            Preferências persistidas com o teu save.
          </p>
        </motion.div>
      </section>

      <VerificationSection />

      {/* Geral */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="space-y-3"
      >
        <StoreSectionHeadline
          title="Geral"
          subtitle="Idioma, sons e preferências do app."
          className="mb-3"
        />
        <div className="bg-panel border border-white/10 rounded-sm overflow-hidden divide-y divide-white/5">
          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-gray-500" />
              <div>
                <span className="text-sm font-display font-bold text-white tracking-wider">Idioma</span>
                <p className="text-[10px] text-gray-500">Mais línguas em atualizações futuras.</p>
              </div>
            </div>
            <span className="text-xs text-gray-600 font-bold uppercase">PT-BR</span>
          </div>

          <div className={rowClass}>
            <div className="flex items-center gap-3">
              {userSettings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-gray-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-gray-500" />
              )}
              <div>
                <span className="text-sm font-display font-bold text-white tracking-wider">Sons</span>
                <p className="text-[10px] text-gray-500">Feedback sonoro na interface (ex.: confirmações).</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={userSettings.soundEnabled}
              onClick={() => toggleSound(!userSettings.soundEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${
                userSettings.soundEnabled ? 'bg-neon-yellow/80' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  userSettings.soundEnabled ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-gray-500" />
              <div>
                <span className="text-sm font-display font-bold text-white tracking-wider">Qualidade gráfica</span>
                <p className="text-[10px] text-gray-500">Efeitos do painel e densidade visual.</p>
              </div>
            </div>
            <select
              value={userSettings.graphicQuality}
              onChange={(e) => setQuality(e.target.value as GraphicQualityId)}
              className="bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white uppercase font-bold shrink-0"
            >
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>

          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-gray-500" />
              <div>
                <span className="text-sm font-display font-bold text-white tracking-wider">Animações</span>
                <p className="text-[10px] text-gray-500">Respeitar acessibilidade ou forçar movimento.</p>
              </div>
            </div>
            <select
              value={userSettings.reduceMotion}
              onChange={(e) => setReduceMotion(e.target.value as ReduceMotionPreference)}
              className="bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white font-bold shrink-0 max-w-[11rem]"
            >
              <option value="system">Sistema</option>
              <option value="reduce">Reduzir</option>
              <option value="noReduce">Normais</option>
            </select>
          </div>

          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-500" />
              <div>
                <span className="text-sm font-display font-bold text-white tracking-wider">Mundo em segundo plano</span>
                <p className="text-[10px] text-gray-500">
                  Com ativado, treinos e tempo do clube avançam ~1× por minuto mesmo com o separador em segundo plano.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={userSettings.worldSimulateInBackground}
              onClick={() => setBackgroundSim(!userSettings.worldSimulateInBackground)}
              className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${
                userSettings.worldSimulateInBackground ? 'bg-neon-yellow/80' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  userSettings.worldSimulateInBackground ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </motion.section>

      {/* Clube */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="space-y-3"
      >
        <StoreSectionHeadline
          title="Clube"
          subtitle="Identidade do seu time no save."
          className="mb-3"
        />
        <div className="bg-panel border border-white/10 rounded-sm overflow-hidden">
          <div className={rowClass}>
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-display font-bold text-white tracking-wider">Nome do clube</span>
                <p className="text-[10px] text-gray-500">Aparece em jogos, ranking e ecrãs principais.</p>
                <input
                  value={clubDraft}
                  onChange={(e) => setClubDraft(e.target.value)}
                  maxLength={48}
                  className="mt-2 w-full max-w-md bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-neon-yellow focus:outline-none"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={saveClubName}
              className="shrink-0 flex items-center gap-2 bg-neon-yellow text-black text-xs font-display font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-white transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar
            </button>
          </div>
          {clubSaved ? <p className="px-5 py-2 text-[10px] text-neon-green font-bold">Nome atualizado.</p> : null}
          <div className={rowClass}>
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-display font-bold tracking-wider text-white">
                  Foto do treinador
                </span>
                <p className="text-[10px] text-gray-500">
                  Círculo ao lado de «Bem-vindo» no topo. Incluída no backup JSON.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-black/40">
                    {trainerAvatar ? (
                      <img
                        src={trainerAvatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-7 w-7 text-white/35" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => trainerPhotoInputRef.current?.click()}
                      className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20"
                    >
                      Escolher imagem
                    </button>
                    {trainerAvatar ? (
                      <button
                        type="button"
                        onClick={clearAvatar}
                        className="shrink-0 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400/90 hover:bg-white/5"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={trainerPhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onTrainerAvatarFile}
                  />
                </div>
                {trainerAvatarErr ? (
                  <p className="mt-2 text-xs text-red-400" role="alert">
                    {trainerAvatarErr}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Segurança local */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="space-y-3"
      >
        <StoreSectionHeadline
          title="Segurança local"
          subtitle="PIN e proteção do save no dispositivo."
          className="mb-3"
        />
        <div className="bg-panel border border-white/10 rounded-sm overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (securityExpanded) {
                setSecurityMode('idle');
                resetSecurityFields();
              }
              setSecurityExpanded((v) => !v);
            }}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.02]"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Lock className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className={cn('inline-flex items-center gap-1 font-display text-sm font-bold uppercase tracking-wider', hasPwd ? 'text-neon-green' : 'text-white/70')}>
                  {hasPwd ? <><Check className="h-3.5 w-3.5" strokeWidth={2.4} /> Senha local ativa</> : 'Senha local não definida'}
                </p>
                <p className="mt-0.5 text-[11px] text-white/50">
                  PIN guardado só neste dispositivo (hash SHA-256). Não substitui login Supabase.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded border border-white/15 bg-white/5 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-white/70">
              {securityExpanded ? 'Fechar' : hasPwd ? 'Gerenciar' : 'Definir'}
            </span>
          </button>

          {securityExpanded ? (
            <div className="border-t border-white/10 px-5 py-5 space-y-4">
              {/* Sem senha → form criar */}
              {!hasPwd ? (
                <div className="max-w-md space-y-2">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Definir senha local</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Nova senha (mín. 6)"
                    className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Confirmar senha"
                    className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDefinePassword()}
                    className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-bold uppercase text-black hover:bg-white"
                  >
                    Guardar senha
                  </button>
                </div>
              ) : securityMode === 'idle' ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetSecurityFields();
                      setSecurityMode('change');
                    }}
                    className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-bold uppercase text-black hover:bg-white"
                  >
                    Trocar senha
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetSecurityFields();
                      setSecurityMode('forgot');
                    }}
                    className="rounded-lg border border-rose-500/35 bg-rose-500/5 px-4 py-2 text-xs font-bold uppercase text-rose-300 hover:bg-rose-500/10"
                  >
                    Esqueci a senha
                  </button>
                </div>
              ) : securityMode === 'change' ? (
                <div className="max-w-md space-y-2">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Trocar senha local</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="Senha atual"
                    className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Nova senha (mín. 6)"
                    className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Confirmar nova senha"
                    className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleChangePassword()}
                      className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-bold uppercase text-black hover:bg-white"
                    >
                      Atualizar senha
                    </button>
                    <button
                      type="button"
                      onClick={cancelPasswordChangeFlow}
                      className="rounded-lg bg-white/10 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-white/20"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-md space-y-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-4">
                  <div>
                    <p className="font-display text-sm font-bold uppercase tracking-wider text-rose-200">
                      Esqueci a senha
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-rose-100/70">
                      Esta é apenas um PIN deste dispositivo — não há recuperação por e-mail.
                      Podes <strong className="text-white">removê-la</strong> e definir uma nova abaixo. Para confirmar,
                      digita <strong className="text-white">REMOVER</strong>.
                    </p>
                  </div>
                  <input
                    value={forgotConfirm}
                    onChange={(e) => setForgotConfirm(e.target.value.toUpperCase())}
                    placeholder="Digite: REMOVER"
                    className="w-full rounded-lg border border-rose-500/30 bg-black/40 px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleForgotReset}
                      disabled={forgotConfirm.trim().toUpperCase() !== 'REMOVER'}
                      className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-rose-400 disabled:opacity-40"
                    >
                      Remover senha
                    </button>
                    <button
                      type="button"
                      onClick={cancelPasswordChangeFlow}
                      className="rounded-lg bg-white/10 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-white/20"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {pwdMsg ? (
                <p className="flex items-center gap-1 text-xs text-white/70">
                  {pwdMsg.startsWith('✓') ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-neon-yellow" strokeWidth={2.4} />
                  ) : null}
                  {pwdMsg.replace(/^✓\s*/, '')}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </motion.section>

      {/* Dados */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <StoreSectionHeadline
          title="Dados"
          subtitle="Backup, exportação e reset do save."
          className="mb-3"
        />
        <div className="bg-panel border border-white/10 rounded-sm overflow-hidden divide-y divide-white/5">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Download className="w-4 h-4 text-neon-yellow" />
              <div>
                <span className="text-sm font-display font-bold text-white tracking-wider">Exportar backup</span>
                <p className="text-[10px] text-gray-500">JSON com todo o progresso (inclui definições).</p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadBackup}
              className="text-xs font-display font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg shrink-0"
            >
              Descarregar
            </button>
          </div>
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Upload className="w-4 h-4 text-neon-yellow" />
              <div>
                <span className="text-sm font-display font-bold text-white tracking-wider">Restaurar backup</span>
                <p className="text-[10px] text-gray-500">Substitui o save atual. Recarrega a página a seguir.</p>
              </div>
            </div>
            <div>
              <input
                ref={fileInputRef}
                id={importId}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onImportFile}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-display font-bold uppercase tracking-wider border border-white/20 hover:bg-white/10 px-4 py-2 rounded-lg shrink-0"
              >
                Escolher ficheiro
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Conta / perigo */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="space-y-3"
      >
        <StoreSectionHeadline
          title="Sobre"
          subtitle="Versão, créditos e suporte."
          className="mb-3"
        />
        <div className="bg-panel border border-white/10 rounded-sm overflow-hidden divide-y divide-white/5">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-4 h-4 text-gray-500" />
              <div>
                <span className="text-sm font-display font-bold text-white tracking-wider">Versão</span>
                <p className="text-[10px] text-gray-500">OLEFOOT v0.11</p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-3 text-red-500 hover:text-red-400 transition-colors group w-full text-left"
              >
                <Trash2 className="w-4 h-4" />
                <div>
                  <span className="text-sm font-display font-bold tracking-wider">Resetar progresso</span>
                  <p className="text-[10px] text-gray-500 group-hover:text-gray-400">Apaga o save do jogo e recomeça do zero.</p>
                </div>
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-xs text-red-400 font-bold flex-1">Tens a certeza? Não dá para desfazer.</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'RESET' });
                      setShowResetConfirm(false);
                      setClubDraft(getGameState().club.name);
                    }}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider px-4 py-2"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.section>
    </div>
  );
}

/* ───────────────────────── Verification ──────────────────────── */

function VerificationSection() {
  const [state, setState] = useState<import('@/supabase/verification').VerificationStateRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await (await import('@/supabase/verification')).getMyVerification();
      if (!cancelled) {
        setState(s);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => {
    const s = await (await import('@/supabase/verification')).getMyVerification();
    setState(s);
    setExpanded(false);
  };

  const status = state?.verification_status ?? 'not_submitted';

  const summary = loading
    ? { label: 'Carregando…', tone: 'neutral' as const, ctaLabel: '' }
    : status === 'approved'
    ? { label: (<span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" strokeWidth={2.4} /> Conta verificada</span>), tone: 'ok' as const, ctaLabel: 'Ver dados' }
    : status === 'pending'
    ? { label: 'Em análise pelo Admin', tone: 'pending' as const, ctaLabel: 'Editar' }
    : status === 'rejected'
    ? { label: 'Verificação rejeitada', tone: 'bad' as const, ctaLabel: 'Reenviar' }
    : { label: 'Conta não verificada', tone: 'neutral' as const, ctaLabel: 'Verificar' };

  const toneClass =
    summary.tone === 'ok'
      ? 'text-neon-green'
      : summary.tone === 'pending'
      ? 'text-amber-300'
      : summary.tone === 'bad'
      ? 'text-rose-300'
      : 'text-white/70';

  return (
    <section className="space-y-3">
      <StoreSectionHeadline
        title="Verificação da conta"
        subtitle="Confirme seu e-mail e proteja seu save."
        className="mb-3"
      />
      <div className="rounded-lg border border-white/10 bg-panel overflow-hidden">
        <button
          type="button"
          onClick={() => !loading && setExpanded((v) => !v)}
          disabled={loading}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.02] disabled:cursor-default"
        >
          <div className="min-w-0 flex-1">
            <p className={cn('font-display text-sm font-bold uppercase tracking-wider', toneClass)}>
              {summary.label}
            </p>
            <p className="mt-0.5 text-[11px] text-white/50">
              {status === 'approved'
                ? 'O PRO pode sacar saldo normalmente.'
                : status === 'pending'
                ? 'Aguarda aprovação do Admin para liberar o PRO.'
                : status === 'rejected'
                ? state?.verification_rejection_reason ?? 'Revisa os dados e reenvia.'
                : 'Libera o painel PRO com seus cards e saque.'}
            </p>
          </div>
          {!loading ? (
            <span className="shrink-0 rounded border border-neon-yellow/35 bg-neon-yellow/10 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-neon-yellow">
              {expanded ? 'Fechar' : summary.ctaLabel}
            </span>
          ) : null}
        </button>
        {expanded && !loading ? (
          <div className="border-t border-white/10">
            {status === 'approved' ? (
              <div className="px-5 py-5">
                <p className="text-[12px] text-white/70">
                  Aprovado em{' '}
                  {state?.verification_reviewed_at
                    ? new Date(state.verification_reviewed_at).toLocaleString('pt-BR')
                    : '—'}
                  .
                </p>
                {state?.verification_data?.address ? (
                  <p className="mt-2 text-[11px] leading-snug text-white/55">
                    Endereço registrado:{' '}
                    {state.verification_data.address.street}, {state.verification_data.address.number} ·{' '}
                    {state.verification_data.address.city}
                    {state.verification_data.address.state ? ` — ${state.verification_data.address.state}` : ''}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="mt-4 rounded border border-white/15 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/5"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <VerificationForm
                initial={state?.verification_data ?? null}
                rejectedReason={status === 'rejected' ? state?.verification_rejection_reason ?? null : null}
                onCancel={() => setExpanded(false)}
                onSubmitted={refresh}
              />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type AddrDraft = import('@/supabase/verification').VerificationAddress;

function VerificationForm({
  initial,
  rejectedReason,
  onCancel,
  onSubmitted,
}: {
  initial: import('@/supabase/verification').VerificationData | null;
  rejectedReason: string | null;
  onCancel?: () => void;
  onSubmitted: () => void;
}) {
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [addr, setAddr] = useState<AddrDraft>(() => initial?.address ?? {
    international: false,
    zip: '',
    street: '',
    number: '',
    complement: '',
    city: '',
    state: '',
    country: 'BR',
  });
  const [contractText, setContractText] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [cepLookupErr, setCepLookupErr] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const lookupZip = async () => {
    if (addr.international) return;
    setCepLookupErr(null);
    setCepLoading(true);
    try {
      const m = await import('@/supabase/verification');
      const r = await m.lookupCepBR(addr.zip);
      if (!r) return;
      if (r.error) {
        setCepLookupErr(r.error);
        return;
      }
      setAddr((a) => ({
        ...a,
        street: r.street ?? a.street,
        city: r.city ?? a.city,
        state: r.state ?? a.state,
      }));
    } finally {
      setCepLoading(false);
    }
  };

  const toggleInternational = (on: boolean) => {
    setAddr((a) => ({
      ...a,
      international: on,
      zip: on ? '000000000-00' : '',
      country: on ? '' : 'BR',
    }));
    setCepLookupErr(null);
  };

  const contractValid = contractText.trim().toUpperCase() === 'CONTRATO';
  const baseValid =
    birthDate.length === 10 &&
    addr.street.trim().length > 0 &&
    addr.number.trim().length > 0 &&
    addr.city.trim().length > 0 &&
    (addr.international ? addr.country.trim().length > 0 : addr.state.trim().length === 2) &&
    (addr.international || addr.zip.replace(/\D/g, '').length === 8 || addr.zip === '000000000-00');

  const canSubmit = baseValid && contractValid && acceptTerms && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitErr(null);
    setSubmitting(true);
    try {
      const m = await import('@/supabase/verification');
      const r = await m.submitVerification({
        birthDate,
        address: addr,
        contractAcceptedAt: new Date().toISOString(),
      });
      if (!r.ok) {
        setSubmitErr(r.error ?? 'Falha ao enviar verificação.');
        return;
      }
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:border-neon-yellow/50 focus:outline-none';

  return (
    <div className="px-5 py-5 space-y-4">
      <div>
        <p className="font-display text-sm font-bold uppercase tracking-wider text-white">
          {rejectedReason ? 'Reenviar verificação' : 'Preencha seus dados'}
        </p>
        <p className="mt-1 text-[11px] text-white/55">
          Necessário para liberar o painel <strong className="text-white">PRO</strong> (saque de vendas). Aprovação pelo Admin.
        </p>
        {rejectedReason ? (
          <div className="mt-2 rounded border border-rose-500/35 bg-rose-500/[0.08] px-3 py-2 text-[11px] text-rose-200">
            <strong className="uppercase text-rose-300">Rejeitado:</strong> {rejectedReason}
          </div>
        ) : null}
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/55">Data de nascimento</span>
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} required />
      </label>

      <div className="flex items-center gap-2">
        <input
          id="addr-international"
          type="checkbox"
          checked={addr.international}
          onChange={(e) => toggleInternational(e.target.checked)}
          className="h-4 w-4 accent-neon-yellow"
        />
        <label htmlFor="addr-international" className="text-[11px] font-bold uppercase tracking-wider text-white/70">
          Endereço internacional
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/55">
            {addr.international ? 'Código postal' : 'CEP'}
          </span>
          <div className="flex gap-2">
            <input
              value={addr.zip}
              onChange={(e) => setAddr((a) => ({ ...a, zip: e.target.value }))}
              className={inputCls}
              placeholder={addr.international ? '—' : '00000-000'}
              disabled={addr.international}
            />
            {!addr.international ? (
              <button
                type="button"
                onClick={lookupZip}
                disabled={cepLoading}
                className="shrink-0 rounded border border-neon-yellow/40 bg-neon-yellow/10 px-3 font-display text-[10px] font-bold uppercase tracking-wider text-neon-yellow hover:bg-neon-yellow/20 disabled:opacity-40"
              >
                {cepLoading ? '…' : 'Buscar'}
              </button>
            ) : null}
          </div>
          {cepLookupErr ? <p className="mt-1 text-[10px] text-rose-300">{cepLookupErr}</p> : null}
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/55">País</span>
          <input
            value={addr.country}
            onChange={(e) => setAddr((a) => ({ ...a, country: e.target.value.toUpperCase().slice(0, 3) }))}
            className={inputCls}
            placeholder={addr.international ? 'US, PT, ES…' : 'BR'}
            disabled={!addr.international}
            maxLength={3}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/55">Rua / logradouro</span>
          <input value={addr.street} onChange={(e) => setAddr((a) => ({ ...a, street: e.target.value }))} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/55">Número</span>
          <input value={addr.number} onChange={(e) => setAddr((a) => ({ ...a, number: e.target.value }))} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/55">Complemento</span>
          <input value={addr.complement ?? ''} onChange={(e) => setAddr((a) => ({ ...a, complement: e.target.value }))} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/55">Cidade</span>
          <input value={addr.city} onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/55">
            {addr.international ? 'Região / estado' : 'UF'}
          </span>
          <input
            value={addr.state}
            onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value.toUpperCase().slice(0, addr.international ? 20 : 2) }))}
            className={inputCls}
            maxLength={addr.international ? 20 : 2}
          />
        </label>
      </div>

      <div className="rounded border border-white/10 bg-black/30 p-3">
        <p className="font-display text-[10px] font-bold uppercase tracking-wider text-white/70">Contrato de venda</p>
        <p className="mt-1 text-[11px] leading-snug text-white/60">
          Ao assinar, confirma que os dados acima são verdadeiros e concorda com a cláusula de splits de pagamento
          descrita nos termos da Olefoot. Para aceitar, digita a palavra <strong className="text-neon-yellow">CONTRATO</strong> abaixo.
        </p>
        <input
          value={contractText}
          onChange={(e) => setContractText(e.target.value.toUpperCase())}
          className={`${inputCls} mt-2`}
          placeholder="Digite: CONTRATO"
        />
        <label className={`mt-3 flex items-center gap-2 text-[11px] ${contractValid ? 'text-white/80' : 'text-white/40 cursor-not-allowed'}`}>
          <input
            type="checkbox"
            checked={acceptTerms}
            disabled={!contractValid}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="h-4 w-4 accent-neon-yellow"
          />
          <span>Aceito os termos de venda da Olefoot.</span>
        </label>
      </div>

      {submitErr ? (
        <p className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{submitErr}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submit()}
          className="flex-1 rounded bg-neon-yellow px-4 py-2.5 font-display text-xs font-black uppercase tracking-wider text-black hover:bg-white disabled:opacity-40"
        >
          {submitting ? 'Enviando…' : 'Enviar para verificação'}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-white/15 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
