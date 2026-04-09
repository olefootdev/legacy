import { useCallback, useMemo } from 'react';
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  MISSION_CATALOG,
  expToNextLevel,
  getManagerLevel,
  useProgressionStore,
  type MissionDef,
  type MissionKind,
} from '@/progression';

const KIND_ORDER: MissionKind[] = ['onboarding', 'daily', 'weekly', 'achievement'];

const KIND_LABEL: Record<MissionKind, string> = {
  onboarding: 'Onboarding',
  daily: 'Diárias',
  weekly: 'Semanais',
  achievement: 'Conquistas',
};

type Section = { title: string; kind: MissionKind; data: MissionDef[] };

export function MissionsScreen() {
  const trackMissionEvent = useProgressionStore((s) => s.trackMissionEvent);
  const claimMission = useProgressionStore((s) => s.claimMission);
  const expBalance = useProgressionStore((s) => s.expBalance);
  const expLifetimeEarned = useProgressionStore((s) => s.expLifetimeEarned);
  const missionProgress = useProgressionStore((s) => s.missionProgress);

  useFocusEffect(
    useCallback(() => {
      trackMissionEvent('screen_missions');
    }, [trackMissionEvent]),
  );

  const level = getManagerLevel(expLifetimeEarned);
  const { ratio, remaining } = expToNextLevel(expLifetimeEarned);

  const sections: Section[] = useMemo(() => {
    const byKind: Record<MissionKind, MissionDef[]> = {
      onboarding: [],
      daily: [],
      weekly: [],
      achievement: [],
    };
    for (const m of MISSION_CATALOG) {
      byKind[m.kind].push(m);
    }
    return KIND_ORDER.filter((k) => byKind[k].length > 0).map((kind) => ({
      title: KIND_LABEL[kind],
      kind,
      data: byKind[kind],
    }));
  }, []);

  const onClaim = (id: string) => {
    const ok = claimMission(id);
    if (ok) {
      Alert.alert('Missão resgatada', 'EXP adicionado ao saldo e ao histórico vitalício.');
    } else {
      Alert.alert('Não foi possível resgatar', 'Complete a meta ou aguarde reset diário/semanal.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.rankHint}>Ranking mundial usa só o saldo EXP (gastos reduzem).</Text>
        <Text style={styles.levelLine}>
          Nível do manager: <Text style={styles.accent}>{level}</Text> / 25
        </Text>
        <Text style={styles.balance}>
          Saldo EXP: <Text style={styles.accent}>{expBalance}</Text>
        </Text>
        <Text style={styles.life}>EXP vitalício (nível): {expLifetimeEarned}</Text>
        {level < 25 && (
          <>
            <Text style={styles.next}>Faltam {remaining} EXP vitalício para o próximo nível</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
            </View>
          </>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const st = missionProgress[item.id] ?? { progress: 0, claimed: false };
          const done = st.progress >= item.targetCount;
          return (
            <View style={styles.card}>
              <Text style={styles.mTitle}>{item.title}</Text>
              <Text style={styles.mDesc}>{item.description}</Text>
              <Text style={styles.mProg}>
                Progresso: {st.progress} / {item.targetCount} · +{item.rewardExp} EXP
              </Text>
              <Pressable
                style={[styles.claim, (!done || st.claimed) && styles.claimOff]}
                disabled={!done || st.claimed}
                onPress={() => onClaim(item.id)}
              >
                <Text style={[styles.claimText, (!done || st.claimed) && styles.claimTextOff]}>
                  {st.claimed ? 'Resgatada' : 'Resgatar'}
                </Text>
              </Pressable>
            </View>
          );
        }}
        contentContainerStyle={styles.listPad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', gap: 6 },
  rankHint: { color: '#666', fontSize: 10 },
  levelLine: { color: '#fff', fontSize: 16, fontWeight: '700' },
  accent: { color: '#E4FF00' },
  balance: { color: '#ccc', fontSize: 14 },
  life: { color: '#8899aa', fontSize: 12 },
  next: { color: '#8899aa', fontSize: 11 },
  barBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#222',
    overflow: 'hidden',
    marginTop: 4,
  },
  barFill: { height: '100%', backgroundColor: '#E4FF00' },
  listPad: { padding: 12, paddingBottom: 32 },
  sectionTitle: {
    color: '#E4FF00',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#111820',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffffff18',
    padding: 12,
    marginBottom: 10,
  },
  mTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  mDesc: { color: '#8899aa', fontSize: 12, marginTop: 4 },
  mProg: { color: '#aaa', fontSize: 11, marginTop: 8 },
  claim: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E4FF00',
  },
  claimOff: { backgroundColor: '#333', opacity: 0.7 },
  claimText: { color: '#000', fontWeight: '800', fontSize: 13 },
  claimTextOff: { color: '#888' },
});
