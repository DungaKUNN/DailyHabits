import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import ExpensesScreen from '../screens/ExpensesScreen';
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
  FloorsConfig: undefined;
};

export type TabParamList = {
  Gastos: undefined;
  Estadísticas: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
  <Ionicons
    name={name as any}
    size={24}
    color={focused ? colors.primary.main : colors.textMuted}
  />
);

const MainTabs = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          ...styles.tabBar,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: insets.bottom > 0 ? 60 + insets.bottom : 60,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary.main,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Gastos"
        component={ExpensesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'wallet' : 'wallet-outline'} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Estadísticas"
        component={StatisticsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'stats-chart' : 'stats-chart-outline'} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const RootNavigator = () => {
  const [hasGroup, setHasGroup] = useState<boolean | null>(null);

  useEffect(() => {
    const checkGroup = async () => {
      const groupCode = await getSavedGroupCode();
      setHasGroup(!!groupCode);
    };
    checkGroup();
  }, []);

  if (hasGroup === null) return null;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.header.background },
        headerTintColor: colors.header.text,
        headerTitleStyle: { color: colors.header.text },
      }}
    >
      {!hasGroup ? (
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreenWrapper}
          options={{ headerShown: false }}
        />
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
        options={{ title: 'Detalle de Gasto' }}
      />
      <Stack.Screen
        name="FloorsConfig"
        component={FloorsConfigScreen}
        options={{ title: 'Configuración de Pisos' }}
      />
    </Stack.Navigator>
  );
};

const WelcomeScreenWrapper = () => {
  return <WelcomeScreen onGroupReady={() => {}} />;
};

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 60,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});