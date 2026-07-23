import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ClipboardAPI from 'expo-clipboard';
import {
  House,
  HouseLine,
  Link,
  CheckCircle,
  ArrowLeft,
  Share as ShareIcon,
  Lightning,
  ChartBar,
  Users,
  ArrowRight,
} from 'phosphor-react-native';
import {
  getSavedGroupCode,
  getSavedGroupName,
  createGroup,
  joinGroup,
  migrateLocalDataToCloud,
} from '../../services/SyncService';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { getDatabase } from '../../data/Database';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { typography } from '../theme/typography';

interface WelcomeScreenProps {
  onGroupReady: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGroupReady }) => {
  const [mode, setMode] = useState<'initial' | 'create' | 'join'>('initial');
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    checkExistingGroup();
  }, []);

  const checkExistingGroup = async () => {
    const code = await getSavedGroupCode();
    if (code) {
      onGroupReady();
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
    if (!joinCode.trim()) {
      Alert.alert('Error', 'Ingresa el código del grupo');
      return;
    }

    setLoading(true);
    try {
      const result = await joinGroup(joinCode.trim());
      if (result.success) {
        setCreatedCode(joinCode.trim().toUpperCase());
        setShowSuccess(true);
      } else {
        Alert.alert('Error', result.error || 'Código inválido');
      }
    } catch (error) {
      console.error('Error joining group:', error);
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
    onGroupReady();
  };

  if (showSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.success} />
        <LinearGradient
          colors={[colors.success, '#059669']}
          style={styles.successContainer}
        >
          <View style={styles.successIconContainer}>
            <CheckCircle size={64} color={colors.common.white} weight="fill" />
          </View>
          <Text style={styles.successTitle}>¡Listo!</Text>
          <Text style={styles.successSubtitle}>Tu grupo está configurado</Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Código del grupo</Text>
            <Text style={styles.codeValue} numberOfLines={1} adjustsFontSizeToFit>{createdCode || '----'}</Text>
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleShareCode}>
            <ShareIcon size={20} color={colors.common.white} weight="bold" />
            <Text style={styles.shareButtonText}>Compartir código</Text>
          </TouchableOpacity>

          <Text style={styles.shareHint}>
            Comparte este código con tu familia para que puedan ver los gastos
          </Text>

          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Continuar</Text>
            <ArrowRight size={20} color={colors.common.white} weight="bold" />
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (mode === 'create') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary.dark} />
        <LinearGradient
          colors={[colors.primary.main, colors.primary.dark]}
          style={styles.formContainer}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setMode('initial')}>
              <ArrowLeft size={24} color={colors.common.white} weight="bold" />
              <Text style={styles.backButtonText}>Volver</Text>
            </TouchableOpacity>

            <View style={styles.formIconContainer}>
              <House size={40} color={colors.common.white} weight="fill" />
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
                placeholderTextColor={colors.input.placeholder}
              />
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleCreateGroup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.common.white} />
              ) : (
                <>
                  <CheckCircle size={20} color={colors.common.white} weight="bold" />
                  <Text style={styles.submitButtonText}>Crear grupo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (mode === 'join') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary.dark} />
        <LinearGradient
          colors={[colors.primary.dark, colors.primary.main]}
          style={styles.formContainer}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setMode('initial')}>
              <ArrowLeft size={24} color={colors.common.white} weight="bold" />
              <Text style={styles.backButtonText}>Volver</Text>
            </TouchableOpacity>

            <View style={styles.formIconContainer}>
              <Link size={40} color={colors.common.white} weight="bold" />
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
                style={[styles.input, styles.codeInput]}
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="Ej: ABCD1234"
                placeholderTextColor={colors.input.placeholder}
                autoCapitalize="characters"
                maxLength={8}
              />
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleJoinGroup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.common.white} />
              ) : (
                <>
                  <Link size={20} color={colors.common.white} weight="bold" />
                  <Text style={styles.submitButtonText}>Unirse al grupo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary.main} />
      <LinearGradient
        colors={[colors.primary.main, colors.primary.dark]}
        style={styles.initialContainer}
      >
        <View style={styles.logoContainer}>
          <House size={48} color={colors.common.white} weight="fill" />
        </View>
        <Text style={styles.appName} numberOfLines={1}>CasaBalance</Text>
        <Text style={styles.tagline}>Gastos del Hogar</Text>

        <View style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <View style={styles.featureIconContainer}>
              <Lightning size={20} color={colors.primary.main} weight="fill" />
            </View>
            <Text style={styles.featureItem}>Pago de recibos</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIconContainer}>
              <ChartBar size={20} color={colors.primary.main} weight="fill" />
            </View>
            <Text style={styles.featureItem}>Estadísticas</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIconContainer}>
              <Users size={20} color={colors.primary.main} weight="fill" />
            </View>
            <Text style={styles.featureItem}>Comparte con tu familia</Text>
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setMode('create')}
          >
            <HouseLine size={20} color={colors.common.white} weight="bold" />
            <Text style={styles.primaryButtonText}>Crear grupo nuevo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setMode('join')}
          >
            <Link size={20} color={colors.primary.main} weight="bold" />
            <Text style={styles.secondaryButtonText}>Unirse con código</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.main,
  },
  initialContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  appName: {
    ...typography.h1,
    color: colors.common.white,
    marginBottom: spacing[1],
  },
  tagline: {
    ...typography.bodyMedium,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing[12],
  },
  featuresContainer: {
    width: '100%',
    marginBottom: spacing[12],
    gap: spacing[3],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[3],
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.common.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureItem: {
    ...typography.bodyMedium,
    color: colors.common.white,
  },
  buttonsContainer: {
    width: '100%',
    gap: spacing[3],
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.common.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[4],
    gap: spacing[2],
    ...shadows.md,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.primary.dark,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[4],
    gap: spacing[2],
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.common.white,
  },
  formContainer: {
    flex: 1,
    padding: spacing[8],
    paddingTop: spacing[4],
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  formBody: {
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[2],
    marginBottom: spacing[8],
  },
  backButtonText: {
    ...typography.bodyMedium,
    color: colors.common.white,
  },
  formIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  formTitle: {
    ...typography.h2,
    color: colors.common.white,
    marginBottom: spacing[2],
  },
  formSubtitle: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing[6],
  },
  inputLabel: {
    ...typography.label,
    color: colors.common.white,
    marginBottom: spacing[2],
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    padding: spacing[4],
    ...typography.body,
    color: colors.common.white,
  },
  codeInput: {
    ...typography.h3,
    letterSpacing: 2,
    textAlign: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.common.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  submitButtonText: {
    ...typography.button,
    color: colors.primary.dark,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
  successIconContainer: {
    marginBottom: spacing[5],
  },
  successTitle: {
    ...typography.h1,
    color: colors.common.white,
    marginBottom: spacing[2],
  },
  successSubtitle: {
    ...typography.bodyMedium,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: spacing[8],
  },
  codeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    alignItems: 'center',
    marginBottom: spacing[6],
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  codeLabel: {
    ...typography.captionMedium,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: spacing[2],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.common.white,
    letterSpacing: 3,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    marginBottom: spacing[3],
    gap: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  shareButtonText: {
    ...typography.buttonSmall,
    color: colors.common.white,
  },
  shareHint: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: spacing[8],
    paddingHorizontal: spacing[4],
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  continueButtonText: {
    ...typography.button,
    color: colors.common.white,
  },
});

export default WelcomeScreen;
