import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GAT_DURATION_MONTHS, GAT_TIER_SUMMARY_PT } from '../../../../src/wallet/constants';

interface Props {
  onBack: () => void;
}

export function GatScreen({ onBack }: Props) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Carteira</Text>
      </Pressable>

      <Text style={styles.title}>Game Assets Treasury</Text>
      <Text style={styles.desc}>
        Recompensa diária automática em EXP por faixa sobre a base em BRO; referral GAT 1%/nível em EXP.{' '}
        {GAT_DURATION_MONTHS} meses por posição. {GAT_TIER_SUMMARY_PT}
      </Text>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Os valores exibidos representam rewards calculados sobre compras realizadas. Este{' '}
          <Text style={styles.bold}>não é um saldo em custódia</Text>; o GAT é um programa de
          recompensa sobre gastos no ecossistema.
        </Text>
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Base Elegível</Text>
          <Text style={styles.summaryValue}>0.00</Text>
          <Text style={styles.summaryUnit}>BRO</Text>
        </View>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Reward Acum.</Text>
          <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>+0</Text>
          <Text style={styles.summaryUnit}>EXP</Text>
        </View>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Posições</Text>
          <Text style={styles.summaryValue}>0</Text>
          <Text style={styles.summaryUnit}>0 ativa(s)</Text>
        </View>
      </View>

      {/* Empty state */}
      <Text style={styles.sectionTitle}>Posições por Categoria</Text>
      <Text style={styles.emptyText}>Nenhuma posição GAT registrada.</Text>

      <Text style={styles.sectionTitle}>Histórico de Rewards</Text>
      <Text style={styles.emptyText}>Nenhum reward GAT registrado.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  backBtn: { marginBottom: 4 },
  backText: { color: '#8899aa', fontSize: 13 },
  title: { color: '#f59e0b', fontSize: 22, fontWeight: '800' },
  desc: { color: '#8899aa', fontSize: 13, marginBottom: 4 },
  disclaimer: {
    backgroundColor: '#f59e0b08',
    borderWidth: 1,
    borderColor: '#f59e0b33',
    borderRadius: 12,
    padding: 14,
  },
  disclaimerText: { color: '#f59e0bcc', fontSize: 12, lineHeight: 18 },
  bold: { fontWeight: '700' },
  summaryCard: {
    backgroundColor: '#111318',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f59e0b22',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryCol: { alignItems: 'center', gap: 4 },
  summaryLabel: { color: '#8899aa', fontSize: 10 },
  summaryValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  summaryUnit: { color: '#555', fontSize: 10 },
  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginTop: 6 },
  emptyText: { color: '#555', fontSize: 12 },
});
