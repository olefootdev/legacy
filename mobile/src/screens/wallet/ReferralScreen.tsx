import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

interface Props {
  onBack: () => void;
}

export function ReferralScreen({ onBack }: Props) {
  const [sponsorInput, setSponsorInput] = useState('');
  const [sponsorSet, setSponsorSet] = useState(false);
  const myCode = 'OLEFOOT-USER-SELF';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Carteira</Text>
      </Pressable>

      <Text style={styles.title}>Indicações</Text>
      <Text style={styles.desc}>
        3 níveis, 5% sobre ganho elegível. Sem pirâmide sobre referral, yield ou bônus.
      </Text>

      {/* My code */}
      <View style={styles.card}>
        <Text style={styles.label}>Seu código de indicação</Text>
        <View style={styles.codeRow}>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{myCode}</Text>
          </View>
          <Pressable style={styles.copyBtn}>
            <Text style={styles.copyBtnText}>Copiar</Text>
          </Pressable>
        </View>
      </View>

      {/* Set sponsor */}
      {!sponsorSet && (
        <View style={styles.card}>
          <Text style={styles.label}>Código do patrocinador</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={styles.input}
              value={sponsorInput}
              onChangeText={setSponsorInput}
              placeholder="Insira o código"
              placeholderTextColor="#555"
            />
            <Pressable
              style={[styles.linkBtn, !sponsorInput.trim() && styles.linkBtnDisabled]}
              onPress={() => {
                if (sponsorInput.trim()) setSponsorSet(true);
              }}
            >
              <Text style={styles.linkBtnText}>Vincular</Text>
            </Pressable>
          </View>
        </View>
      )}

      {sponsorSet && (
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            Patrocinador: <Text style={styles.infoHighlight}>{sponsorInput}</Text>
          </Text>
        </View>
      )}

      {/* Network levels */}
      <Text style={styles.sectionTitle}>Rede — 3 Níveis</Text>
      <View style={styles.levelsRow}>
        {[1, 2, 3].map((level) => (
          <View key={level} style={styles.levelCard}>
            <Text style={styles.levelLabel}>Nível {level}</Text>
            <Text style={styles.levelCount}>—</Text>
            <Text style={styles.levelEarn}>+0.00 BRO</Text>
          </View>
        ))}
      </View>

      {/* Commissions */}
      <Text style={styles.sectionTitle}>Comissões OLE Game</Text>
      <Text style={styles.emptyText}>Nenhuma comissão OLE Game registrada.</Text>

      <Text style={styles.sectionTitle}>Comissões NFT</Text>
      <Text style={styles.emptyText}>Nenhuma comissão NFT registrada.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  backBtn: { marginBottom: 4 },
  backText: { color: '#8899aa', fontSize: 13 },
  title: { color: '#3b82f6', fontSize: 22, fontWeight: '800' },
  desc: { color: '#8899aa', fontSize: 13, marginBottom: 4 },
  card: {
    backgroundColor: '#111318',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3b82f622',
    gap: 10,
  },
  label: { color: '#8899aa', fontSize: 11 },
  codeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  codeBox: {
    flex: 1,
    backgroundColor: '#ffffff08',
    borderWidth: 1,
    borderColor: '#ffffff15',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeText: { color: '#fff', fontFamily: 'monospace', fontSize: 13 },
  copyBtn: {
    backgroundColor: '#3b82f618',
    borderWidth: 1,
    borderColor: '#3b82f644',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  copyBtnText: { color: '#3b82f6', fontWeight: '700', fontSize: 13 },
  input: {
    flex: 1,
    backgroundColor: '#ffffff08',
    borderWidth: 1,
    borderColor: '#ffffff15',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 13,
  },
  linkBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  linkBtnDisabled: { backgroundColor: '#ffffff08' },
  linkBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  infoRow: {
    backgroundColor: '#ffffff08',
    borderRadius: 10,
    padding: 12,
  },
  infoText: { color: '#8899aa', fontSize: 12 },
  infoHighlight: { color: '#fff', fontWeight: '600' },
  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginTop: 6 },
  levelsRow: { flexDirection: 'row', gap: 10 },
  levelCard: {
    flex: 1,
    backgroundColor: '#ffffff08',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff08',
    gap: 4,
  },
  levelLabel: { color: '#8899aa', fontSize: 10 },
  levelCount: { color: '#fff', fontSize: 18, fontWeight: '800' },
  levelEarn: { color: '#3b82f6', fontSize: 10 },
  emptyText: { color: '#555', fontSize: 12 },
});
