/**
 * ADMIN — Painel de Agentes Offline
 *
 * Gerencia:
 * - Visualização de AgentProfiles
 * - Criação/edição de Skills
 * - Geração em massa de profiles
 * - Testes de decisão
 * - Relatórios de aprendizado
 */

import { useState } from 'react';
import { useAdminPlatformStore } from '@/admin/platformStore';
import { createAgentProfile, validateAgentProfile } from '@/agents/AgentProfileFactory';
import {
  getAllSkills,
  getSkillsByPosition,
  getSkillsByCategory,
  canEquipSkill,
  SKILL_REGISTRY,
} from '@/agents/SkillRegistry';
import { resolveTeamIntent, getTeamIntentDescription } from '@/agents/TeamIntentResolver';
import type { AgentProfile, SkillDefinition, TeamIntent } from '@/agents/types';
import type { PlayerEntity } from '@/entities/types';

type TabId = 'profiles' | 'skills' | 'generator' | 'test' | 'learning';

export function AdminAgentsPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('profiles');
  const platform = useAdminPlatformStore((s) => s);

  // Mock de jogadores para demonstração (Admin pode integrar com dados reais depois)
  const players: Record<string, PlayerEntity> = {};

  return (
    <div className="admin-agents-panel">
      <div className="admin-panel-header">
        <h2>🤖 Sistema de Agentes Offline</h2>
        <p className="admin-panel-subtitle">
          Gerenciamento de perfis, skills e aprendizado dos jogadores
        </p>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={activeTab === 'profiles' ? 'active' : ''}
          onClick={() => setActiveTab('profiles')}
        >
          📊 Perfis
        </button>
        <button
          className={activeTab === 'skills' ? 'active' : ''}
          onClick={() => setActiveTab('skills')}
        >
          ⚡ Skills
        </button>
        <button
          className={activeTab === 'generator' ? 'active' : ''}
          onClick={() => setActiveTab('generator')}
        >
          🏭 Gerador
        </button>
        <button
          className={activeTab === 'test' ? 'active' : ''}
          onClick={() => setActiveTab('test')}
        >
          🧪 Testes
        </button>
        <button
          className={activeTab === 'learning' ? 'active' : ''}
          onClick={() => setActiveTab('learning')}
        >
          📈 Aprendizado
        </button>
      </div>

      {/* Content */}
      <div className="admin-tab-content">
        {activeTab === 'profiles' && <ProfilesTab players={players} />}
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'generator' && <GeneratorTab players={players} />}
        {activeTab === 'test' && <TestTab players={players} />}
        {activeTab === 'learning' && <LearningTab players={players} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: PERFIS
// ─────────────────────────────────────────────────────────────
function ProfilesTab({ players }: { players: Record<string, PlayerEntity> }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [generatedProfile, setGeneratedProfile] = useState<AgentProfile | null>(null);

  const playersList = Object.values(players);
  const selectedPlayer = selectedPlayerId ? players[selectedPlayerId] : null;

  const handleGenerateProfile = () => {
    if (!selectedPlayer) return;
    const profile = createAgentProfile(selectedPlayer);
    setGeneratedProfile(profile);
  };

  const validation = generatedProfile ? validateAgentProfile(generatedProfile) : null;

  return (
    <div className="profiles-tab">
      <div className="profiles-grid">
        {/* Lista de jogadores */}
        <div className="profiles-list">
          <h3>Jogadores ({playersList.length})</h3>
          <div className="player-list-scroll">
            {playersList.map((p) => (
              <div
                key={p.id}
                className={`player-item ${selectedPlayerId === p.id ? 'selected' : ''}`}
                onClick={() => setSelectedPlayerId(p.id)}
              >
                <div className="player-item-header">
                  <span className="player-num">#{p.num}</span>
                  <span className="player-name">{p.name}</span>
                </div>
                <div className="player-item-meta">
                  <span className="player-pos">{p.pos}</span>
                  <span className="player-archetype">{p.archetype}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detalhes do perfil */}
        <div className="profile-details">
          {selectedPlayer ? (
            <>
              <div className="profile-header">
                <h3>{selectedPlayer.name}</h3>
                <button onClick={handleGenerateProfile} className="btn-primary">
                  🔄 Gerar Perfil
                </button>
              </div>

              {generatedProfile && (
                <div className="profile-content">
                  {/* Validação */}
                  {validation && (
                    <div className={`validation-box ${validation.valid ? 'valid' : 'invalid'}`}>
                      {validation.valid ? (
                        <span>✅ Perfil válido</span>
                      ) : (
                        <div>
                          <span>❌ Erros encontrados:</span>
                          <ul>
                            {validation.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Spatial Profile */}
                  <div className="profile-section">
                    <h4>🗺️ Perfil Espacial</h4>
                    <div className="profile-stats">
                      <StatBar
                        label="Consciência Espacial"
                        value={generatedProfile.spatialProfile.spatialAwareness}
                      />
                      <StatBar
                        label="Scan Antes de Receber"
                        value={generatedProfile.spatialProfile.scanBeforeReceive}
                      />
                      <StatBar
                        label="Timing de Corrida"
                        value={generatedProfile.spatialProfile.runTiming}
                      />
                      <StatBar
                        label="Posicionamento Defensivo"
                        value={generatedProfile.spatialProfile.defensivePositioning}
                      />
                    </div>
                    <div className="profile-zones">
                      <strong>Zonas Preferidas:</strong>{' '}
                      {generatedProfile.spatialProfile.preferredZones.join(', ')}
                    </div>
                  </div>

                  {/* Team Profile */}
                  <div className="profile-section">
                    <h4>🤝 Perfil Coletivo</h4>
                    <div className="profile-stats">
                      <StatBar
                        label="Suporte ao Portador"
                        value={generatedProfile.teamProfile.supportCarrier}
                      />
                      <StatBar
                        label="Disciplina Tática"
                        value={generatedProfile.teamProfile.tacticalDiscipline}
                      />
                      <StatBar
                        label="Comunicação"
                        value={generatedProfile.teamProfile.teamCommunication}
                      />
                      <StatBar
                        label="Cobertura Defensiva"
                        value={generatedProfile.teamProfile.defensiveCover}
                      />
                      <StatBar
                        label="Movimento Coletivo"
                        value={generatedProfile.teamProfile.collectiveMovement}
                      />
                    </div>
                  </div>

                  {/* Individual Profile */}
                  <div className="profile-section">
                    <h4>⭐ Perfil Individual</h4>
                    <div className="profile-stats">
                      <StatBar
                        label="Criatividade"
                        value={generatedProfile.individualProfile.creativity}
                      />
                      <StatBar
                        label="Decisão Sob Pressão"
                        value={generatedProfile.individualProfile.decisionUnderPressure}
                      />
                      <StatBar
                        label="Confiança com Bola"
                        value={generatedProfile.individualProfile.ballConfidence}
                      />
                      <StatBar label="Visão" value={generatedProfile.individualProfile.vision} />
                      <StatBar
                        label="Execução Técnica"
                        value={generatedProfile.individualProfile.technicalExecution}
                      />
                    </div>
                  </div>

                  {/* Risk Profile */}
                  <div className="profile-section">
                    <h4>🎲 Perfil de Risco</h4>
                    <div className="profile-stats">
                      <StatBar label="Risco Base" value={generatedProfile.riskProfile.baseRisk} />
                      <StatBar
                        label="Drible vs Passe"
                        value={generatedProfile.riskProfile.dribbleVsPass}
                      />
                    </div>
                    <div className="profile-deltas">
                      <div>
                        Sob Pressão: <strong>{generatedProfile.riskProfile.riskUnderPressure}</strong>
                      </div>
                      <div>
                        Perdendo: <strong>{generatedProfile.riskProfile.riskWhenLosing}</strong>
                      </div>
                      <div>
                        Ganhando: <strong>{generatedProfile.riskProfile.riskWhenWinning}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Critical Profile */}
                  <div className="profile-section">
                    <h4>🔥 Perfil Crítico</h4>
                    <div className="profile-stats">
                      <StatBar
                        label="Compostura Crítica"
                        value={generatedProfile.criticalProfile.criticalComposure}
                      />
                      <StatBar label="Ego" value={generatedProfile.criticalProfile.ego} />
                      <StatBar
                        label="Reação à Pressão da Torcida"
                        value={generatedProfile.criticalProfile.crowdPressureReaction}
                      />
                      <StatBar
                        label="Egoísta vs Coletivo"
                        value={generatedProfile.criticalProfile.selfishVsTeam}
                      />
                      <StatBar
                        label="Confiança em Finalizações"
                        value={generatedProfile.criticalProfile.finishingConfidence}
                      />
                    </div>
                  </div>

                  {/* Skills Equipadas */}
                  <div className="profile-section">
                    <h4>⚡ Skills Equipadas</h4>
                    <div className="equipped-skills">
                      {generatedProfile.equippedSkills.map((skillId) => {
                        const skill = SKILL_REGISTRY[skillId];
                        return skill ? (
                          <div key={skillId} className="skill-chip">
                            {skill.name}
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>

                  {/* Learning State */}
                  <div className="profile-section">
                    <h4>📈 Estado de Aprendizado</h4>
                    <div className="profile-stats">
                      <StatBar
                        label="Confiança"
                        value={generatedProfile.learningState.confidence}
                      />
                      <StatBar
                        label="Tendência de Risco"
                        value={generatedProfile.learningState.riskTendency}
                      />
                      <StatBar
                        label="Passe vs Chute"
                        value={generatedProfile.learningState.passVsShootPreference}
                      />
                      <StatBar
                        label="Compostura Crítica"
                        value={generatedProfile.learningState.criticalComposure}
                      />
                      <StatBar
                        label="Disciplina Tática"
                        value={generatedProfile.learningState.tacticalDiscipline}
                      />
                      <StatBar
                        label="Ego Controlado"
                        value={generatedProfile.learningState.egoControl}
                      />
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="profile-metadata">
                    <div>
                      <strong>Criado:</strong> {new Date(generatedProfile.createdAt).toLocaleString()}
                    </div>
                    <div>
                      <strong>Atualizado:</strong>{' '}
                      {new Date(generatedProfile.updatedAt).toLocaleString()}
                    </div>
                    <div>
                      <strong>Versão:</strong> {generatedProfile.version}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">Selecione um jogador para visualizar o perfil</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: SKILLS
// ─────────────────────────────────────────────────────────────
function SkillsTab() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(null);

  const allSkills = getAllSkills();
  const filteredSkills =
    selectedCategory === 'all'
      ? allSkills
      : getSkillsByCategory(selectedCategory as SkillDefinition['category']);

  return (
    <div className="skills-tab">
      <div className="skills-header">
        <h3>⚡ Catálogo de Skills ({allSkills.length})</h3>
        <div className="skills-filters">
          <button
            className={selectedCategory === 'all' ? 'active' : ''}
            onClick={() => setSelectedCategory('all')}
          >
            Todas
          </button>
          <button
            className={selectedCategory === 'spatial' ? 'active' : ''}
            onClick={() => setSelectedCategory('spatial')}
          >
            Espacial
          </button>
          <button
            className={selectedCategory === 'team' ? 'active' : ''}
            onClick={() => setSelectedCategory('team')}
          >
            Coletivo
          </button>
          <button
            className={selectedCategory === 'individual' ? 'active' : ''}
            onClick={() => setSelectedCategory('individual')}
          >
            Individual
          </button>
          <button
            className={selectedCategory === 'risk' ? 'active' : ''}
            onClick={() => setSelectedCategory('risk')}
          >
            Risco
          </button>
          <button
            className={selectedCategory === 'critical' ? 'active' : ''}
            onClick={() => setSelectedCategory('critical')}
          >
            Crítico
          </button>
        </div>
      </div>

      <div className="skills-grid">
        {/* Lista de skills */}
        <div className="skills-list">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className={`skill-item ${selectedSkill?.id === skill.id ? 'selected' : ''}`}
              onClick={() => setSelectedSkill(skill)}
            >
              <div className="skill-item-header">
                <span className="skill-name">{skill.name}</span>
                <span className={`skill-category ${skill.category}`}>{skill.category}</span>
              </div>
              <div className="skill-item-desc">{skill.description}</div>
              <div className="skill-item-positions">
                {skill.positions.includes('*') ? 'Todas as posições' : skill.positions.join(', ')}
              </div>
            </div>
          ))}
        </div>

        {/* Detalhes da skill */}
        <div className="skill-details">
          {selectedSkill ? (
            <>
              <h3>{selectedSkill.name}</h3>
              <p className="skill-description">{selectedSkill.description}</p>

              <div className="skill-info">
                <div className="skill-info-item">
                  <strong>Categoria:</strong> {selectedSkill.category}
                </div>
                <div className="skill-info-item">
                  <strong>Posições:</strong>{' '}
                  {selectedSkill.positions.includes('*')
                    ? 'Todas'
                    : selectedSkill.positions.join(', ')}
                </div>
                <div className="skill-info-item">
                  <strong>Cooldown:</strong>{' '}
                  {selectedSkill.cooldown === 0 ? 'Sempre ativa' : `${selectedSkill.cooldown}s`}
                </div>
              </div>

              <div className="skill-bias">
                <h4>Modificadores de Ação</h4>
                <div className="bias-list">
                  {Object.entries(selectedSkill.bias).map(([action, value]) => {
                    const numValue = typeof value === 'number' ? value : 0;
                    return (
                      <div key={action} className="bias-item">
                        <span className="bias-action">{action}</span>
                        <span className={`bias-value ${numValue > 0 ? 'positive' : 'negative'}`}>
                          {numValue > 0 ? '+' : ''}
                          {numValue.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="skill-code">
                <h4>Condição de Ativação</h4>
                <pre>{selectedSkill.when.toString()}</pre>
              </div>

              <div className="skill-code">
                <h4>Função de Score</h4>
                <pre>{selectedSkill.score.toString()}</pre>
              </div>
            </>
          ) : (
            <div className="empty-state">Selecione uma skill para ver detalhes</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: GERADOR
// ─────────────────────────────────────────────────────────────
function GeneratorTab({ players }: { players: Record<string, PlayerEntity> }) {
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: [],
  });

  const playersList = Object.values(players);

  const handleGenerateAll = () => {
    setGenerating(true);
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const player of playersList) {
      try {
        const profile = createAgentProfile(player);
        const validation = validateAgentProfile(profile);
        if (validation.valid) {
          success++;
        } else {
          failed++;
          errors.push(`${player.name}: ${validation.errors.join(', ')}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${player.name}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }

    setResults({ success, failed, errors });
    setGenerating(false);
  };

  return (
    <div className="generator-tab">
      <div className="generator-header">
        <h3>🏭 Gerador em Massa</h3>
        <p>Gera AgentProfiles para todos os jogadores do plantel</p>
      </div>

      <div className="generator-stats">
        <div className="stat-box">
          <div className="stat-value">{playersList.length}</div>
          <div className="stat-label">Jogadores no Plantel</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{results.success}</div>
          <div className="stat-label">Perfis Gerados</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{results.failed}</div>
          <div className="stat-label">Falhas</div>
        </div>
      </div>

      <div className="generator-actions">
        <button
          onClick={handleGenerateAll}
          disabled={generating}
          className="btn-primary btn-large"
        >
          {generating ? '⏳ Gerando...' : '🚀 Gerar Todos os Perfis'}
        </button>
      </div>

      {results.errors.length > 0 && (
        <div className="generator-errors">
          <h4>❌ Erros Encontrados</h4>
          <ul>
            {results.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: TESTES
// ─────────────────────────────────────────────────────────────
function TestTab({ players }: { players: Record<string, PlayerEntity> }) {
  const [testType, setTestType] = useState<'intent' | 'skills'>('intent');

  return (
    <div className="test-tab">
      <div className="test-header">
        <h3>🧪 Testes de Sistema</h3>
        <div className="test-type-selector">
          <button
            className={testType === 'intent' ? 'active' : ''}
            onClick={() => setTestType('intent')}
          >
            Intenção do Time
          </button>
          <button
            className={testType === 'skills' ? 'active' : ''}
            onClick={() => setTestType('skills')}
          >
            Skills por Posição
          </button>
        </div>
      </div>

      {testType === 'intent' && <TeamIntentTest />}
      {testType === 'skills' && <SkillsPositionTest players={players} />}
    </div>
  );
}

function TeamIntentTest() {
  const [minute, setMinute] = useState(45);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [teamStrength, setTeamStrength] = useState(75);
  const [opponentStrength, setOpponentStrength] = useState(70);
  const [fatigue, setFatigue] = useState(50);

  const intent = resolveTeamIntent({
    minute,
    homeScore,
    awayScore,
    possession: 'home',
    teamStrength,
    opponentStrength,
    averageFatigue: fatigue,
  });

  return (
    <div className="team-intent-test">
      <h4>Teste de Intenção do Time</h4>

      <div className="test-controls">
        <div className="control-group">
          <label>Minuto: {minute}</label>
          <input
            type="range"
            min="0"
            max="90"
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Placar Casa: {homeScore}</label>
          <input
            type="range"
            min="0"
            max="5"
            value={homeScore}
            onChange={(e) => setHomeScore(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Placar Visitante: {awayScore}</label>
          <input
            type="range"
            min="0"
            max="5"
            value={awayScore}
            onChange={(e) => setAwayScore(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Força do Time: {teamStrength}</label>
          <input
            type="range"
            min="50"
            max="100"
            value={teamStrength}
            onChange={(e) => setTeamStrength(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Força do Adversário: {opponentStrength}</label>
          <input
            type="range"
            min="50"
            max="100"
            value={opponentStrength}
            onChange={(e) => setOpponentStrength(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Fadiga Média: {fatigue}</label>
          <input
            type="range"
            min="0"
            max="100"
            value={fatigue}
            onChange={(e) => setFatigue(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="test-result">
        <h4>Intenção Resolvida:</h4>
        <div className="intent-result">
          <span className="intent-badge">{intent}</span>
          <span className="intent-description">{getTeamIntentDescription(intent)}</span>
        </div>
      </div>
    </div>
  );
}

function SkillsPositionTest({ players }: { players: Record<string, PlayerEntity> }) {
  const [selectedPos, setSelectedPos] = useState('ATA');

  const positions = Array.from(new Set(Object.values(players).map((p) => p.pos.toUpperCase())));
  const skillsForPos = getSkillsByPosition(selectedPos);

  return (
    <div className="skills-position-test">
      <h4>Skills por Posição</h4>

      <div className="position-selector">
        {positions.map((pos) => (
          <button
            key={pos}
            className={selectedPos === pos ? 'active' : ''}
            onClick={() => setSelectedPos(pos)}
          >
            {pos}
          </button>
        ))}
      </div>

      <div className="skills-result">
        <h4>Skills Disponíveis para {selectedPos}:</h4>
        <div className="skills-list-simple">
          {skillsForPos.map((skill) => (
            <div key={skill.id} className="skill-item-simple">
              <span className="skill-name">{skill.name}</span>
              <span className={`skill-category ${skill.category}`}>{skill.category}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: APRENDIZADO
// ─────────────────────────────────────────────────────────────
function LearningTab({ players }: { players: Record<string, PlayerEntity> }) {
  return (
    <div className="learning-tab">
      <div className="learning-header">
        <h3>📈 Sistema de Aprendizado</h3>
        <p>Visualização de evolução e eventos de aprendizado</p>
      </div>

      <div className="learning-info">
        <div className="info-box">
          <h4>Como Funciona</h4>
          <ul>
            <li>✅ Passes certos sob pressão aumentam confiança e disciplina</li>
            <li>❌ Passes errados diminuem confiança</li>
            <li>⚽ Gols aumentam confiança e tendência de risco</li>
            <li>🎯 Chutes errados diminuem confiança em finalizações</li>
            <li>🤝 Decisões coletivas bem-sucedidas aumentam disciplina</li>
            <li>😤 Decisões egoístas mal-sucedidas aumentam controle de ego</li>
          </ul>
        </div>

        <div className="info-box">
          <h4>Eventos Capturados</h4>
          <ul>
            <li>pass_ok / pass_fail</li>
            <li>shot_ok / shot_fail</li>
            <li>duel_won / duel_lost</li>
            <li>critical_error / critical_success</li>
            <li>selfish_ok / selfish_fail</li>
          </ul>
        </div>

        <div className="info-box">
          <h4>Evolução</h4>
          <p>
            Após cada partida, o sistema atualiza o LearningState do AgentProfile baseado nos
            eventos capturados. A evolução é gradual e realista, sem mudanças drásticas.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────────
function StatBar({ label, value }: { label: string; value: number }) {
  const numValue = typeof value === 'number' ? value : 0;
  const percentage = Math.max(0, Math.min(100, numValue));
  const color =
    percentage >= 80 ? '#10b981' : percentage >= 60 ? '#3b82f6' : percentage >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="stat-bar">
      <div className="stat-bar-header">
        <span className="stat-bar-label">{label}</span>
        <span className="stat-bar-value">{Math.round(numValue)}</span>
      </div>
      <div className="stat-bar-track">
        <div className="stat-bar-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
