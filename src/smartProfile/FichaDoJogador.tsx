/**
 * SMART-PROFILE — o bloco da ficha dentro do painel do jogador.
 * Some quando a ficha ainda não existe (visitante, servidor fora, migration
 * pendente): é complemento, nunca bloqueia a tela.
 */
import { L } from '@/i18n/L';
import { useFicha } from './cliente';
import { DESCRICAO_DA_CLASSE, NOME_DA_RARIDADE, NOME_DO_TEMPERAMENTO, nomeDaClasse } from './rotulos';

const ROTULO = { fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em' } as const;

export function FichaDoJogador({ playerId }: { playerId: string }) {
  const { ficha } = useFicha(playerId);
  if (!ficha) return null;

  const eixos = ['ousadia', 'frieza', 'ambicao', 'lealdade'] as const;
  return (
    <section className="border border-white/10 bg-black/25 p-4 scroll-snap-section" style={{ borderRadius: 'var(--radius-md)' }}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="shrink-0 w-[3px] h-5 bg-neon-yellow" />
          <h3 className="text-neon-yellow uppercase" style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em' }}>
            {L('Ficha', 'Profile')}
          </h3>
        </div>
        <span className="border border-white/20 px-2 py-0.5 text-white/80 uppercase" style={ROTULO}>
          {NOME_DA_RARIDADE[ficha.raridade] ?? ficha.raridade}
        </span>
      </div>

      <div className="mt-3">
        <p className="text-gray-500 uppercase" style={ROTULO}>{L('Classe', 'Class')}</p>
        <p className="font-impact text-[26px] uppercase leading-[1.05] text-white">{nomeDaClasse(ficha.classe)}</p>
        <p className="mt-1 text-[12px] leading-snug text-white/60">{DESCRICAO_DA_CLASSE[ficha.classe] ?? ''}</p>
        {ficha.classe_afinidade && (
          <p className="mt-1.5 text-[11px] text-white/45">
            {L('Afinidade', 'Affinity')}: <span className="text-white/75">{nomeDaClasse(ficha.classe_afinidade)}</span>
          </p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-gray-500 uppercase" style={ROTULO}>{L('Temperamento', 'Temperament')}</p>
        <dl className="mt-2 space-y-1.5">
          {eixos.map((k) => (
            <div key={k} className="grid grid-cols-[84px_1fr_28px] items-center gap-2">
              <dt className="text-[11px] text-white/70">{NOME_DO_TEMPERAMENTO[k]}</dt>
              <div className="h-1.5 bg-white/10" aria-hidden>
                <div className="h-full bg-neon-yellow" style={{ width: `${ficha.temperamento[k]}%` }} />
              </div>
              <dd className="text-right font-mono text-[11px] tabular-nums text-white/80">{ficha.temperamento[k]}</dd>
            </div>
          ))}
        </dl>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
        <div>
          <dt className="text-gray-500 uppercase" style={ROTULO}>{L('Nível', 'Level')}</dt>
          <dd className="font-mono text-[15px] tabular-nums text-white">{ficha.nivel}</dd>
        </div>
        <div>
          <dt className="text-gray-500 uppercase" style={ROTULO}>{L('Cérebro', 'Brain')}</dt>
          <dd className="font-mono text-[15px] tabular-nums text-white">
            {ficha.cerebro.ideias.length}/{ficha.cerebro.espacos}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500 uppercase" style={ROTULO}>{L('OVR de nascimento', 'Birth OVR')}</dt>
          <dd className="font-mono text-[15px] tabular-nums text-white">{ficha.genese.ovr}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10.5px] text-white/35">
        {L('Gênese selada', 'Sealed genesis')} · <span className="font-mono">{ficha.genese_hash.slice(0, 12)}</span>
      </p>
    </section>
  );
}
