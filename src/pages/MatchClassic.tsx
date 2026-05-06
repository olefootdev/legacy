import { useNavigate } from 'react-router-dom';
import { ClassicMatchScreen } from '@/components/classic/ClassicMatchScreen';

export function MatchClassic() {
  const navigate = useNavigate();
  return (
    <ClassicMatchScreen
      config={{
        homeTeam:     'TIGRES',
        awayTeam:     'ALVORADA FC',
        homeManager:  'JONES',
        awayManager:  'MATEUS',
        round:        12,
        competition:  'CLASSIC LEAGUE',
      }}
      onExit={() => navigate('/', { replace: true })}
    />
  );
}
