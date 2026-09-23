/**
 * Criar ou restaurar a carteira — um lugar só.
 *
 * Isto vive fora das duas telas que usam (`/` e `/conectar`) porque é a tela
 * que MOSTRA A FRASE. Duplicar o aviso de "anote no papel", a grade das 12
 * palavras e a regra da senha em dois arquivos é garantir que um dia os dois
 * digam coisas diferentes — e o que diverge, numa carteira, é o que a pessoa
 * acredita sobre como recuperar o dinheiro.
 */
import { useState } from 'react';
import { useCarteira } from '@/wallet/seed/useCarteira';
import { PALAVRAS_NA_FRASE, fraseValida, normalizarFrase } from '@/wallet/seed/mnemonic';
import { tradutor } from '@/i18n/idioma';
import { useIdioma } from '@/i18n/useIdioma';
import { TEXTOS } from './textos';
import { Aviso, BOTAO_LINHA, BOTAO_VOLT, CAMPO, Logo } from './ui';

export type Passo = 'inicio' | 'frase' | 'senha' | 'restaurar';

interface Props {
  w: ReturnType<typeof useCarteira>;
  passo: Passo;
  setPasso: (p: Passo) => void;
  onPronto?: () => void;
  /** O pedido de conexão fala outra coisa na tela de início. */
  chamada?: { titulo: string; texto: string };
  /** A tela de início da carteira mostra o lockup grande; a de conexão não. */
  comLogoGrande?: boolean;
}

export default function CriarOuRestaurar({ w, passo, setPasso, onPronto, chamada, comLogoGrande }: Props) {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  const [frase, setFrase] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [digitada, setDigitada] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const limpar = () => { setSenha(''); setSenha2(''); setDigitada(''); setMsg(null); };

  const confirmar = async () => {
    setMsg(null);
    if (senha !== senha2) { setMsg(t('senhasDiferem')); return; }
    const palavras = passo === 'restaurar' ? normalizarFrase(digitada) : frase;
    if (passo === 'restaurar' && !fraseValida(palavras)) { setMsg(t('fraseNaoFecha')); return; }
    try {
      await w.criar(palavras, senha);
      limpar(); setFrase([]); setPasso('inicio');
      onPronto?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('naoDeu'));
    }
  };

  if (passo === 'frase') {
    return (
      <>
        <Aviso titulo={t('anoteNoPapel')}>{t('anoteTexto')}</Aviso>
        <div className="grid grid-cols-3 gap-2">
          {frase.map((p, i) => (
            <div key={`${i}-${p}`} className="flex items-baseline gap-1.5 border border-white/10 bg-panel px-2 py-2.5">
              <span className="font-mono text-[10px] text-poeira">{String(i + 1).padStart(2, '0')}</span>
              <span className="font-mono text-[13px]">{p}</span>
            </div>
          ))}
        </div>
        <div className="border border-white/10 bg-panel px-3.5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('leiaUmaVez')}</p>
          <p className="mt-1.5 text-[12px] leading-[1.55] text-giz">
            {t('listaPropriaA')}
            <strong className="text-white">{t('listaPropriaB')}</strong>
            {t('listaPropriaC')}
          </p>
        </div>
        <button type="button" className={BOTAO_LINHA}
          onClick={() => { void navigator.clipboard.writeText(frase.join(' ')).then(() => setCopiado(true)); }}>
          {copiado ? t('copiado') : t('copiar')}
        </button>
        <button type="button" className={`${BOTAO_VOLT} mt-auto`} onClick={() => { limpar(); setPasso('senha'); }}>
          {t('anotei')}
        </button>
      </>
    );
  }

  if (passo === 'senha' || passo === 'restaurar') {
    const restaurando = passo === 'restaurar';
    return (
      <>
        {restaurando && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('suaFrase')}</p>
            <textarea rows={4} className={`${CAMPO} h-auto py-2.5 leading-relaxed`} autoFocus
              placeholder={t('placeholderFrase')}
              value={digitada} onChange={(e) => setDigitada(e.target.value)} />
          </>
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('senhaDesteApar')}</p>
        <input type="password" className={CAMPO} placeholder={t('senha')} value={senha}
          autoFocus={!restaurando} onChange={(e) => setSenha(e.target.value)} />
        <input type="password" className={CAMPO} placeholder={t('repitaSenha')} value={senha2}
          onChange={(e) => setSenha2(e.target.value)} />
        <p className="text-[11px] leading-relaxed text-poeira">{t('senhaExplica')}</p>
        {(msg ?? w.erro) && <p className="text-[12px] text-baixa">{msg ?? w.erro}</p>}
        <button type="button" className={`${BOTAO_VOLT} mt-auto`}
          disabled={w.ocupado || !senha || !senha2 || (restaurando && !digitada.trim())}
          onClick={() => void confirmar()}>
          {w.ocupado ? t('cifrando') : restaurando ? t('restaurarBotao') : t('criarCarteira')}
        </button>
      </>
    );
  }

  return (
    <>
      {comLogoGrande && <Logo />}
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        <p className="font-mono text-[11px] text-poeira">#olewallet</p>
        <h1 className="whitespace-pre-line font-display text-[40px] uppercase leading-[1.08]">
          {chamada ? chamada.titulo : t('heroTitulo')}
        </h1>
        <p className="mt-1 text-[14px] leading-relaxed text-cimento">
          {chamada ? chamada.texto : t('heroTexto')}
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <button type="button" className={BOTAO_VOLT}
          onClick={() => { setFrase(w.novaFrase()); setCopiado(false); setPasso('frase'); }}>
          {t('criarCarteira')}
        </button>
        <button type="button" className={BOTAO_LINHA} onClick={() => { limpar(); setPasso('restaurar'); }}>
          {t('jaTenhoFrase')}
        </button>
        <p className="mt-1 text-[11px] leading-relaxed text-poeira">{t('naoGuardamos')}</p>
      </div>
    </>
  );
}
