import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ClipboardAPI from 'expo-clipboard';
import { 
  getSavedGroupCode, 
  getSavedGroupName, 
  createGroup, 
  joinGroup,
  migrateLocalDataToCloud 
} from '../../services/SyncService';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { getDatabase } from '../../data/Database';
import { colors } from '../theme/colors';

interface WelcomeScreenProps {
  onGroupReady: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGroupReady }) => {
  const LOG_PREFIX = '[WelcomeScreen]';
  const [mode, setMode] = useState<'initial' | 'create' | 'join'>('initial');
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    console.log(`${LOG_PREFIX} useEffect - ini`);
    checkExistingGroup();
    console.log(`${LOG_PREFIX} useEffect - fin`);
  }, []);

  const checkExistingGroup = async () => {
    console.log(`${LOG_PREFIX} checkExistingGroup - ini`);
    const code = await getSavedGroupCode();
    console.log(`${LOG_PREFIX} checkExistingGroup - code: ${code}`);
    if (code) {
      console.log(`${LOG_PREFIX} checkExistingGroup - hay código, llamando onGroupReady`);
      onGroupReady();
    } else {
      console.log(`${LOG_PREFIX} checkExistingGroup - no hay código, mostrando pantalla de inicio`);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para tu grupo');
      return;
    }

    setLoading(true);
    try {
      const repo = new SQLiteExpenseRepository(getDatabase());
      const [localPeriods, localSettings] = await Promise.all([
        repo.getAllPeriods(),
        repo.getSettings(),
      ]);
      
      const code = await createGroup(groupName.trim(), localSettings);
      
      if (localPeriods.length > 0) {
        await migrateLocalDataToCloud(code, localPeriods, localSettings);
      }
      
      setCreatedCode(code);
      setShowSuccess(true);
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'No se pudo crear el grupo');
    }
    setLoading(false);
  };

  const handleJoinGroup = async () => {
    console.log('[WelcomeScreen] handleJoinGroup - joinCode:', joinCode);
    if (!joinCode.trim()) {
      Alert.alert('Error', 'Ingresa el código del grupo');
      console.log('[WelcomeScreen] handleJoinGroup - Código vacío');
      return;
    }

    setLoading(true);
    console.log('[WelcomeScreen] handleJoinGroup - Llamando joinGroup con:', joinCode.trim());
    try {
      const result = await joinGroup(joinCode.trim());
      console.log('[WelcomeScreen] handleJoinGroup - Resultado:', result);
      if (result.success) {
        setCreatedCode(joinCode.trim().toUpperCase());
        setShowSuccess(true);
        console.log('[WelcomeScreen] handleJoinGroup - Éxito, showSuccess:', true);
      } else {
        Alert.alert('Error', result.error || 'Código inválido');
        console.log('[WelcomeScreen] handleJoinGroup - Error:', result.error);
      }
    } catch (error) {
      console.error('[WelcomeScreen] Error joining group:', error);
      Alert.alert('Error', 'No se pudo unir al grupo');
    }
    setLoading(false);
  };

  const handleShareCode = async () => {
    try {
      await ClipboardAPI.setStringAsync(createdCode);
      await Share.share({
        message: `Únete a mi grupo en CasaBalance!\n\nCódigo: ${createdCode}\n\nDescarga la app e ingresa este código para ver y editar los gastos de la casa.`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleContinue = () => {
    console.log('[WelcomeScreen] handleContinue - Llamando onGroupReady');
    onGroupReady();
  };

  if (showSuccess) {
    console.log('[WelcomeScreen] Render - showSuccess:', showSuccess, 'createdCode:', createdCode);
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <LinearGradient
          colors={['#4CAF50', '#388E3C']}
          style={styles.successContainer}
        >
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>¡Listo!</Text>
          <Text style={styles.successSubtitle}>Tu grupo está configurado</Text>
          
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Código del grupo: {createdCode || 'SIN CÓDIGO'}</Text>
            <Text style={styles.codeValue}>{createdCode || '----'}</Text>
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleShareCode}>
            <Text style={styles.shareButtonText}>📤 Compartir código</Text>
          </TouchableOpacity>

          <Text style={styles.shareHint}>
            Comparte este código con tu familia para que puedan ver los gastos
          </Text>

          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Continuar →</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  if (mode === 'create') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
        <LinearGradient
          colors={['#4CAF50', '#388E3C']}
          style={styles.formContainer}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setMode('initial')}>
              <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>
            
            <View style={styles.formIconContainer}>
              <Text style={styles.formIcon}>🏠</Text>
            </View>
            <Text style={styles.formTitle}>Crear grupo familiar</Text>
            <Text style={styles.formSubtitle}>
              Crea un grupo para gestionar los gastos de tu hogar
            </Text>
          </View>

          <View style={styles.formBody}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nombre de tu familia</Text>
              <TextInput
                style={styles.input}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Ej: Familia López"
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleCreateGroup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>✅ Crear grupo</Text>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (mode === 'join') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#9C27B0" />
        <LinearGradient
          colors={['#9C27B0', '#7B1FA2']}
          style={styles.formContainer}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setMode('initial')}>
              <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>
            
            <View style={styles.formIconContainer}>
              <Text style={styles.formIcon}>🔗</Text>
            </View>
            <Text style={styles.formTitle}>Unirse a un grupo</Text>
            <Text style={styles.formSubtitle}>
              Ingresa el código que te compartió tu familia
            </Text>
          </View>

          <View style={styles.formBody}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Código del grupo</Text>
              <TextInput
                style={styles.input}
                value={joinCode}
                onChangeText={(text) => {
                  console.log('[WelcomeScreen] Input código - texto:', text);
                  setJoinCode(text);
                }}
                placeholder="Ej: ABCD1234"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                maxLength={8}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, styles.submitButtonPurple]} 
              onPress={handleJoinGroup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>✅ Unirse al grupo</Text>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />
      <LinearGradient
        colors={['#1565C0', '#2196F3']}
        style={styles.initialContainer}
      >
        <Text style={styles.logo}>🏠</Text>
        <Text style={styles.appName}>CasaBalance</Text>
        <Text style={styles.tagline}>Gastos del Hogar</Text>

        <View style={styles.featuresContainer}>
          <Text style={styles.featureItem}>💡 Pago de recibos</Text>
          <Text style={styles.featureItem}>📊 Estadísticas</Text>
          <Text style={styles.featureItem}>👨‍👩‍👧‍👦 Comparte con tu familia</Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={() => setMode('create')}
          >
            <Text style={styles.primaryButtonText}>🏠 Crear grupo nuevo</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => setMode('join')}
          >
            <Text style={styles.secondaryButtonText}>🔗 Unirse con código</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  initialContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  logo: {
    fontSize: 80,
    marginBottom: 10,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary.main,
    marginBottom: 5,
  },
  tagline: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 40,
  },
  featuresContainer: {
    marginBottom: 50,
  },
  featureItem: {
    fontSize: 16,
    color: colors.text,
    marginVertical: 8,
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    gap: 15,
  },
  primaryButton: {
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.common.white,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary.main,
  },
  formContainer: {
    flex: 1,
    padding: 30,
    paddingTop: 50,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  formBody: {
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  formIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  formIcon: {
    fontSize: 50,
    textAlign: 'center',
  },
  formTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    fontSize: 18,
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonPurple: {
    backgroundColor: colors.primary.dark,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.common.white,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  successIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary.main,
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 30,
  },
  codeContainer: {
    backgroundColor: colors.header.background,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  codeLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary.main,
    letterSpacing: 4,
  },
  shareButton: {
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 30,
    marginBottom: 15,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  shareHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  continueButton: {
    paddingVertical: 12,
  },
  continueButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
});

export default WelcomeScreen;
