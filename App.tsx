import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/presentation/navigation/AppNavigator';
import { initDatabase } from './src/data/Database';
import { colors } from './src/presentation/theme/colors';

const LOG_PREFIX = '[App]';

export default function App() {
  const [isReady, setIsReady] = useState(false);

  console.log(`${LOG_PREFIX} App render - isReady: ${isReady}`);

  useEffect(() => {
    console.log(`${LOG_PREFIX} useEffect - ini`);
    const prepare = async () => {
      try {
        console.log(`${LOG_PREFIX} prepare - ini`);
        await initDatabase();
        console.log(`${LOG_PREFIX} prepare - initDatabase ok`);
      } catch (e) {
        console.error(`${LOG_PREFIX} prepare - error:`, e);
      } finally {
        console.log(`${LOG_PREFIX} prepare - setIsReady(true)`);
        setIsReady(true);
      }
    };
    prepare();
    console.log(`${LOG_PREFIX} useEffect - fin`);
  }, []);

  console.log(`${LOG_PREFIX} render - isReady: ${isReady}`);
  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  console.log(`${LOG_PREFIX} render - retornando AppNavigator`);
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    color: colors.primary.main,
    fontSize: 16,
  },
});
