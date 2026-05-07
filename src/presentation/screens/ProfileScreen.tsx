import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PaymentReminderSettings,
  getDefaultPaymentReminderSettings,
  getPaymentReminderSettings,
  savePaymentReminderSettings,
  schedulePaymentReminders,
  cancelPaymentReminders,
} from '../../services/NotificationService';
import {
  getPremiumStatus,
  purchasePremium,
  restorePurchases,
} from '../../services/MonetizationService';
import { MONETIZATION_CONFIG } from '../../services/MonetizationConfig';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';

type ProfileNavigationProp = StackNavigationProp<RootStackParamList>;

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const [paymentSettings, setPaymentSettings] = useState<PaymentReminderSettings>(
    getDefaultPaymentReminderSettings()
  );
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const payment = await getPaymentReminderSettings();
    const premium = await getPremiumStatus();
    setPaymentSettings(payment);
    setIsPremium(premium);
    setLoading(false);
};

  const handleBuyPremium = () => {
    Alert.alert(
      '🎉 ¡Únete a Premium!',
      `Versión premium por ${MONETIZATION_CONFIG.PRICES.MONTHLY}/mes\n\n✓ Sin publicidad\n✓ Gráficos avanzados\n✓ Exportar a Excel\n✓ Funciones exclusivas\n\n*Esta es una versión de prueba`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '¡Quiero Premium!',
          onPress: async () => {
            const success = await purchasePremium();
            if (success) {
              setIsPremium(true);
              Alert.alert('¡Felicidades!', 'Ahora eres usuario Premium');
            } else {
              Alert.alert('Error', 'No se pudo completar la compra');
            }
          },
        },
      ]
    );
  };

  const handleRestorePremium = () => {
    Alert.alert(
      'Restaurar compra',
      '¿Restaurar estado Premium de una compra anterior?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          onPress: async () => {
            const success = await restorePurchases();
            if (success) {
              setIsPremium(true);
              Alert.alert('¡Listo!', 'Compra restaurada exitosamente');
            } else {
              Alert.alert('No encontrado', 'No se encontró ninguna compra previa');
            }
          },
        },
      ]
    );
  };

  const toggleMealReminders = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Permisos necesarios',
          'Activa las notificaciones en configuración de tu teléfono.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    const newSettings = { ...mealSettings, enabled };
    setMealSettings(newSettings);
    await saveNotificationSettings(newSettings);
  };

  const updateMealSetting = async <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    const newSettings = { ...mealSettings, [key]: value };
    setMealSettings(newSettings);
    await saveNotificationSettings(newSettings);
  };

  const togglePaymentReminders = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Permisos necesarios',
          'Activa las notificaciones en configuración de tu teléfono.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    const newSettings = { ...paymentSettings, enabled };
    setPaymentSettings(newSettings);
    await savePaymentReminderSettings(newSettings);

    if (enabled) {
      await schedulePaymentReminders();
      Alert.alert(
        'Recordatorios activados',
        `Recibirás notificaciones los días ${newSettings.days.join(', ')} de cada mes a las ${newSettings.hour}:00`
      );
    } else {
      await cancelPaymentReminders();
    }
  };

  const toggleDay = async (day: number) => {
    const currentDays = paymentSettings.days;
    let newDays: number[];

    if (currentDays.includes(day)) {
      if (currentDays.length === 1) {
        Alert.alert('Error', 'Debes seleccionar al menos un día');
        return;
      }
      newDays = currentDays.filter(d => d !== day);
    } else {
      newDays = [...currentDays, day].sort((a, b) => a - b);
    }

    const newSettings = { ...paymentSettings, days: newDays };
    setPaymentSettings(newSettings);
    await savePaymentReminderSettings(newSettings);

    if (newSettings.enabled) {
      await schedulePaymentReminders();
    }
  };

  const updateHour = async (hour: number) => {
    const newSettings = { ...paymentSettings, hour };
    setPaymentSettings(newSettings);
    await savePaymentReminderSettings(newSettings);

    if (newSettings.enabled) {
      await schedulePaymentReminders();
    }
  };

  const getDaysText = () => {
    const { days } = paymentSettings;
    if (days.length === 1) return `día ${days[0]}`;
    if (days.length <= 5) return `días ${days.join(', ')}`;
    return `${days.length} días`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LinearGradient
        colors={['#1565C0', '#2196F3']}
        style={styles.header}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>U</Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <Text style={styles.headerSubtitle}>Configura tus preferencias</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Luz y Agua</Text>
          <Text style={styles.sectionDescription}>
            Gestiona los servicios de tu hogar
          </Text>
          
          <TouchableOpacity 
            style={styles.utilityButton}
            onPress={() => navigation.navigate('Expenses')}
          >
            <LinearGradient
              colors={['#FFC107', '#FF9800']}
              style={styles.utilityButtonGradient}
            >
              <Text style={styles.utilityButtonIcon}>⚡</Text>
              <View style={styles.utilityButtonContent}>
                <Text style={styles.utilityButtonTitle}>Ver Gastos</Text>
                <Text style={styles.utilityButtonSubtitle}>
                  Listado de meses
                </Text>
              </View>
              <Text style={styles.utilityButtonArrow}>›</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.utilityButton}
            onPress={() => navigation.navigate('FloorsConfig')}
          >
            <LinearGradient
              colors={['#2196F3', '#1976D2']}
              style={styles.utilityButtonGradient}
            >
              <Text style={styles.utilityButtonIcon}>🏠</Text>
              <View style={styles.utilityButtonContent}>
                <Text style={styles.utilityButtonTitle}>Configurar Pisos</Text>
                <Text style={styles.utilityButtonSubtitle}>
                  Número de pisos y medidores
                </Text>
              </View>
              <Text style={styles.utilityButtonArrow}>›</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Finanzas Personales</Text>
          <Text style={styles.sectionDescription}>
            Controla tus ingresos, gastos, deudas y ahorros
          </Text>
          
          <TouchableOpacity 
            style={styles.financeButton}
            onPress={() => navigation.navigate('Statistics')}
          >
            <LinearGradient
              colors={['#1A237E', '#303F9F']}
              style={styles.financeButtonGradient}
            >
              <Text style={styles.financeButtonIcon}>📊</Text>
              <View style={styles.financeButtonContent}>
                <Text style={styles.financeButtonTitle}>Estadísticas</Text>
                <Text style={styles.financeButtonSubtitle}>
                  Ver gráficos y análisis
                </Text>
              </View>
              <Text style={styles.financeButtonArrow}>›</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👑 Premium</Text>
          
          {isPremium ? (
            <View style={styles.premiumActiveCard}>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>✓ PREMIUM ACTIVO</Text>
              </View>
              <Text style={styles.premiumActiveText}>
                ¡Gracias por ser Premium! Disfrutas de todas las funciones sin publicidad.
              </Text>
              <TouchableOpacity style={styles.restoreButton} onPress={handleRestorePremium}>
                <Text style={styles.restoreButtonText}>Restaurar compra</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.premiumButton} onPress={handleBuyPremium}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.premiumButtonGradient}
                >
                  <Text style={styles.premiumButtonIcon}>⭐</Text>
                  <View style={styles.premiumButtonContent}>
                    <Text style={styles.premiumButtonTitle}>¡Desbloquea Premium!</Text>
                    <Text style={styles.premiumButtonSubtitle}>
                      Por solo S/9.90/mes
                    </Text>
                  </View>
                  <Text style={styles.premiumButtonArrow}>›</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.premiumFeatures}>
                <Text style={styles.premiumFeaturesTitle}>¿Qué incluye?</Text>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🚫</Text>
                  <Text style={styles.featureText}>Sin publicidad</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>📊</Text>
                  <Text style={styles.featureText}>Gráficos avanzados de gastos</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>📑</Text>
                  <Text style={styles.featureText}>Exportar a Excel/PDF</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🎯</Text>
                  <Text style={styles.featureText}>Funciones exclusivas</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>💡</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Recordatorios de Pago</Text>
              <Text style={styles.sectionDescription}>
                Notificaciones para pagar recibos
              </Text>
            </View>
            <Switch
              value={paymentSettings.enabled}
              onValueChange={togglePaymentReminders}
              trackColor={{ false: '#ccc', true: '#FF9800' }}
              thumbColor={paymentSettings.enabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {paymentSettings.enabled && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📅 Días de recordatorio</Text>
              <Text style={styles.cardDescription}>
                Selecciona los días del mes
              </Text>

              <View style={styles.daysGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      paymentSettings.days.includes(day) && styles.dayButtonActive,
                    ]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        paymentSettings.days.includes(day) && styles.dayButtonTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {[11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      paymentSettings.days.includes(day) && styles.dayButtonActive,
                    ]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        paymentSettings.days.includes(day) && styles.dayButtonTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {[21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      paymentSettings.days.includes(day) && styles.dayButtonActive,
                    ]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        paymentSettings.days.includes(day) && styles.dayButtonTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.selectedDaysInfo}>
                <Text style={styles.selectedDaysText}>
                  ✓ {getDaysText()} seleccionado{paymentSettings.days.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>⏰ Hora del recordatorio</Text>

              <View style={styles.hourSelector}>
                <TouchableOpacity
                  style={styles.hourButton}
                  onPress={() => updateHour(Math.max(6, paymentSettings.hour - 1))}
                >
                  <Text style={styles.hourButtonText}>−</Text>
                </TouchableOpacity>

                <View style={styles.hourDisplay}>
                  <Text style={styles.hourText}>
                    {paymentSettings.hour.toString().padStart(2, '0')}:00
                  </Text>
                  <Text style={styles.hourPeriod}>
                    {paymentSettings.hour < 12 ? 'AM' : 'PM'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.hourButton}
                  onPress={() => updateHour(Math.min(22, paymentSettings.hour + 1))}
                >
                  <Text style={styles.hourButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.quickHours}>
                {[8, 9, 10, 12, 18].map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.quickHourButton,
                      paymentSettings.hour === h && styles.quickHourButtonActive,
                    ]}
                    onPress={() => updateHour(h)}
                  >
                    <Text
                      style={[
                        styles.quickHourText,
                        paymentSettings.hour === h && styles.quickHourTextActive,
                      ]}
                    >
                      {h}:00
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>💡</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Resumen</Text>
                <Text style={styles.infoText}>
                  Recordatorios los {getDaysText()} de cada mes a las {paymentSettings.hour}:00 hrs.
                </Text>
              </View>
            </View>
          </>
        )}

        {!paymentSettings.enabled && (
          <View style={styles.disabledCard}>
            <Text style={styles.disabledIcon}>🔕</Text>
            <Text style={styles.disabledTitle}>Recordatorios de pago desactivados</Text>
            <Text style={styles.disabledText}>
              Activa para recibir notificaciones y no olvidar pagar tus recibos.
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: colors.header.background,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary.main,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary.main,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.header.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.header.text,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: colors.textMuted,
  },
  section: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: 12,
    color: colors.primary.main,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  rowCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    fontSize: 20,
    marginRight: 12,
    color: colors.primary.main,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 70,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  optionIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  optionLabelActive: {
    color: '#fff',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayButtonActive: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  dayButtonTextActive: {
    color: '#fff',
  },
  selectedDaysInfo: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
  },
  selectedDaysText: {
    fontSize: 13,
    color: '#e65100',
    fontWeight: '500',
    textAlign: 'center',
  },
  hourSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  hourButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourButtonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  hourDisplay: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  hourText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  hourPeriod: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  quickHours: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  quickHourButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  quickHourButtonActive: {
    backgroundColor: '#FF9800',
  },
  quickHourText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  quickHourTextActive: {
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
  disabledCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  disabledIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  disabledTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  disabledText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  divider: {
    height: 8,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  utilityButton: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  utilityButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  utilityButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  utilityButtonContent: {
    flex: 1,
  },
  utilityButtonTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  utilityButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  utilityButtonArrow: {
    fontSize: 24,
    color: '#fff',
  },
  financeButton: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  financeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  financeButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  financeButtonContent: {
    flex: 1,
  },
  financeButtonTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  financeButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  financeButtonArrow: {
    fontSize: 24,
    color: '#fff',
  },
  premiumButton: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
  },
  premiumButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  premiumButtonIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  premiumButtonContent: {
    flex: 1,
  },
  premiumButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  premiumButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  premiumButtonArrow: {
    fontSize: 24,
    color: '#fff',
  },
  premiumFeatures: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 14,
  },
  premiumFeaturesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e65100',
    marginBottom: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  featureText: {
    fontSize: 13,
    color: '#333',
  },
  premiumActiveCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  premiumBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 10,
  },
  premiumBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  premiumActiveText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  restoreButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  restoreButtonText: {
    color: '#666',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  bottomSpacer: {
    height: 20,
  },
});

export default ProfileScreen;
