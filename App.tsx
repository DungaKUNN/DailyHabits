import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/presentation/navigation/AppNavigator';
import { initDatabase, resetDatabase } from './src/data/Database';
import { resetRepos } from './src/data/repos';
import { colors } from './src/presentation/theme/colors';

const LOG_PREFIX = '[App]';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`${LOG_PREFIX} App crashed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Ha ocurrido un error</Text>
          <Text style={errorStyles.message}>{this.state.error?.message}</Text>
          <TouchableOpacity
            style={errorStyles.button}
            onPress={() => {
              resetDatabase();
              resetRepos();
              this.setState({ hasError: false, error: null });
              this.props.onReset();
            }}
          >
            <Text style={errorStyles.buttonText}>Reiniciar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#1B2D4F' },
  message: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#1B2D4F', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const prepare = async () => {
      try {
        await initDatabase();
      } catch (e) {
        console.error(`${LOG_PREFIX} prepare - error:`, e);
      } finally {
        setIsReady(true);
      }
    };
    prepare();
  }, [resetKey]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary key={resetKey} onReset={() => setResetKey(k => k + 1)}>
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
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
