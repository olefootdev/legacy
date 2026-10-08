/**
 * Matchday Preview — página standalone para validação visual.
 *
 * Renderiza <MatchdayHero> com mock data (Flamengo 2-1 Palmeiras).
 * Quando vier um snapshot real (live match, postgame), passar `data` próprio.
 */

import { MatchdayHero } from '@/components/matchday/MatchdayHero';

export function MatchdayPreview() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-asfalto-27 text-papel">
      <MatchdayHero />
    </div>
  );
}

export default MatchdayPreview;
