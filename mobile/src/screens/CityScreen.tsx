import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useProgressionStore } from '@/progression';

export function CityScreen() {
  const trackMissionEvent = useProgressionStore((s) => s.trackMissionEvent);

  useFocusEffect(
    useCallback(() => {
      trackMissionEvent('screen_city');
    }, [trackMissionEvent]),
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Cidade</Text>
      <Text style={styles.body}>Estruturas do clube.</Text>
      <Pressable
        style={styles.btn}
        onPress={() => {
          trackMissionEvent('structure_upgraded');
        }}
      >
        <Text style={styles.btnText}>Evoluir estrutura (stub)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10', padding: 16, gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  body: { color: '#8899aa', fontSize: 14 },
  btn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4FF0044',
    backgroundColor: '#E4FF0014',
  },
  btnText: { color: '#E4FF00', fontWeight: '700', fontSize: 13 },
});
