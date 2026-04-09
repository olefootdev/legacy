import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '@/screens/HomeScreen';
import { TeamScreen } from '@/screens/TeamScreen';
import { CityScreen } from '@/screens/CityScreen';
import { WalletScreen } from '@/screens/WalletScreen';
import { TransferScreen } from '@/screens/TransferScreen';
import { StoreScreen } from '@/screens/StoreScreen';
import { MissionsScreen } from '@/screens/MissionsScreen';
import { LiveMatchScreen } from '@/screens/LiveMatchScreen';

export type RootTabParamList = {
  Home: undefined;
  Team: undefined;
  City: undefined;
  Wallet: undefined;
  Transfer: undefined;
  Store: undefined;
  Missions: undefined;
  Live: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0c10' },
        headerTintColor: '#E4FF00',
        tabBarStyle: { backgroundColor: '#0a0c10', borderTopColor: '#1a1a1a' },
        tabBarActiveTintColor: '#E4FF00',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: { fontSize: 9, fontWeight: '700' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tab.Screen name="Team" component={TeamScreen} options={{ title: 'Time', tabBarLabel: 'Time' }} />
      <Tab.Screen name="City" component={CityScreen} options={{ title: 'Cidade', tabBarLabel: 'Cidade' }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: 'Carteira', tabBarLabel: '$' }} />
      <Tab.Screen name="Transfer" component={TransferScreen} options={{ title: 'Mercado', tabBarLabel: 'Merc.' }} />
      <Tab.Screen name="Store" component={StoreScreen} options={{ title: 'Loja', tabBarLabel: 'Loja' }} />
      <Tab.Screen name="Missions" component={MissionsScreen} options={{ title: 'Missões', tabBarLabel: 'Missões' }} />
      <Tab.Screen name="Live" component={LiveMatchScreen} options={{ title: 'Ao vivo', tabBarLabel: 'Ao vivo' }} />
    </Tab.Navigator>
  );
}
