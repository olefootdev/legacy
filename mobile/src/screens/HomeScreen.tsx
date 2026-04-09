import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useProgressionStore } from '@/progression';

export function HomeScreen() {
  const trackMissionEvent = useProgressionStore((s) => s.trackMissionEvent);

  useFocusEffect(
    useCallback(() => {
      trackMissionEvent('screen_home');
    }, [trackMissionEvent]),
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.body}>Bem-vindo ao OLEFOOT.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10', padding: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  body: { color: '#8899aa', marginTop: 8, fontSize: 14 },
});
