/**
 * HOME do REVELA.
 *
 * Toda a leitura de dado acontece AQUI, uma vez, e desce por props. As seções
 * não buscam nada: se cada uma fizesse seu fetch, o número de apoiadores do
 * mesmo jogador apareceria diferente em três lugares da mesma tela.
 *
 * A casca (nav, rodapé, folha de login, toast) mora no App — ela é a mesma em
 * todas as rotas, e é justamente o que faz a página da lenda não parecer outro
 * site.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  fetchDivisions,
  fetchLegends,
  fetchMySupports,
  fetchTalents,
  fetchTopClubs,
  fetchWeeklyRising,
  supportTalent,
  type RisingTalent,
} from '../data/revelaApi';
import { byAthlete, isLegend, type AthleteLegend } from '../data/legends';
import type { ClubRank, DivisionCount, Talent } from '../data/types';
import { GameCta, Hero, Marquee } from '../sections/Top';
import { Discovery, EmAlta, RevealWall, Torcida } from '../sections/Talents';
import { ComoFunciona } from '../sections/Journey';
import { Legends, Resenha } from '../sections/Legends';
import { Divisoes, TopClubs } from '../sections/League';
import { LigaRetro } from '../sections/LigaRetro';
import { Placar } from '../sections/Placar';
import { TeamBuilder } from '../sections/TeamBuilder';

export function Home({
  session,
  requireAuth,
  onNote,
}: {
  session: { userId: string } | null;
  requireAuth: (reason: string, aoEntrar?: () => void) => void;
  onNote: (title: string, body?: string, tone?: 'yellow' | 'green') => void;
}) {
  const [talents, setTalents] = useState<Talent[]>([]);
  const [legends, setLegends] = useState<AthleteLegend[]>([]);
  const [clubs, setClubs] = useState<ClubRank[]>([]);
  const [divisions, setDivisions] = useState<DivisionCount[]>([]);
  const [rising, setRising] = useState<RisingTalent[]>([]);
  const [supported, setSupported] = useState<Set<string>>(new Set());

  /* ── Carga inicial ─────────────────────────────────────────────────────── */
  useEffect(() => {
    // Em paralelo: nenhuma dessas leituras depende da outra, e serializar
    // atrasaria o primeiro pintar por nada.
    // Pede o catálogo INTEIRO de lendas (60), não 12: o agrupamento por atleta
    // acontece depois, e cortar antes esconderia gente. Hoje são 25 cartas de
    // 11 atletas — pedindo 12 cartas, quatro atletas nunca apareceriam.
    void Promise.all([
      fetchTalents(40),
      fetchLegends(60),
      fetchTopClubs(10),
      fetchDivisions(),
      fetchWeeklyRising(8),
    ]).then(([t, l, c, d, r]) => {
      setTalents(t);
      setLegends(byAthlete(l.filter(isLegend)));
      setClubs(c);
      setDivisions(d);
      setRising(r);
    });
  }, []);

  /* ── Apoios da conta ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!session) {
      setSupported(new Set());
      return;
    }
    void fetchMySupports().then((ids) => setSupported(new Set(ids)));
  }, [session]);

  /* ── Apoiar ────────────────────────────────────────────────────────────── */
  async function handleSupport(talent: Talent) {
    if (supported.has(talent.id)) return;

    const res = await supportTalent(talent.id);

    if (!res.ok) {
      if (res.reason === 'auth_required') {
        requireAuth('Pra virar fã, cria tua conta', () => void handleSupport(talent));
        return;
      }
      onNote('Não deu pra registrar o apoio', 'Tenta de novo em instantes.');
      return;
    }

    setSupported((prev) => new Set(prev).add(talent.id));
    // Atualiza a contagem local com o número que o servidor devolveu — não
    // com um +1 otimista, que dessincroniza se a pessoa apoiou noutra aba.
    setTalents((prev) =>
      prev.map((t) => (t.id === talent.id ? { ...t, supporters: res.supporters } : t)),
    );
    onNote('Você está na torcida', `${talent.name} avançou no Road to Card.`, 'green');
  }

  /* ── Derivados ─────────────────────────────────────────────────────────── */
  const totalSupporters = useMemo(
    () => talents.reduce((sum, t) => sum + t.supporters, 0),
    [talents],
  );

  /**
   * Os números do hero — só entra quem tem valor maior que zero.
   *
   * O hero desenha esses números em Anton 42px. Um "0" nesse corpo não é um
   * dado neutro: é a primeira coisa que a pessoa lê, e ela lê "aqui não tem
   * nada". No começo do funil os apoios são legitimamente zero, e insistir em
   * mostrá-los faria a página desmentir a própria manchete.
   *
   * A saída não é inventar número — é escolher, entre os que são VERDADE agora,
   * os que sustentam a promessa. Lendas no acervo e clubes em disputa já são
   * grandes hoje. Quando a torcida começar, ela entra sozinha e empurra as
   * outras pra fora, porque é a métrica que mais importa aqui.
   */
  const heroStats = useMemo(() => {
    const candidatos = [
      { value: talents.length, label: talents.length === 1 ? 'Talento na vitrine' : 'Talentos na vitrine' },
      { value: totalSupporters, label: 'Apoios registrados' },
      { value: legends.length, label: 'Lendas no acervo' },
      { value: clubs.length > 0 ? divisions.reduce((s, d) => s + d.clubs, 0) : 0, label: 'Clubes em disputa' },
    ];
    return candidatos.filter((s) => s.value > 0).slice(0, 3);
  }, [talents.length, totalSupporters, legends.length, clubs.length, divisions]);

  const discovery = useMemo(() => talents.slice(0, 10), [talents]);

  return (
    <main>
        <Hero stats={heroStats} />
        <Marquee />

        <Discovery talents={discovery} supported={supported} onSupport={handleSupport} />
        <Placar limite={10} />
        <EmAlta rising={rising} />
        <Torcida talents={talents} />
        <ComoFunciona />
        <RevealWall talents={talents} />
        <Legends legends={legends} />
        <Resenha legends={legends} />

        <TeamBuilder
          talents={talents}
          legends={legends}
          authed={Boolean(session)}
          onNeedAuth={() => requireAuth('Entra pra salvar teu time')}
          onNote={onNote}
        />

        {/* A homenagem ao Elifoot — tela retro com a classificação real da liga.
            Some sozinha se a liga ainda não tem divisões. */}
        <LigaRetro />

        <TopClubs clubs={clubs} />
        <Divisoes counts={divisions} />

      <GameCta />
    </main>
  );
}
