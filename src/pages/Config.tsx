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
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useGameDispatch, useGameStore, getGameState } from '@/game/store';
import { tryHydrateGameState } from '@/game/persistence';
import type { GraphicQualityId, ReduceMotionPreference } from '@/game/types';
import {
  hasLocalPassword,
  setLocalPassword,
  changeLocalPassword,
  verifyLocalPassword,
} from '@/settings/localAccountAuth';
import { playUiChime } from '@/settings/soundFeedback';
import { useTrainerAvatarUpload } from '@/hooks/useTrainerAvatarUpload';
import { useManagerCrestUpload } from '@/hooks/useManagerCrestUpload';

export function Config() {
  const dispatch = useGameDispatch();
  const clubName = useGameStore((s) => s.club.name);
  const userSettings = useGameStore((s) => s.userSettings);
  const trainerAvatar = userSettings.trainerAvatarDataUrl;
  const managerCrest = userSettings.managerCrestPngDataUrl;
  const { onFileChange: onTrainerAvatarFile, error: trainerAvatarErr, clearAvatar } =
    useTrainerAvatarUpload();
  const {
    onFileChange: onManagerCrestFile,
    error: managerCrestErr,
    clearCrest,
  } = useManagerCrestUpload();
  const trainerPhotoInputRef = useRef<HTMLInputElement>(null);
  const managerCrestInputRef = useRef<HTMLInputElement>(null);
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
  const [confirmCurrentPw, setConfirmCurrentPw] = useState('');
  const [passwordChangeStep, setPasswordChangeStep] = useState<'verify-current' | 'set-new'>(
    'verify-current',
  );

  useEffect(() => {
    setClubDraft(clubName);
  }, [clubName]);

  useEffect(() => {
    setHasPwd(hasLocalPassword());
  }, [pwdMsg]);

  useEffect(() => {
    if (!hasPwd) {
      setPasswordChangeStep('verify-current');
      setConfirmCurrentPw('');
    }
  }, [hasPwd]);

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
    if (newPw !== confirmPw) {
      setPwdMsg('As senhas não coincidem.');
      return;
    }
    const r = await setLocalPassword(newPw);
    setPwdMsg(r.ok ? 'Senha local definida.' : r.error ?? 'Erro.');
    if (r.ok) {
      setNewPw('');
      setConfirmPw('');
    }
  };

  const handleVerifyCurrentForChange = async () => {
    setPwdMsg(null);
    if (!currentPw.trim() || !confirmCurrentPw.trim()) {
      setPwdMsg('Preenche a senha atual e a confirmação.');
      return;
    }
    if (currentPw !== confirmCurrentPw) {
      setPwdMsg('A senha atual e a confirmação não coincidem.');
      return;
    }
    const ok = await verifyLocalPassword(currentPw);
    if (!ok) {
      setPwdMsg('Senha atual incorreta.');
      return;
    }
    setPwdMsg(null);
    setPasswordChangeStep('set-new');
    setNewPw('');
    setConfirmPw('');
  };

  const handleChangePassword = async () => {
    setPwdMsg(null);
    if (newPw !== confirmPw) {
      setPwdMsg('A nova senha e a confirmação não coincidem.');
      return;
    }
    const r = await changeLocalPassword(currentPw, newPw);
    setPwdMsg(r.ok ? 'Senha atualizada.' : r.error ?? 'Erro.');
    if (r.ok) {
      setPasswordChangeStep('verify-current');
      setCurrentPw('');
      setConfirmCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    }
  };

  const cancelPasswordChangeFlow = () => {
    setPasswordChangeStep('verify-current');
    setCurrentPw('');
    setConfirmCurrentPw('');
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
    <div className="mx-auto min-w-0 max-w-2xl space-y-8 pb-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-neon-yellow" />
          <div>
            <h2 className="text-3xl font-display font-black uppercase tracking-wider">Configurações</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">Preferências persistidas com o teu save.</p>
          </div>
        </div>
      </motion.div>

      {/* Geral */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="space-y-3"
      >
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-gray-500 mb-2">Geral</h3>
        <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden divide-y divide-white/5">
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
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-gray-500 mb-2">Clube</h3>
        <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden">
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
          <div className={rowClass}>
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-display font-bold tracking-wider text-white">
                  Brasão do clube (matchday)
                </span>
                <p className="text-[10px] text-gray-500">
                  PNG com fundo transparente. No matchday e nas partidas, o escudo do time do coração (cadastro) vem
                  primeiro; se não houver, usa-se este brasão. Máx. ~384 px no maior lado.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-black/40">
                    {managerCrest ? (
                      <img src={managerCrest} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Shield className="h-8 w-8 text-white/25" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => managerCrestInputRef.current?.click()}
                      className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20"
                    >
                      Carregar PNG
                    </button>
                    {managerCrest ? (
                      <button
                        type="button"
                        onClick={clearCrest}
                        className="shrink-0 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400/90 hover:bg-white/5"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={managerCrestInputRef}
                    type="file"
                    accept="image/png,.png"
                    className="hidden"
                    onChange={onManagerCrestFile}
                  />
                </div>
                {managerCrestErr ? (
                  <p className="mt-2 text-xs text-red-400" role="alert">
                    {managerCrestErr}
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
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-gray-500 mb-2">Segurança local</h3>
        <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
            <div className="text-[10px] text-gray-500 leading-relaxed">
              PIN/senha guardada só neste dispositivo (hash SHA-256). Não substitui login em servidor.{' '}
              <span className="text-gray-600">TODO: integrar Supabase Auth + LGPD.</span>
            </div>
          </div>

          {!hasPwd ? (
            <div className="space-y-2 max-w-md">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Definir senha</label>
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
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Confirmar"
                className="w-full bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleDefinePassword()}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase px-4 py-2 rounded-lg"
              >
                Guardar senha
              </button>
            </div>
          ) : (
            <div className="max-w-md space-y-4">
              <label className="text-[10px] font-bold uppercase text-gray-400">Trocar senha</label>
              {passwordChangeStep === 'verify-current' ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500">
                    Primeiro indica a senha atual duas vezes; depois podes definir a nova.
                  </p>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="Senha atual"
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={confirmCurrentPw}
                    onChange={(e) => setConfirmCurrentPw(e.target.value)}
                    placeholder="Confirmar senha atual"
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleVerifyCurrentForChange()}
                    className="rounded-lg bg-white/10 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-white/20"
                  >
                    Continuar
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500">Nova senha (mínimo 6 caracteres).</p>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Nova senha (mín. 6)"
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Confirmar nova senha"
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm"
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
              )}
            </div>
          )}
          {pwdMsg ? <p className="text-xs text-neon-yellow">{pwdMsg}</p> : null}
        </div>
      </motion.section>

      {/* Dados */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-gray-500 mb-2">Dados</h3>
        <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden divide-y divide-white/5">
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
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-gray-500 mb-2">Sobre</h3>
        <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden divide-y divide-white/5">
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
