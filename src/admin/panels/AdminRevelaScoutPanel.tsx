/**
 * OLE SCOUT — a fila de talentos do REVELA.
 *
 * POR QUE EXISTE: aprovar um talento era abrir o SQL Editor do Supabase e
 * digitar `revela_admin_review_talent(<uuid>, 'approved', '{...10 attrs...}')`
 * à mão, um por um. Isso segura o lançamento: no dia em que o link circular e
 * chegarem cinquenta fichas, o funil inteiro para no fundador escrevendo SQL.
 *
 * A tela mostra a ficha que o atleta enviou (inclusive o vídeo e o contato, que
 * é como o scout confere se a pessoa é real) e recebe os 10 atributos. O OVR
 * NÃO é digitado: quem calcula é `revela_ovr(pos, attrs)` no banco, com os pesos
 * por posição — a mesma conta do jogo.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Search, X } from 'lucide-react';
import {
  fetchScoutQueue,
  reviewScoutTalent,
  SCOUT_ATTR_KEYS,
  SCOUT_ATTR_LABEL,
  type ScoutAttrKey,
  type ScoutAttrs,
  type ScoutTalent,
} from '@/admin/revelaScoutClient';

/** Ponto de partida da ficha. O scout ajusta; ninguém nasce com 0. */
const ATTR_PADRAO = 55;

function fichaInicial(): ScoutAttrs {
  return SCOUT_ATTR_KEYS.reduce((acc, k) => {
    acc[k] = ATTR_PADRAO;
    return acc;
  }, {} as ScoutAttrs);
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  in_review: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Recusado',
  carded: 'Virou card',
};

export function AdminRevelaScoutPanel() {
  const [talentos, setTalentos] = useState<ScoutTalent[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<string>('pending');
  const [aberto, setAberto] = useState<ScoutTalent | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setTalentos(await fetchScoutQueue());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar a fila.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return talentos.filter((t) => {
      if (filtro !== 'todos' && t.status !== filtro) return false;
      if (!q) return true;
      return [t.name, t.nickname, t.club, t.city, t.uf].some((v) => v?.toLowerCase().includes(q));
    });
  }, [talentos, busca, filtro]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of talentos) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [talentos]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="ole-eyebrow-poster" style={{ fontSize: '15px' }}>
            OLE Scout
          </h2>
          <p className="mt-1.5 text-white/50" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
            A fila de quem se cadastrou no REVELA. Aprovar aqui publica o atleta na vitrine.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 font-display text-[10px] font-black uppercase tracking-[0.14em] text-white/80 transition-colors hover:border-neon-yellow/50 hover:text-neon-yellow disabled:opacity-40"
        >
          {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </button>
      </header>

      {/* Filtros por estado — o número ao lado é o tamanho real da fila. */}
      <div className="flex flex-wrap items-center gap-2">
        {['pending', 'in_review', 'approved', 'carded', 'rejected', 'todos'].map((s) => {
          const ativo = filtro === s;
          const n = s === 'todos' ? talentos.length : (contagem[s] ?? 0);
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFiltro(s)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.14em] transition-colors"
              style={{
                background: ativo ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.06)',
                color: ativo ? 'var(--color-deep-black)' : 'rgba(255,255,255,0.6)',
              }}
            >
              {s === 'todos' ? 'Todos' : (STATUS_LABEL[s] ?? s)}
              <span className="font-impact tabular-nums" style={{ fontSize: '12px' }}>
                {n}
              </span>
            </button>
          );
        })}

        <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, clube ou cidade"
            className="w-full rounded-md border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-neon-yellow/50 focus:outline-none"
          />
        </div>
      </div>

      {erro ? (
        <p
          className="rounded-md border px-3 py-2 text-[13px]"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-danger) 40%, transparent)',
            background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          {erro}
        </p>
      ) : null}

      {carregando ? (
        <p className="py-10 text-center text-white/40">Carregando a fila…</p>
      ) : visiveis.length === 0 ? (
        <div className="ole-poster px-6 py-10 text-center">
          <p className="font-impact uppercase text-white" style={{ fontSize: '16px' }}>
            Nada por aqui
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-white/50" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
            {filtro === 'pending'
              ? 'Nenhuma ficha aguardando revisão.'
              : 'Nenhum talento nesse estado.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setAberto(t)}
                className="ole-poster ole-rail flex w-full items-center gap-3 px-4 py-3 text-left transition-transform hover:-translate-y-0.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-impact uppercase text-white" style={{ fontSize: '16px' }}>
                    {t.name}
                    {t.nickname ? <span className="ml-2 text-white/45">"{t.nickname}"</span> : null}
                  </p>
                  <p className="truncate text-white/50" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
                    {[t.pos, t.club, [t.city, t.uf].filter(Boolean).join('/'), t.idade ? `${t.idade} anos` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {t.overall != null ? (
                  <span className="font-impact tabular-nums text-neon-yellow" style={{ fontSize: '22px' }}>
                    {t.overall}
                  </span>
                ) : null}
                <span
                  className="shrink-0 rounded px-2 py-1 font-display text-[9px] font-black uppercase tracking-[0.14em]"
                  style={{
                    background: t.status === 'pending' ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.10)',
                    color: t.status === 'pending' ? 'var(--color-deep-black)' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberto ? (
        <FichaDoTalento
          talento={aberto}
          onFechar={() => setAberto(null)}
          onRevisado={() => {
            setAberto(null);
            void carregar();
          }}
        />
      ) : null}
    </div>
  );
}

/** A ficha aberta: o que o atleta mandou + os 10 atributos que o scout define. */
function FichaDoTalento({
  talento,
  onFechar,
  onRevisado,
}: {
  talento: ScoutTalent;
  onFechar: () => void;
  onRevisado: () => void;
}) {
  const [attrs, setAttrs] = useState<ScoutAttrs>(fichaInicial);
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const menor = talento.idade != null && talento.idade < 18;

  async function revisar(status: 'approved' | 'rejected' | 'in_review') {
    setSalvando(status);
    setErro(null);
    try {
      const r = await reviewScoutTalent({
        id: talento.id,
        status,
        attributes: status === 'approved' ? attrs : undefined,
        note: nota.trim() || undefined,
      });
      if (!r.ok) {
        setErro(r.reason ?? 'A revisão não foi aceita.');
        return;
      }
      onRevisado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="ole-poster my-6 w-full max-w-2xl p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="ole-eyebrow-poster" style={{ fontSize: '11px' }}>
              Ficha do talento
            </span>
            <h3 className="mt-1.5 font-impact uppercase text-white" style={{ fontSize: '26px', lineHeight: 0.95 }}>
              {talento.name}
            </h3>
            <p className="mt-1 text-white/50" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
              {[talento.pos, talento.club, [talento.city, talento.uf].filter(Boolean).join('/')]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar ficha"
            className="shrink-0 rounded-md p-2 text-white/50 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Menor de idade: a lei exige responsável, e o scout precisa ver isso
            antes de aprovar — não depois. */}
        {menor ? (
          <div
            className="mt-4 rounded-md border px-3 py-2.5"
            style={{
              borderColor: 'color-mix(in srgb, var(--color-neon-yellow) 45%, transparent)',
              background: 'color-mix(in srgb, var(--color-neon-yellow) 10%, transparent)',
            }}
          >
            <p className="font-display text-[10px] font-black uppercase tracking-[0.14em] text-neon-yellow">
              Menor de idade · {talento.idade} anos
            </p>
            <p className="mt-1 text-white/70" style={{ fontFamily: 'var(--font-sans)', fontSize: '12.5px' }}>
              {talento.guardian_name
                ? `Responsável: ${talento.guardian_name}${talento.guardian_phone ? ` · ${talento.guardian_phone}` : ''}`
                : 'Sem responsável informado — não aprovar sem confirmar.'}
            </p>
          </div>
        ) : null}

        {/* O que o atleta mandou */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
          <Campo rotulo="Idade" valor={talento.idade != null ? `${talento.idade} anos` : null} />
          <Campo rotulo="Pé" valor={talento.strong_foot} />
          <Campo rotulo="Altura" valor={talento.height_cm ? `${talento.height_cm} cm` : null} />
          <Campo rotulo="Categoria" valor={talento.category} />
          <Campo rotulo="Situação" valor={talento.game_situation} />
          <Campo rotulo="Empresário" valor={talento.has_agent ? (talento.agent_name ?? 'Sim') : 'Não'} />
          <Campo rotulo="Telefone" valor={talento.contact_phone} />
          <Campo rotulo="E-mail" valor={talento.contact_email} />
          <Campo rotulo="Conta ligada" valor={talento.user_id ? 'Sim' : 'Ainda não'} />
        </dl>

        {talento.dream ? (
          <p className="mt-3 text-white/60" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.55 }}>
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
              Sonho ·{' '}
            </span>
            {talento.dream}
          </p>
        ) : null}

        {/* O vídeo é a peça que mais importa revisar: é onde entra conteúdo de
            terceiro ou impróprio. Embutido aqui porque link que abre em outra
            aba é link que não se assiste — e aprovar sem ver é o risco real. */}
        <VideoDoTalento url={talento.video_url} />

        <div className="mt-3 flex flex-wrap gap-2">
          {talento.video_url ? <Link href={talento.video_url} rotulo="Abrir vídeo" /> : null}
          {talento.instagram_url ? <Link href={talento.instagram_url} rotulo="Instagram" /> : null}
          {talento.tiktok_url ? <Link href={talento.tiktok_url} rotulo="TikTok" /> : null}
          {talento.portrait_url ? <Link href={talento.portrait_url} rotulo="Foto" /> : null}
        </div>

        {/* Os 10 atributos */}
        <div className="mt-5">
          <span className="ole-eyebrow-poster" style={{ fontSize: '11px' }}>
            Ficha de atributos
          </span>
          <p className="mt-1.5 text-white/45" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
            De 1 a 99. O overall é calculado pelo banco com os pesos da posição — não se digita aqui.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {SCOUT_ATTR_KEYS.map((k) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="font-display text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
                  {SCOUT_ATTR_LABEL[k]}
                </span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={attrs[k]}
                  onChange={(e) => setAttrs((a) => ({ ...a, [k]: Number(e.target.value) }))}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-2 text-center font-impact tabular-nums text-[18px] text-neon-yellow focus:border-neon-yellow/50 focus:outline-none"
                />
              </label>
            ))}
          </div>
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="font-display text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
            Nota interna (opcional)
          </span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Por que aprovou ou recusou. Fica no registro."
            className="w-full resize-y rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-yellow/50 focus:outline-none"
          />
        </label>

        {erro ? (
          <p className="mt-3 text-[13px]" style={{ color: 'var(--color-danger)' }}>
            {erro}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void revisar('approved')}
            disabled={salvando != null}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-neon-yellow px-5 font-display text-[11px] font-black uppercase tracking-[0.16em] text-black transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            {salvando === 'approved' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aprovar e publicar
          </button>
          <button
            type="button"
            onClick={() => void revisar('in_review')}
            disabled={salvando != null}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 px-5 font-display text-[11px] font-black uppercase tracking-[0.16em] text-white/80 transition-colors hover:border-white/40 disabled:opacity-50"
          >
            Deixar em análise
          </button>
          <button
            type="button"
            onClick={() => void revisar('rejected')}
            disabled={salvando != null}
            className="inline-flex min-h-11 items-center justify-center rounded-md border px-5 font-display text-[11px] font-black uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
            style={{
              borderColor: 'color-mix(in srgb, var(--color-danger) 45%, transparent)',
              color: 'var(--color-danger)',
            }}
          >
            Recusar
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="font-display text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">{rotulo}</dt>
      <dd className="truncate text-white/85" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
        {valor?.trim() || '—'}
      </dd>
    </div>
  );
}

function Link({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.14em] text-white/75 transition-colors hover:border-neon-yellow/50 hover:text-neon-yellow"
    >
      {rotulo}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}


/**
 * Player embutido do vídeo enviado.
 *
 * Só embute o que dá pra embutir com segurança (YouTube e Vimeo, em modo
 * privacy-enhanced). Qualquer outra origem vira aviso + link, porque embutir
 * URL arbitrária num painel autenticado é convite a clickjacking.
 */
function VideoDoTalento({ url }: { url: string | null }) {
  if (!url?.trim()) return null;

  const embed = urlDeEmbed(url);
  if (!embed) {
    return (
      <p className="mt-3 text-white/45" style={{ fontFamily: 'var(--font-sans)', fontSize: '12.5px' }}>
        O vídeo está numa origem que não dá pra embutir com segurança — abra pelo botão abaixo
        antes de aprovar.
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-white/10" style={{ aspectRatio: '16 / 9' }}>
      <iframe
        src={embed}
        title="Vídeo enviado pelo atleta"
        className="h-full w-full"
        allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />
    </div>
  );
}

/** Converte link de YouTube/Vimeo em URL de embed. Devolve null pro resto. */
function urlDeEmbed(bruto: string): string | null {
  let u: URL;
  try {
    u = new URL(bruto.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (u.pathname === '/watch') {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    const m = u.pathname.match(/^\/(shorts|embed)\/([\w-]+)/);
    if (m) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(m[2])}`;
    return null;
  }
  if (host === 'vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return /^\d+$/.test(id ?? '') ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}
