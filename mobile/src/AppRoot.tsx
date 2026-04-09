import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useProgressionStore } from '@/progression';
import { AppNavigator } from '@/navigation/AppNavigator';

export function AppRoot() {
  useEffect(() => {
    const bootstrap = () => {
      const api = useProgressionStore.getState();
      api.ensureResets();
      api.trackMissionEvent('session_login');
    };

    if (useProgressionStore.persist.hasHydrated()) {
      bootstrap();
      return undefined;
    }
    return useProgressionStore.persist.onFinishHydration(bootstrap);
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
