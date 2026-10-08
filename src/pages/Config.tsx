import { L, LOCALE, emIngles } from '@/i18n/L';

/** Palavras digitadas pra confirmar (só UI; nada é gravado). */
const PALAVRA_REMOVER = L('REMOVER', 'REMOVE');
const PALAVRA_CONTRATO = L('CONTRATO', 'CONTRACT');
import { SeletorDeIdioma } from '@/components/ui/SeletorDeIdioma';
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
import { SecaoRua } from '@/components/ui';
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
      setPwdMsg(L('Senha muito curta (mín. 6).', 'Password too short (min. 6).'));
      return;
    }
    if (newPw !== confirmPw) {
      setPwdMsg(L('As senhas não coincidem.', "Passwords don't match."));
      return;
    }
    const r = await setLocalPassword(newPw);
    setPwdMsg(r.ok ? L('✓ Senha local definida.', '✓ Local password set.') : r.error ?? L('Erro.', 'Error.'));
    if (r.ok) {
      resetSecurityFields();
      setSecurityMode('idle');
    }
  };

  const handleChangePassword = async () => {
    setPwdMsg(null);
    if (!currentPw.trim()) {
      setPwdMsg(L('Informa a senha atual.', 'Enter your current password.'));
      return;
    }
    if (newPw.length < 6) {
      setPwdMsg(L('Nova senha muito curta (mín. 6).', 'New password too short (min. 6).'));
      return;
    }
    if (newPw !== confirmPw) {
      setPwdMsg(L('A nova senha e a confirmação não coincidem.', "New password and confirmation don't match."));
      return;
    }
    const r = await changeLocalPassword(currentPw, newPw);
    setPwdMsg(r.ok ? L('✓ Senha atualizada.', '✓ Password updated.') : r.error ?? L('Erro.', 'Error.'));
    if (r.ok) {
      resetSecurityFields();
      setSecurityMode('idle');
    }
  };

  const handleForgotReset = () => {
    setPwdMsg(null);
    if (forgotConfirm.trim().toUpperCase() !== PALAVRA_REMOVER) {
      setPwdMsg(L('Digita REMOVER (em maiúsculas) para confirmar.', 'Type REMOVE (in capitals) to confirm.'));
      return;
    }
    clearLocalPassword();
    setHasPwd(false);
    setPwdMsg(L('✓ Senha local removida. Podes definir uma nova abaixo.', '✓ Local password removed. You can set a new one below.'));
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
      alert(L('Ficheiro demasiado grande (máx. 6 MB).', 'File too large (max. 6 MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const next = tryHydrateGameState(text);
      if (!next) {
        alert(L('Save inválido ou versão incompatível.', 'Invalid save or incompatible version.'));
        return;
      }
      if (!window.confirm(L('Substituir o progresso atual por este backup? Não podes desfazer.', "Replace current progress with this backup? This can't be undone."))) return;
      dispatch({ type: 'IMPORT_GAME_STATE', state: next });
      setClubDraft(next.club.name);
      alert(L('Save importado. A página vai recarregar para aplicar tudo.', 'Save imported. The page will reload to apply everything.'));
      window.location.reload();
    };
    reader.readAsText(file);
  };

  const rowClass = 'px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-linha last:border-0';

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6 pb-8 overflow-x-hidden px-3 sm:px-4">
      <div className="px-3 sm:px-4 lg:px-8">
        <BackButton to="/manager" label="Manager" />
      </div>
      {/* ── HERO — o grito em Anton, a frase na voz ── */}
      <motion.section
        aria-label={L('Configurações', 'Settings')}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-2 border-b-2 border-papel px-3 pb-4 sm:px-4 lg:px-8"
      >
        <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-mudo">
          — {L('Sua conta', 'Your account')}
        </span>
        <h1 className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(44px, 13vw, 84px)' }}>
          {L('Configurações', 'Settings')}
        </h1>
        <p className="font-voz text-[clamp(22px,6.4vw,28px)] leading-[1.05] text-suave">{L('Do teu jeito.', 'Your way.')}</p>
      </motion.section>

      <VerificationSection />

      {/* Geral */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="space-y-3"
      >
        <SecaoRua label={L('Geral', 'General')} className="mb-3" />
        <div className="bg-concreto overflow-hidden divide-y divide-linha">
          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-mudo" />
              <div>
                <span className="font-impact text-[17px] uppercase leading-[1.1] text-papel">{L('Idioma', 'Language')}</span>
                <p className="text-[10px] text-mudo">{L('Português ou inglês.', 'Portuguese or English.')}</p>
              </div>
            </div>
            <SeletorDeIdioma />
          </div>

          <div className={rowClass}>
            <div className="flex items-center gap-3">
              {userSettings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-mudo" />
              ) : (
                <VolumeX className="w-4 h-4 text-mudo" />
              )}
              <div>
                <span className="font-impact text-[17px] uppercase leading-[1.1] text-papel">{L('Sons', 'Sounds')}</span>
                <p className="text-[10px] text-mudo">{L('Feedback sonoro na interface (ex.: confirmações).', 'Interface sound feedback (e.g. confirmations).')}</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={userSettings.soundEnabled}
              onClick={() => toggleSound(!userSettings.soundEnabled)}
              className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${
                userSettings.soundEnabled ? 'bg-rua' : 'bg-linha'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-papel rounded-full transition-transform ${
                  userSettings.soundEnabled ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-mudo" />
              <div>
                <span className="font-impact text-[17px] uppercase leading-[1.1] text-papel">{L('Qualidade gráfica', 'Graphics quality')}</span>
                <p className="text-[10px] text-mudo">{L('Efeitos do painel e densidade visual.', 'Panel effects and visual density.')}</p>
              </div>
            </div>
            <select
              value={userSettings.graphicQuality}
              onChange={(e) => setQuality(e.target.value as GraphicQualityId)}
              className="bg-black/60 border border-linha  px-3 py-2 text-xs text-papel uppercase font-bold shrink-0"
            >
              <option value="high">{L('Alta', 'High')}</option>
              <option value="medium">{L('Média', 'Medium')}</option>
              <option value="low">{L('Baixa', 'Low')}</option>
            </select>
          </div>

          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-mudo" />
              <div>
                <span className="font-impact text-[17px] uppercase leading-[1.1] text-papel">{L('Animações', 'Animations')}</span>
                <p className="text-[10px] text-mudo">{L('Respeitar acessibilidade ou forçar movimento.', 'Follow accessibility or force motion.')}</p>
              </div>
            </div>
            <select
              value={userSettings.reduceMotion}
              onChange={(e) => setReduceMotion(e.target.value as ReduceMotionPreference)}
              className="bg-black/60 border border-linha  px-3 py-2 text-xs text-papel font-bold shrink-0 max-w-[11rem]"
            >
              <option value="system">{L('Sistema', 'System')}</option>
              <option value="reduce">{L('Reduzir', 'Reduce')}</option>
              <option value="noReduce">{L('Normais', 'Normal')}</option>
            </select>
          </div>

          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-mudo" />
              <div>
                <span className="font-impact text-[17px] uppercase leading-[1.1] text-papel">{L('Mundo em segundo plano', 'Background world')}</span>
                <p className="text-[10px] text-mudo">
                  {L('Com ativado, treinos e tempo do clube avançam ~1× por minuto mesmo com o separador em segundo plano.', 'When on, training and club time advance ~1× per minute even with the tab in the background.')}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={userSettings.worldSimulateInBackground}
              onClick={() => setBackgroundSim(!userSettings.worldSimulateInBackground)}
              className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${
                userSettings.worldSimulateInBackground ? 'bg-rua' : 'bg-linha'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-papel rounded-full transition-transform ${
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
        <SecaoRua label={L('Clube', 'Club')} className="mb-3" />
        <div className="bg-concreto overflow-hidden">
          <div className={rowClass}>
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-mudo mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-impact text-[17px] uppercase leading-[1.1] text-papel">{L('Nome do clube', 'Club name')}</span>
                <p className="text-[10px] text-mudo">{L('Aparece em jogos, ranking e telas principais.', 'Shown in matches, rankings and main screens.')}</p>
                <input
                  value={clubDraft}
                  onChange={(e) => setClubDraft(e.target.value)}
                  maxLength={48}
                  className="mt-2 w-full max-w-md bg-black/50 border border-linha  px-3 py-2 text-sm text-papel focus:border-rua focus:outline-none"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={saveClubName}
              className="shrink-0 flex items-center gap-2 bg-rua text-asfalto-27 font-prova text-[11px] font-bold uppercase tracking-[0.12em] px-4 py-2.5  hover:bg-papel transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {L('Guardar', 'Save')}
            </button>
          </div>
          {clubSaved ? <p className="px-5 py-2 text-[10px] text-alta font-bold">{L('Nome atualizado.', 'Name updated.')}</p> : null}
          <div className={rowClass}>
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-mudo" />
              <div className="min-w-0 flex-1">
                <span className="font-impact text-[17px] uppercase leading-[1.1] text-papel">
                  {L('Foto do treinador', 'Manager photo')}
                </span>
                <p className="text-[10px] text-mudo">
                  {L('Círculo ao lado de «Bem-vindo» no topo. Incluída no backup JSON.', 'Circle next to «Welcome» at the top. Included in the JSON backup.')}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-linha bg-black/40">
                    {trainerAvatar ? (
                      <img
                        src={trainerAvatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-7 w-7 text-fio" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => trainerPhotoInputRef.current?.click()}
                      className="shrink-0  bg-concreto px-4 py-2 text-xs font-bold uppercase tracking-wider text-papel hover:bg-linha"
                    >
                      {L('Escolher imagem', 'Choose image')}
                    </button>
                    {trainerAvatar ? (
                      <button
                        type="button"
                        onClick={clearAvatar}
                        className="shrink-0  px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400/90 hover:bg-linha"
                      >
                        {L('Remover', 'Remove')}
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
                  <p className="mt-2 text-xs text-baixa" role="alert">
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
        <SecaoRua label={L('Segurança local', 'Local security')} className="mb-3" />
        <div className="bg-concreto overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (securityExpanded) {
                setSecurityMode('idle');
                resetSecurityFields();
              }
              setSecurityExpanded((v) => !v);
            }}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-linha"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Lock className="w-4 h-4 text-mudo mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className={cn('inline-flex items-center gap-1 font-impact text-[17px] uppercase leading-[1.1]', hasPwd ? 'text-alta' : 'text-papel')}>
                  {hasPwd ? <><Check className="h-3.5 w-3.5" strokeWidth={2.4} /> {L('Senha local ativa', 'Local password on')}</> : L('Senha local não definida', 'Local password not set')}
                </p>
                <p className="mt-0.5 text-[11px] text-suave">
                  {L('PIN guardado só neste dispositivo (hash SHA-256). Não substitui login Supabase.', 'PIN stored only on this device (SHA-256 hash). Does not replace Supabase login.')}
                </p>
              </div>
            </div>
            <span className="shrink-0  border border-linha bg-concreto px-3 py-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-papel">
              {securityExpanded ? L('Fechar', 'Close') : hasPwd ? L('Gerenciar', 'Manage') : L('Definir', 'Set')}
            </span>
          </button>

          {securityExpanded ? (
            <div className="border-t border-linha px-5 py-5 space-y-4">
              {/* Sem senha → form criar */}
              {!hasPwd ? (
                <div className="max-w-md space-y-2">
                  <label className="text-[10px] text-suave uppercase font-bold">{L('Definir senha local', 'Set local password')}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder={L('Nova senha (mín. 6)', 'New password (min. 6)')}
                    className="w-full bg-black/50 border border-linha  px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder={L('Confirmar senha', 'Confirm password')}
                    className="w-full bg-black/50 border border-linha  px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDefinePassword()}
                    className="bg-rua px-4 py-2 text-xs font-bold uppercase text-asfalto-27 hover:bg-papel"
                  >
                    {L('Guardar senha', 'Save password')}
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
                    className="bg-rua px-4 py-2 text-xs font-bold uppercase text-asfalto-27 hover:bg-papel"
                  >
                    {L('Trocar senha', 'Change password')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetSecurityFields();
                      setSecurityMode('forgot');
                    }}
                    className="border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/5 px-4 py-2 text-xs font-bold uppercase text-baixa hover:bg-[var(--color-danger)]/10"
                  >
                    {L('Esqueci a senha', 'Forgot password')}
                  </button>
                </div>
              ) : securityMode === 'change' ? (
                <div className="max-w-md space-y-2">
                  <label className="text-[10px] text-suave uppercase font-bold">{L('Trocar senha local', 'Change local password')}</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder={L('Senha atual', 'Current password')}
                    className="w-full bg-black/50 border border-linha  px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder={L('Nova senha (mín. 6)', 'New password (min. 6)')}
                    className="w-full bg-black/50 border border-linha  px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder={L('Confirmar nova senha', 'Confirm new password')}
                    className="w-full bg-black/50 border border-linha  px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleChangePassword()}
                      className="bg-rua px-4 py-2 text-xs font-bold uppercase text-asfalto-27 hover:bg-papel"
                    >
                      {L('Atualizar senha', 'Update password')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelPasswordChangeFlow}
                      className="bg-concreto px-4 py-2 text-xs font-bold uppercase text-papel hover:bg-linha"
                    >
                      {L('Voltar', 'Back')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-md space-y-3  border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[0.06] p-4">
                  <div>
                    <p className="font-impact text-[17px] uppercase leading-[1.1] text-baixa">
                      {L('Esqueci a senha', 'Forgot password')}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-baixa/70">
                      {emIngles() ? <>This is just a PIN for this device — there is no e-mail recovery.
                      You can <strong className="text-papel">remove it</strong> and set a new one below. To confirm,
                      type <strong className="text-papel">{PALAVRA_REMOVER}</strong>.</> : <>Esta é apenas um PIN deste dispositivo — não há recuperação por e-mail.
                      Podes <strong className="text-papel">removê-la</strong> e definir uma nova abaixo. Para confirmar,
                      digita <strong className="text-papel">REMOVER</strong>.</>}
                    </p>
                  </div>
                  <input
                    value={forgotConfirm}
                    onChange={(e) => setForgotConfirm(e.target.value.toUpperCase())}
                    placeholder={L('Digite: REMOVER', 'Type: REMOVE')}
                    className="w-full  border border-[var(--color-danger)]/30 bg-black/40 px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleForgotReset}
                      disabled={forgotConfirm.trim().toUpperCase() !== PALAVRA_REMOVER}
                      className="bg-[var(--color-danger)] px-4 py-2 text-xs font-bold uppercase text-papel hover:bg-[var(--color-danger)] disabled:opacity-40"
                    >
                      {L('Remover senha', 'Remove password')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelPasswordChangeFlow}
                      className="bg-concreto px-4 py-2 text-xs font-bold uppercase text-papel hover:bg-linha"
                    >
                      {L('Voltar', 'Back')}
                    </button>
                  </div>
                </div>
              )}

              {pwdMsg ? (
                <p className="flex items-center gap-1 text-xs text-papel">
                  {pwdMsg.startsWith('✓') ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-rua" strokeWidth={2.4} />
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
        <SecaoRua label={L('Dados', 'Data')} className="mb-3" />
        <div className="bg-concreto overflow-hidden divide-y divide-linha">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Download className="w-4 h-4 text-rua" />
              <div>
                <span className="font-impact text-[17px] uppercase leading-[1.1] text-papel">{L('Exportar backup', 'Export backup')}</span>
                <p className="text-[10px] text-mudo">{L('JSON com todo o progresso (inclui definições).', 'JSON with all progress (includes settings).')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadBackup}
              className="font-prova text-[11px] font-bold uppercase tracking-[0.12em] bg-concreto hover:bg-linha px-4 py-2  shrink-0"
            >
              {L('Baixar', 'Download')}
            </button>
          </div>
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Upload className="w-4 h-4 text-rua" />
              <div>
                <span className="font-impact text-[17px] uppercase leading-[1.1] text-papel">{L('Restaurar backup', 'Restore backup')}</span>
                <p className="text-[10px] text-mudo">{L('Substitui o save atual. Recarrega a página em seguida.', 'Replaces the current save. Reloads the page afterwards.')}</p>
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
                className="font-prova text-[11px] font-bold uppercase tracking-[0.12em] border border-linha hover:bg-linha px-4 py-2  shrink-0"
              >
                {L('Escolher ficheiro', 'Choose file')}
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
        <SecaoRua label={L('Sobre', 'About')} className="mb-3" />
        <div className="bg-concreto overflow-hidden divide-y divide-linha">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-4 h-4 text-mudo" />
              <div>
                <span className="font-impact text-[17px] uppercase leading-[1.1] text-papel">{L('Versão', 'Version')}</span>
                <p className="text-[10px] text-mudo">OLEFOOT v0.11</p>
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
                  <span className="font-impact text-[17px] uppercase leading-[1.1]">{L('Resetar progresso', 'Reset progress')}</span>
                  <p className="text-[10px] text-mudo group-hover:text-suave">{L('Apaga o save do jogo e recomeça do zero.', 'Deletes the game save and starts from scratch.')}</p>
                </div>
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-xs text-red-400 font-bold flex-1">{L('Tens a certeza? Não dá para desfazer.', 'Are you sure? This can\'t be undone.')}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'RESET' });
                      setShowResetConfirm(false);
                      setClubDraft(getGameState().club.name);
                    }}
                    className="bg-red-600 hover:bg-red-500 text-papel text-xs font-bold uppercase tracking-wider px-4 py-2"
                  >
                    {L('Confirmar', 'Confirm')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="bg-concreto hover:bg-linha text-papel text-xs font-bold uppercase tracking-wider px-4 py-2 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {L('Cancelar', 'Cancel')}
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
    ? { label: L('Carregando…', 'Loading…'), tone: 'neutral' as const, ctaLabel: '' }
    : status === 'approved'
    ? { label: (<span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" strokeWidth={2.4} /> {L('Conta verificada', 'Account verified')}</span>), tone: 'ok' as const, ctaLabel: L('Ver dados', 'View details') }
    : status === 'pending'
    ? { label: L('Em análise pelo Admin', 'Under Admin review'), tone: 'pending' as const, ctaLabel: L('Editar', 'Edit') }
    : status === 'rejected'
    ? { label: L('Verificação rejeitada', 'Verification rejected'), tone: 'bad' as const, ctaLabel: L('Reenviar', 'Resubmit') }
    : { label: L('Conta não verificada', 'Account not verified'), tone: 'neutral' as const, ctaLabel: L('Verificar', 'Verify') };

  const toneClass =
    summary.tone === 'ok'
      ? 'text-alta'
      : summary.tone === 'pending'
      ? 'text-rua'
      : summary.tone === 'bad'
      ? 'text-baixa'
      : 'text-papel';

  return (
    <section className="space-y-3">
      <SecaoRua label={L('Verificação da conta', 'Account verification')} className="mb-1" />
      <p className="mb-3 text-[12.5px] text-mudo">{L('Confirme seu e-mail e proteja seu save.', 'Confirm your e-mail and protect your save.')}</p>
      <div className="border border-linha bg-concreto overflow-hidden">
        <button
          type="button"
          onClick={() => !loading && setExpanded((v) => !v)}
          disabled={loading}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-linha disabled:cursor-default"
        >
          <div className="min-w-0 flex-1">
            <p className={cn('font-impact text-[17px] uppercase leading-[1.1]', toneClass)}>
              {summary.label}
            </p>
            <p className="mt-0.5 text-[11px] text-suave">
              {status === 'approved'
                ? L('O PRO pode sacar saldo normalmente.', 'PRO can withdraw balance normally.')
                : status === 'pending'
                ? L('Aguarda aprovação do Admin para liberar o PRO.', 'Awaiting Admin approval to unlock PRO.')
                : status === 'rejected'
                ? state?.verification_rejection_reason ?? L('Revisa os dados e reenvia.', 'Review your details and resubmit.')
                : L('Libera o painel PRO com seus cards e saque.', 'Unlocks the PRO panel with your cards and withdrawals.')}
            </p>
          </div>
          {!loading ? (
            <span className="shrink-0  border border-rua bg-concreto px-3 py-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-rua">
              {expanded ? L('Fechar', 'Close') : summary.ctaLabel}
            </span>
          ) : null}
        </button>
        {expanded && !loading ? (
          <div className="border-t border-linha">
            {status === 'approved' ? (
              <div className="px-5 py-5">
                <p className="text-[12px] text-papel">
                  {L('Aprovado em', 'Approved on')}{' '}
                  {state?.verification_reviewed_at
                    ? new Date(state.verification_reviewed_at).toLocaleString(LOCALE)
                    : '—'}
                  .
                </p>
                {state?.verification_data?.address ? (
                  <p className="mt-2 text-[11px] leading-snug text-suave">
                    {L('Endereço registrado:', 'Registered address:')}{' '}
                    {state.verification_data.address.street}, {state.verification_data.address.number} ·{' '}
                    {state.verification_data.address.city}
                    {state.verification_data.address.state ? ` — ${state.verification_data.address.state}` : ''}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="mt-4  border border-linha px-3 py-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-papel hover:bg-linha"
                >
                  {L('Fechar', 'Close')}
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

  const contractValid = contractText.trim().toUpperCase() === PALAVRA_CONTRATO;
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
        setSubmitErr(r.error ?? L('Falha ao enviar verificação.', 'Failed to submit verification.'));
        return;
      }
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full  border border-linha bg-black/40 px-3 py-2 text-sm text-papel focus:border-rua focus:outline-none';

  return (
    <div className="px-5 py-5 space-y-4">
      <div>
        <p className="font-impact text-[17px] uppercase leading-[1.1] text-papel">
          {rejectedReason ? L('Reenviar verificação', 'Resubmit verification') : L('Preencha seus dados', 'Fill in your details')}
        </p>
        <p className="mt-1 text-[11px] text-suave">
          {emIngles() ? <>Required to unlock the <strong className="text-papel">PRO</strong> panel (sales withdrawals). Approved by Admin.</> : <>Necessário para liberar o painel <strong className="text-papel">PRO</strong> (saque de vendas). Aprovação pelo Admin.</>}
        </p>
        {rejectedReason ? (
          <div className="mt-2  border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/[0.08] px-3 py-2 text-[11px] text-baixa">
            <strong className="uppercase text-baixa">{L('Rejeitado:', 'Rejected:')}</strong> {rejectedReason}
          </div>
        ) : null}
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-suave">{L('Data de nascimento', 'Date of birth')}</span>
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} required />
      </label>

      <div className="flex items-center gap-2">
        <input
          id="addr-international"
          type="checkbox"
          checked={addr.international}
          onChange={(e) => toggleInternational(e.target.checked)}
          className="h-4 w-4 accent-rua"
        />
        <label htmlFor="addr-international" className="text-[11px] font-bold uppercase tracking-wider text-papel">
          {L('Endereço internacional', 'International address')}
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-suave">
            {addr.international ? L('Código postal', 'Postal code') : L('CEP', 'ZIP (CEP)')}
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
                className="shrink-0  border border-rua bg-concreto px-3 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-rua hover:bg-concreto disabled:opacity-40"
              >
                {cepLoading ? '…' : L('Buscar', 'Search')}
              </button>
            ) : null}
          </div>
          {cepLookupErr ? <p className="mt-1 text-[10px] text-baixa">{cepLookupErr}</p> : null}
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-suave">{L('País', 'Country')}</span>
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
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-suave">{L('Rua / logradouro', 'Street')}</span>
          <input value={addr.street} onChange={(e) => setAddr((a) => ({ ...a, street: e.target.value }))} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-suave">{L('Número', 'Number')}</span>
          <input value={addr.number} onChange={(e) => setAddr((a) => ({ ...a, number: e.target.value }))} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-suave">{L('Complemento', 'Address line 2')}</span>
          <input value={addr.complement ?? ''} onChange={(e) => setAddr((a) => ({ ...a, complement: e.target.value }))} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-suave">{L('Cidade', 'City')}</span>
          <input value={addr.city} onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-suave">
            {addr.international ? L('Região / estado', 'Region / state') : L('UF', 'State')}
          </span>
          <input
            value={addr.state}
            onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value.toUpperCase().slice(0, addr.international ? 20 : 2) }))}
            className={inputCls}
            maxLength={addr.international ? 20 : 2}
          />
        </label>
      </div>

      <div className="border border-linha bg-black/30 p-3">
        <p className="font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-papel">{L('Contrato de venda', 'Sales contract')}</p>
        <p className="mt-1 text-[11px] leading-snug text-suave">
          {emIngles() ? <>By signing, you confirm the details above are true and agree to the payment split clause
          in the Olefoot terms. To accept, type the word <strong className="text-rua">{PALAVRA_CONTRATO}</strong> below.</> : <>Ao assinar, confirma que os dados acima são verdadeiros e concorda com a cláusula de splits de pagamento
          descrita nos termos da Olefoot. Para aceitar, digita a palavra <strong className="text-rua">CONTRATO</strong> abaixo.</>}
        </p>
        <input
          value={contractText}
          onChange={(e) => setContractText(e.target.value.toUpperCase())}
          className={`${inputCls} mt-2`}
          placeholder={L('Digite: CONTRATO', 'Type: CONTRACT')}
        />
        <label className={`mt-3 flex items-center gap-2 text-[11px] ${contractValid ? 'text-papel' : 'text-mudo cursor-not-allowed'}`}>
          <input
            type="checkbox"
            checked={acceptTerms}
            disabled={!contractValid}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="h-4 w-4 accent-rua"
          />
          <span>{L('Aceito os termos de venda da Olefoot.', 'I accept the Olefoot sales terms.')}</span>
        </label>
      </div>

      {submitErr ? (
        <p className="border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-[11px] text-baixa">{submitErr}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submit()}
          className="flex-1  bg-rua px-4 py-2.5 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-asfalto-27 hover:bg-papel disabled:opacity-40"
        >
          {submitting ? L('Enviando…', 'Sending…') : L('Enviar para verificação', 'Submit for verification')}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="border border-linha px-4 py-2.5 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-papel hover:bg-linha"
          >
            {L('Cancelar', 'Cancel')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
