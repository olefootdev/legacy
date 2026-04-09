import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { OLEXP_PLANS } from '../../../../src/wallet/constants';
import { estimateYield } from '../../../../src/wallet/olexp';
import type { OlexpPlanId } from '../../../../src/wallet/types';

interface Props {
  onBack: () => void;
}

export function OlexpScreen({ onBack }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<OlexpPlanId>('90d');
  const [amount, setAmount] = useState('');
  const [kycDone, setKycDone] = useState(false);

  const plan = OLEXP_PLANS.find((p) => p.id === selectedPlan)!;
  const amountCents = Math.round((parseFloat(amount) || 0) * 100);
  const est = estimateYield(selectedPlan, amountCents);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Carteira</Text>
      </Pressable>

      <Text style={styles.title}>OLEXP</Text>
      <Text style={styles.desc}>
        Yield diário (seg–sex) sobre o principal, sem capitalização. Mín. 300 BRO.
      </Text>

      {!kycDone ? (
        <View style={styles.kycCard}>
          <Text style={styles.kycTitle}>Ativação OLEXP</Text>
          <Text style={styles.kycText}>
            Aceite o termo de risco e complete a verificação leve de identidade para ativar.
          </Text>
          <Pressable style={styles.kycBtn} onPress={() => setKycDone(true)}>
            <Text style={styles.kycBtnText}>Ativar OLEXP</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Nova posição</Text>

          {/* Plan selector */}
          <View style={styles.planRow}>
            {OLEXP_PLANS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setSelectedPlan(p.id)}
                style={[
                  styles.planBtn,
                  selectedPlan === p.id && styles.planBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.planDays,
                    selectedPlan === p.id && styles.planDaysActive,
                  ]}
                >
                  {p.days}d
                </Text>
                <Text style={styles.planRate}>
                  {(p.dailyRate * 100).toFixed(3)}%/dia
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Amount input */}
          <Text style={styles.inputLabel}>Valor (BRO)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder={`Mín. ${plan.minBroCents / 100}`}
            placeholderTextColor="#555"
            keyboardType="numeric"
          />

          {/* Yield preview */}
          {amountCents > 0 && (
            <View style={styles.preview}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Yield diário estimado</Text>
                <Text style={styles.previewValue}>
                  {(est.dailyYieldCents / 100).toFixed(2)} BRO
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Dias úteis (~)</Text>
                <Text style={styles.previewValueWhite}>{est.businessDaysApprox}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabelBold}>Total estimado</Text>
                <Text style={styles.previewTotal}>
                  {(est.totalYieldCents / 100).toFixed(2)} BRO
                </Text>
              </View>
            </View>
          )}

          <Pressable style={styles.confirmBtn}>
            <Text style={styles.confirmBtnText}>Confirmar Posição</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  backBtn: { marginBottom: 4 },
  backText: { color: '#8899aa', fontSize: 13 },
  title: { color: '#a855f4', fontSize: 22, fontWeight: '800' },
  desc: { color: '#8899aa', fontSize: 13, marginBottom: 4 },
  kycCard: {
    backgroundColor: '#111318',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#a855f444',
    alignItems: 'center',
    gap: 12,
  },
  kycTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  kycText: { color: '#8899aa', fontSize: 13, textAlign: 'center', maxWidth: 280 },
  kycBtn: {
    backgroundColor: '#a855f4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
  },
  kycBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  formCard: {
    backgroundColor: '#111318',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#a855f422',
    gap: 14,
  },
  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  planRow: { flexDirection: 'row', gap: 10 },
  planBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ffffff15',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#ffffff08',
  },
  planBtnActive: { borderColor: '#a855f4', backgroundColor: '#a855f418' },
  planDays: { color: '#8899aa', fontWeight: '800', fontSize: 14 },
  planDaysActive: { color: '#a855f4' },
  planRate: { color: '#666', fontSize: 10, marginTop: 2 },
  inputLabel: { color: '#8899aa', fontSize: 11 },
  input: {
    backgroundColor: '#ffffff08',
    borderWidth: 1,
    borderColor: '#ffffff15',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
  },
  preview: {
    backgroundColor: '#ffffff08',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewLabel: { color: '#8899aa', fontSize: 13 },
  previewValue: { color: '#a855f4', fontSize: 13 },
  previewValueWhite: { color: '#ccc', fontSize: 13 },
  previewLabelBold: { color: '#ccc', fontSize: 13, fontWeight: '700' },
  previewTotal: { color: '#00FF66', fontSize: 13, fontWeight: '700' },
  confirmBtn: {
    backgroundColor: '#a855f4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
