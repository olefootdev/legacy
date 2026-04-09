import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useProgressionStore } from '@/progression';
import { OlexpScreen } from './wallet/OlexpScreen';
import { ReferralScreen } from './wallet/ReferralScreen';
import { GatScreen } from './wallet/GatScreen';

type WalletTab = 'home' | 'olexp' | 'referrals' | 'gat';

export function WalletScreen() {
  const trackMissionEvent = useProgressionStore((s) => s.trackMissionEvent);
  const expBalance = useProgressionStore((s) => s.expBalance);
  const [activeTab, setActiveTab] = useState<WalletTab>('home');

  useFocusEffect(
    useCallback(() => {
      trackMissionEvent('screen_wallet');
    }, [trackMissionEvent]),
  );

  if (activeTab === 'olexp') return <OlexpScreen onBack={() => setActiveTab('home')} />;
  if (activeTab === 'referrals') return <ReferralScreen onBack={() => setActiveTab('home')} />;
  if (activeTab === 'gat') return <GatScreen onBack={() => setActiveTab('home')} />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Carteira</Text>

      {/* SPOT balance */}
      <View style={styles.card}>
        <Text style={styles.label}>Saldo EXP (ranking)</Text>
        <Text style={styles.balance}>{expBalance}</Text>
        <View style={styles.row}>
          <Pressable style={styles.btnOutline}>
            <Text style={styles.btnOutlineText}>Depositar</Text>
          </Pressable>
          <Pressable style={styles.btnOutline}>
            <Text style={[styles.btnOutlineText, { color: '#ff5555' }]}>Sacar</Text>
          </Pressable>
        </View>
      </View>

      {/* Module cards */}
      <Pressable style={[styles.moduleCard, { borderColor: '#a855f444' }]} onPress={() => setActiveTab('olexp')}>
        <Text style={[styles.moduleLabel, { color: '#a855f4' }]}>OLEXP</Text>
        <Text style={styles.moduleDesc}>Yield diário sobre BRO staked</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={[styles.moduleCard, { borderColor: '#3b82f644' }]} onPress={() => setActiveTab('referrals')}>
        <Text style={[styles.moduleLabel, { color: '#3b82f6' }]}>Indicações</Text>
        <Text style={styles.moduleDesc}>3 níveis · 5% sobre ganho elegível</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={[styles.moduleCard, { borderColor: '#f59e0b44' }]} onPress={() => setActiveTab('gat')}>
        <Text style={[styles.moduleLabel, { color: '#f59e0b' }]}>GAT</Text>
        <Text style={styles.moduleDesc}>Reward sobre compras no ecossistema</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10' },
  content: { padding: 16, gap: 14 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  card: {
    backgroundColor: '#111318',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4FF0022',
    gap: 10,
  },
  label: { color: '#8899aa', fontSize: 12 },
  balance: { color: '#E4FF00', fontSize: 32, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btnOutline: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff0d',
    alignItems: 'center',
  },
  btnOutlineText: { color: '#00FF66', fontWeight: '700', fontSize: 13 },
  moduleCard: {
    backgroundColor: '#111318',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moduleLabel: { fontWeight: '800', fontSize: 14, width: 80 },
  moduleDesc: { flex: 1, color: '#8899aa', fontSize: 12 },
  chevron: { color: '#555', fontSize: 20, fontWeight: '300' },
});
