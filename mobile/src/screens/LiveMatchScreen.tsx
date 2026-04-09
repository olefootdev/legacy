import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  MatchPitchWebView,
  getMatchPitchUrl,
  type MatchPitchWebViewHandle,
} from '@/components/MatchPitchWebView';
import type { MatchTruthSnapshot } from '@/types/matchTruth';
import { MATCH_TRUTH_SCHEMA_VERSION } from '@/types/matchTruth';
import { useProgressionStore } from '@/progression';

const OLEFOOT_WEB = process.env.EXPO_PUBLIC_OLEFOOT_WEB_URL ?? '';

function stubSnapshot(): MatchTruthSnapshot {
  return {
    schemaVersion: MATCH_TRUTH_SCHEMA_VERSION,
    t: 0,
    ball: { x: 52, y: 0.2, z: 34 },
    matchPhase: 'live',
    players: [
      { id: 'h-ata', side: 'home', x: 78, y: 0, z: 34, role: 'attack' },
      { id: 'a-zag1', side: 'away', x: 28, y: 0, z: 26, role: 'def' },
    ],
  };
}

export function LiveMatchScreen() {
  const pitchRef = useRef<MatchPitchWebViewHandle>(null);
  const [lastBridge, setLastBridge] = useState<string>('—');
  const trackMissionEvent = useProgressionStore((s) => s.trackMissionEvent);

  const sendStub = useCallback(() => {
    pitchRef.current?.injectSnapshot(stubSnapshot());
    setLastBridge('Snapshot stub enviado');
  }, []);

  const onMessageFromWeb = useCallback((raw: string) => {
    setLastBridge(raw.slice(0, 120));
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.header}>
        <Text style={styles.title}>Partida ao vivo</Text>
        {OLEFOOT_WEB ? (
          <View style={styles.row}>
            <Pressable
              style={styles.btn}
              onPress={() => Linking.openURL(`${OLEFOOT_WEB.replace(/\/$/, '')}/match/auto`)}
            >
              <Text style={styles.btnText}>Automática (web)</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => Linking.openURL(`${OLEFOOT_WEB.replace(/\/$/, '')}/match/quick`)}
            >
              <Text style={styles.btnText}>Rápida (web)</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.hint}>
            EXPO_PUBLIC_OLEFOOT_WEB_URL → abrir partida auto/rápida no browser (sem estádio).
          </Text>
        )}
        <Text style={styles.sub}>Pitch: {getMatchPitchUrl()}</Text>
        <Text style={styles.hint}>
          Dispositivo físico: defina EXPO_PUBLIC_PITCH_URL com o IP da máquina (porta 5174).
        </Text>
        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={sendStub}>
            <Text style={styles.btnText}>Enviar snapshot (stub)</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <Pressable
            style={styles.btn}
            onPress={() => {
              trackMissionEvent('match_completed');
            }}
          >
            <Text style={styles.btnText}>Partida concluída</Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={() => {
              trackMissionEvent('fast_match_completed');
            }}
          >
            <Text style={styles.btnText}>Partida rápida</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <Pressable
            style={styles.btn}
            onPress={() => {
              trackMissionEvent('match_won');
            }}
          >
            <Text style={styles.btnText}>Vitória</Text>
          </Pressable>
          <Pressable
            style={styles.btn}
            onPress={() => {
              trackMissionEvent('goal_scored', { count: 1 });
            }}
          >
            <Text style={styles.btnText}>+1 gol</Text>
          </Pressable>
        </View>
        <Text style={styles.bridge}>Ponte: {lastBridge}</Text>
      </ScrollView>
      <View style={styles.pitch}>
        <MatchPitchWebView ref={pitchRef} onMessageFromWeb={onMessageFromWeb} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10' },
  scroll: { maxHeight: 280 },
  header: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, gap: 6 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sub: { color: '#8899aa', fontSize: 11 },
  hint: { color: '#555', fontSize: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4FF0044',
    backgroundColor: '#E4FF0014',
  },
  btnText: { color: '#E4FF00', fontWeight: '700', fontSize: 11 },
  bridge: { color: '#666', fontSize: 10, marginTop: 4 },
  pitch: { flex: 1, minHeight: 200 },
});
