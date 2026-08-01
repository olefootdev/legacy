/**
 * revela.olefoot.com/<x> — um caminho, dois destinos.
 *
 * O jogador escolheu um @ no cadastro (breno11). Este é o link curto que ele
 * posta: abre o perfil dele E credita a rede dele. E se o <x> for um código de
 * indicação cru (o aleatório de fallback), captura e leva pra vitrine.
 *
 * DESAMBIGUAÇÃO: resolve o handle no banco primeiro (talento aprovado ou lenda).
 * Se não for handle, tenta como código de indicação. Assim um handle sempre
 * vence — não há colisão entre "breno11" e um código.
 */
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { normalizeReferralCode } from '@/wallet/referralCode';
import { resolveHandle } from '../data/revelaApi';
import { rememberReferral } from '../data/session';

export function ShortLink() {
  const { short = '' } = useParams();
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void resolveHandle(short).then((r) => {
      if (!vivo) return;
      if (r.found && r.kind === 'talent' && r.slug) {
        // O link do talento credita a REDE DELE quando o visitante se cadastra.
        if (r.refCode) rememberReferral(r.refCode);
        setDestino(`/t/${r.slug}`);
      } else if (r.found && r.kind === 'legend' && r.slug) {
        setDestino(`/lenda/${r.slug}`);
      } else {
        // Não é handle público. Só trata como CÓDIGO de indicação se for MAIÚSCULO
        // 6-8 (a convenção do código do jogo) — um handle minúsculo não-resolvido
        // (ex.: perfil ainda não aprovado) NÃO vira código. Ambos caem na vitrine.
        if (/^[A-Z0-9]{6,8}$/.test(short)) {
          const code = normalizeReferralCode(short);
          if (code) rememberReferral(code);
        }
        setDestino('/');
      }
    });
    return () => {
      vivo = false;
    };
  }, [short]);

  if (destino) return <Navigate to={destino} replace />;

  // Respiro curto enquanto resolve — sem flash de conteúdo errado.
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <p className="rev-label text-[11px]" style={{ color: 'rgba(237,235,228,.45)' }}>
        Abrindo…
      </p>
    </main>
  );
}
