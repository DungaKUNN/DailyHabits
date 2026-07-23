import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Lightning,
  Wallet,
  ChartBar,
  User,
} from 'phosphor-react-native';

import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import ExpensesScreen from '../screens/ExpensesScreen';
import FinancesTabScreen from '../screens/FinancesTabScreen';
import FinanceDetailScreen from '../screens/FinanceDetailScreen';
import StatisticsScreen from '../screens/StatisticsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import FloorsConfigScreen from '../screens/FloorsConfigScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import { getSavedGroupCode } from '../../services/SyncService';

export type RootStackParamList = {
  Welcome: undefined;
  MainTabs: undefined;
  ExpenseDetail: { periodId: string };
  FinanceDetail: { periodId: string };
  FloorsConfig: undefined;
};

export type TabParamList = {
  Gastos: undefined;
  Finanzas: undefined;
  Estadísticas: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

const LOG_PREFIX = '[AppNavigator]';

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const iconColor = focused ? colors.primary.main : colors.textMuted;
  const size = 24;

  const icons: Record<string, React.ReactNode> = {
    gastos: <Lightning size={size} color={iconColor} weight={focused ? 'fill' : 'regular'} />,
    finanzas: <Wallet size={size} color={iconColor} weight={focused ? 'fill' : 'regular'} />,
    estadisticas: <ChartBar size={size} color={iconColor} weight={focused ? 'fill' : 'regular'} />,
    perfil: <User size={size} color={iconColor} weight={focused ? 'fill' : 'regular'} />,
  };

  return <View>{icons[name]}</View>;
};

const MainTabs = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.common.white,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: insets.bottom > 0 ? 64 + insets.bottom : 64,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          ...shadows.lg,
        },
        tabBarActiveTintColor: colors.primary.main,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: typography.tabLabel,
      }}
    >
      <Tab.Screen
        name="Gastos"
        component={ExpensesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="gastos" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Finanzas"
        component={FinancesTabScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="finanzas" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Estadísticas"
        component={StatisticsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="estadisticas" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="perfil" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const RootNavigator = () => {
  const [hasGroup, setHasGroup] = useState<boolean | null>(null);
  const [fontsLoaded] = useFonts({});

  useEffect(() => {
    const checkGroup = async () => {
      const groupCode = await getSavedGroupCode();
      setHasGroup(!!groupCode);
    };
    checkGroup();
  }, []);

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const handleGroupReady = () => {
    setHasGroup(true);
  };

  if (hasGroup === null) return null;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.common.white,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          ...typography.h4,
          color: colors.text,
        },
      }}
    >
      {!hasGroup ? (
        <Stack.Screen
          name="Welcome"
          options={{ headerShown: false }}
        >
          {() => <WelcomeScreen onGroupReady={handleGroupReady} />}
        </Stack.Screen>
      ) : (
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
      )}
      <Stack.Screen
        name="ExpenseDetail"
        component={ExpenseDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FinanceDetail"
        component={FinanceDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FloorsConfig"
        component={FloorsConfigScreen}
        options={{ title: 'Configuración de Pisos' }}
      />
    </Stack.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
};
