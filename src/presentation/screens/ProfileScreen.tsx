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
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Gear,
  Bell,
  Crown,
  Star,
  House,
  ChartBar,
  SignOut,
  Check,
  X,
  Plus,
  Minus,
  Clock,
  Calendar,
  ArrowRight,
  Shield,
  Trash,
} from 'phosphor-react-native';
import {
  PaymentReminderSettings,
  getDefaultPaymentReminderSettings,
  getPaymentReminderSettings,
  savePaymentReminderSettings,
  schedulePaymentReminders,
  cancelPaymentReminders,
  requestNotificationPermissions,
} from '../../services/NotificationService';
import {
  getPremiumStatus,
  purchasePremium,
  restorePurchases,
} from '../../services/MonetizationService';
import { MONETIZATION_CONFIG } from '../../services/MonetizationConfig';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { SQLiteFinanceRepository } from '../../data/repositories/SQLiteFinanceRepository';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { getDatabase } from '../../data/Database';
import { FinancePeriod } from '../../domain/entities/Finance';
import { getSavedGroupCode, getSavedGroupName, clearGroupCode } from '../../services/SyncService';
import { ConfirmDialog } from '../components/ConfirmDialog';

type ProfileNavigationProp = StackNavigationProp<RootStackParamList>;

const LOG_PREFIX = '[ProfileScreen]';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const [paymentSettings, setPaymentSettings] = useState<PaymentReminderSettings>(
    getDefaultPaymentReminderSettings()
  );
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [financeData, setFinanceData] = useState<{
    averageIncome: number;
    averageExpenses: number;
    totalDebts: number;
    totalDebtRemaining: number;
    totalDebtOriginal: number;
    monthlyPayment: number;
    debts?: { totalAmount: number; remainingAmount: number; monthlyPayment: number; periodIndex: number }[];
  } | null>(null);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [detailedData, setDetailedData] = useState<any[]>([]);
  const [manualIncome, setManualIncome] = useState('');
  const [manualExpenses, setManualExpenses] = useState('');
  const [additionalPayment, setAdditionalPayment] = useState('');
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [leaveGroupDialogVisible, setLeaveGroupDialogVisible] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (showSimulatorModal && financeData) {
      setManualIncome('');
      setManualExpenses('');
      setAdditionalPayment('');
    }
  }, [showSimulatorModal, financeData]);

  useEffect(() => {
    if (showSimulatorModal) {
      console.log('======= SIMULADOR - Abriendo modal, recargando datos =======');
      const reloadData = async () => {
        try {
          const financeRepo = new SQLiteFinanceRepository(getDatabase());
          const expenseRepo = new SQLiteExpenseRepository(getDatabase());
          const financePeriods = await financeRepo.getAllPeriods();
          const expensePeriods = await expenseRepo.getAllPeriods();
          
          console.log('SIMULADOR - Períodos obtenidos:', financePeriods.length);
          if (financePeriods.length > 0) {
            const lastPeriod = financePeriods[financePeriods.length - 1];
            console.log('SIMULADOR - Período más reciente:', lastPeriod.monthName, lastPeriod.year);
            console.log('SIMULADOR - Deudas en último período:', JSON.stringify(lastPeriod.debts));
          }
          
          let totalIncome = 0;
          let totalFinanceExpenses = 0;
          let totalDebtRemaining = 0;
          let totalMonthlyPayment = 0;

          const uniqueDebts = new Map<string, { totalAmount: number; remainingAmount: number; monthlyPayment: number; periodIndex: number }>();
          let totalDebtOriginal = 0;

          financePeriods.forEach((p, periodIndex) => {
            totalIncome += p.income.reduce((sum, i) => sum + i.amount, 0);
            totalFinanceExpenses += p.expenses.reduce((sum, e) => sum + e.amount, 0);
            
            p.debts.forEach(d => {
              const key = `${d.name}_${d.totalAmount}`;
              const existing = uniqueDebts.get(key);
              if (!existing || periodIndex > existing.periodIndex) {
                uniqueDebts.set(key, {
                  totalAmount: d.totalAmount,
                  remainingAmount: d.remainingAmount,
                  monthlyPayment: d.monthlyPayment,
                  periodIndex: periodIndex
                });
              }
            });
          });

          uniqueDebts.forEach((d) => {
            totalDebtOriginal += d.totalAmount;
            if (d.remainingAmount > 0) {
              totalDebtRemaining += d.remainingAmount;
              totalMonthlyPayment += d.monthlyPayment;
            }
          });

          console.log('SIMULADOR - totalDebtOriginal:', totalDebtOriginal);

          let totalLuz = 0;
          let totalAgua = 0;
          expensePeriods.forEach(p => {
            totalLuz += p.electricity?.totalReceipt || 0;
            totalAgua += p.water?.totalReceipt || 0;
          });

          const totalExpenses = totalFinanceExpenses + totalLuz + totalAgua;
          const averageIncome = financePeriods.length > 0 ? totalIncome / financePeriods.length : 0;
          const averageExpenses = financePeriods.length > 0 ? totalExpenses / financePeriods.length : 0;

          console.log('SIMULADOR - totalDebtRemaining:', totalDebtRemaining);
          console.log('SIMULADOR - uniqueDebts:', Array.from(uniqueDebts.entries()).map(([k, v]) => `${k}: ${v.remainingAmount}`));

          setFinanceData({
            averageIncome,
            averageExpenses,
            totalDebts: totalDebtRemaining,
            totalDebtRemaining,
            totalDebtOriginal,
            monthlyPayment: totalMonthlyPayment,
            debts: Array.from(uniqueDebts.values())
          });

          const detailed: any[] = [];
          const maxMonths = Math.max(financePeriods.length, expensePeriods.length);
          for (let i = 0; i < maxMonths; i++) {
            const financeP = financePeriods[i];
            const expenseP = expensePeriods[i];
            const income = financeP ? financeP.income.reduce((sum, inc) => sum + inc.amount, 0) : 0;
            const financeExpenses = financeP ? financeP.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0;
            const luz = expenseP ? (expenseP.floorsElectricity?.reduce((sum, f) => sum + (f.consumptionPrice || 0) + (f.igv || 0), 0) || 0) : 0;
            const agua = expenseP ? (expenseP.water?.totalReceipt || 0) : 0;
            const totalGastos = financeExpenses + luz + agua;
            const disponible = income - totalGastos;
            let debts = 0;
            let debtDetails: any[] = [];
            if (financeP) {
              financeP.debts.forEach((d: any) => {
                if (!d.isPaid && d.remainingAmount > 0) {
                  debts += d.remainingAmount;
                  debtDetails.push({ name: d.name, remaining: d.remainingAmount, paidThisMonth: d.paidThisMonth || false });
                }
              });
            }
            detailed.push({
              month: financeP?.monthName || expenseP?.monthName || `Mes ${i+1}`,
              year: financeP?.year || expenseP?.year || 2026,
              income,
              financeExpenses,
              luz,
              agua,
              totalGastos,
              disponible,
              debts,
              debtDetails
            });
          }
          console.log('SIMULADOR - detailedData:', detailed);
          setDetailedData(detailed);
        } catch (error) {
          console.error('Error reloadData:', error);
        }
      };
      reloadData();
    }
  }, [showSimulatorModal]);

  const loadSettings = async () => {
    console.log(`${LOG_PREFIX} loadSettings - ini`);
    const payment = await getPaymentReminderSettings();
    console.log(`${LOG_PREFIX} loadSettings - payment loaded`);
    const premium = await getPremiumStatus();
    console.log(`${LOG_PREFIX} loadSettings - premium: ${premium}`);
    const code = await getSavedGroupCode();
    console.log(`${LOG_PREFIX} loadSettings - code: ${code}`);
    const name = await getSavedGroupName();
    console.log(`${LOG_PREFIX} loadSettings - name: ${name}`);
    setPaymentSettings(payment);
    setIsPremium(premium);
    setGroupCode(code);
    setGroupName(name);
    await loadFinanceData();
    console.log(`${LOG_PREFIX} loadSettings - fin`);
    setLoading(false);
  };

  const loadFinanceData = async () => {
    try {
      console.log(`${LOG_PREFIX} loadFinanceData - ini`);
      const financeRepo = new SQLiteFinanceRepository(getDatabase());
      const expenseRepo = new SQLiteExpenseRepository(getDatabase());
      
      const financePeriods = await financeRepo.getAllPeriods();
      const expensePeriods = await expenseRepo.getAllPeriods();
      
      console.log('======= SIMULADOR DE DEUDAS - loadFinanceData =======');
      console.log('Períodos de Finanzas:', financePeriods.length);
      console.log('Períodos de Gastos (Luz/Agua):', expensePeriods.length);
      
      if (financePeriods.length === 0 && expensePeriods.length === 0) {
        console.log('No hay períodos registrados');
        setFinanceData(null);
        return;
      }

      let totalIncome = 0;
      let totalFinanceExpenses = 0;
      let totalDebtRemaining = 0;
      let totalDebtOriginal = 0;
      let totalMonthlyPayment = 0;

      const uniqueDebts = new Map<string, { totalAmount: number; remainingAmount: number; monthlyPayment: number; periodIndex: number }>();

      financePeriods.forEach((p, periodIndex) => {
        totalIncome += p.income.reduce((sum, i) => sum + i.amount, 0);
        totalFinanceExpenses += p.expenses.reduce((sum, e) => sum + e.amount, 0);
        
        p.debts.forEach(d => {
          const key = `${d.name}_${d.totalAmount}`;
          const existing = uniqueDebts.get(key);
          if (!existing || periodIndex > existing.periodIndex) {
            uniqueDebts.set(key, {
              totalAmount: d.totalAmount,
              remainingAmount: d.remainingAmount,
              monthlyPayment: d.monthlyPayment,
              periodIndex: periodIndex
            });
          }
        });
      });

      console.log('Deudas únicas (período más reciente):');
      uniqueDebts.forEach((d, key) => {
        console.log(`  ${key}: remainingAmount=${d.remainingAmount}, isPaid=${d.remainingAmount <= 0}`);
        totalDebtOriginal += d.totalAmount;
        if (d.remainingAmount > 0) {
          totalDebtRemaining += d.remainingAmount;
          totalMonthlyPayment += d.monthlyPayment;
        }
      });

      let totalLuz = 0;
      let totalAgua = 0;
      
      expensePeriods.forEach(p => {
        p.floorsElectricity.forEach(floor => {
          totalLuz += floor.consumptionPrice + floor.igv;
        });
        totalAgua += p.water.totalReceipt || 0;
      });

      console.log('Gastos de Luz y Agua:');
      console.log('  Total Luz:', totalLuz);
      console.log('  Total Agua:', totalAgua);

      const totalMonths = Math.max(financePeriods.length, expensePeriods.length, 1);
      const averageIncome = totalIncome / totalMonths;
      const averageFinanceExpenses = totalFinanceExpenses / totalMonths;
      const averageLuz = totalLuz / totalMonths;
      const averageAgua = totalAgua / totalMonths;
      
      const totalExpenses = totalFinanceExpenses + totalLuz + totalAgua;
      const averageTotalExpenses = averageFinanceExpenses + averageLuz + averageAgua;

      console.log('RESULTADOS PROMEDIO MENSUAL:');
      console.log('  Ingresos promedio:', averageIncome);
      console.log('  Gastos Finanzas promedio:', averageFinanceExpenses);
      console.log('  Luz promedio:', averageLuz);
      console.log('  Agua promedio:', averageAgua);
      console.log('  Total gastos promedio:', averageTotalExpenses);
      console.log('  Disponible (para pagar deudas):', averageIncome - averageTotalExpenses);
      console.log('  Total deuda pendiente:', totalDebtRemaining);
      console.log('======= FIN SIMULADOR =======');

      setFinanceData({
        averageIncome,
        averageExpenses: averageTotalExpenses,
        totalDebts: totalDebtRemaining,
        totalDebtRemaining,
        totalDebtOriginal,
        monthlyPayment: totalMonthlyPayment
      });
      
      const detailedData: any[] = [];
      const maxMonths = Math.max(financePeriods.length, expensePeriods.length);
      
      for (let i = 0; i < maxMonths; i++) {
        const financeP = financePeriods[i];
        const expenseP = expensePeriods[i];
        
        const income = financeP ? financeP.income.reduce((sum, inc) => sum + inc.amount, 0) : 0;
        const financeExpenses = financeP ? financeP.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0;
        const luz = expenseP ? expenseP.floorsElectricity.reduce((sum, f) => sum + f.consumptionPrice + f.igv, 0) : 0;
        const agua = expenseP ? expenseP.water.totalReceipt : 0;
        const totalGastos = financeExpenses + luz + agua;
        const disponible = income - totalGastos;
        
        let debts = 0;
        let debtDetails: any[] = [];
        if (financeP) {
          financeP.debts.forEach(d => {
            if (!d.isPaid && d.remainingAmount > 0) {
              debts += d.remainingAmount;
              debtDetails.push({ name: d.name, remaining: d.remainingAmount, paidThisMonth: d.paidThisMonth || false });
            }
          });
        }
        
        detailedData.push({
          month: financeP?.monthName || expenseP?.monthName || `Mes ${i+1}`,
          year: financeP?.year || expenseP?.year || 2026,
          income,
          financeExpenses,
          luz,
          agua,
          totalGastos,
          disponible,
          debts,
          debtDetails
        });
      }
      
      console.log('Datos detallados por mes:', detailedData);
      setDetailedData(detailedData);
    } catch (error) {
      console.error('Error loading finance data:', error);
      setFinanceData(null);
    }
  };

  const handleBuyPremium = () => {
    console.log(`${LOG_PREFIX} handleBuyPremium - ini`);
    Alert.alert(
      'Únete a Premium!',
      `Versión premium por ${MONETIZATION_CONFIG.PRICES.MONTHLY}/mes\n\nSin publicidad\nGráficos avanzados\nExportar a Excel\nFunciones exclusivas\n\n*Esta es una versión de prueba`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '¡Quiero Premium!',
          onPress: async () => {
            console.log(`${LOG_PREFIX} handleBuyPremium - comprando`);
            const success = await purchasePremium();
            console.log(`${LOG_PREFIX} handleBuyPremium - success: ${success}`);
            if (success) {
              setIsPremium(true);
              Alert.alert('¡Felicidades!', 'Ahora eres usuario Premium');
              console.log(`${LOG_PREFIX} handleBuyPremium - premium activado`);
            } else {
              Alert.alert('Error', 'No se pudo completar la compra');
            }
          },
        },
      ]
    );
  };

  const handleRestorePremium = () => {
    console.log(`${LOG_PREFIX} handleRestorePremium - ini`);
    Alert.alert(
      'Restaurar compra',
      '¿Restaurar estado Premium de una compra anterior?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          onPress: async () => {
            console.log(`${LOG_PREFIX} handleRestorePremium - restaurando`);
            const success = await restorePurchases();
            console.log(`${LOG_PREFIX} handleRestorePremium - success: ${success}`);
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

  const handleLeaveGroup = () => {
    console.log(`${LOG_PREFIX} handleLeaveGroup - ini - group: ${groupName || groupCode}`);
    setLeaveGroupDialogVisible(true);
  };

  const confirmLeaveGroup = async () => {
    console.log(`${LOG_PREFIX} handleLeaveGroup - confirmando`);
    await clearGroupCode();
    console.log(`${LOG_PREFIX} handleLeaveGroup - código limpiado`);
    setGroupCode(null);
    setGroupName(null);
    setLeaveGroupDialogVisible(false);
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const togglePaymentReminders = async (enabled: boolean) => {
    console.log(`${LOG_PREFIX} togglePaymentReminders - ini - enabled: ${enabled}`);
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

  const updateMinute = async (minute: number) => {
    const newSettings = { ...paymentSettings, minute };
    setPaymentSettings(newSettings);
    await savePaymentReminderSettings(newSettings);

    if (newSettings.enabled) {
      await schedulePaymentReminders();
    }
  };

  const formatTime = (hour: number, minute: number) => {
    const period = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
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
      <StatusBar barStyle="light-content" backgroundColor={colors.primary.main} />
      <View style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <User size={28} color={colors.primary.main} weight="bold" />
              </View>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Mi Perfil</Text>
              <Text style={styles.headerSubtitle}>Configura tus preferencias</Text>
            </View>
            <Gear size={22} color={colors.textInverse} />
          </View>
        </SafeAreaView>
      </View>

      <SafeAreaView style={styles.contentContainer} edges={['bottom']}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: colors.primary.light }]}>
                <House size={18} color={colors.primary.main} weight="fill" />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Luz y Agua</Text>
                <Text style={styles.sectionDescription}>
                  Gestiona los servicios de tu hogar
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('FloorsConfig')}
            >
              <View style={styles.actionCardContent}>
                <View style={[styles.actionIconWrap, { backgroundColor: colors.accent.blueLight }]}>
                  <House size={20} color={colors.accent.blue} weight="fill" />
                </View>
                <View style={styles.actionTextContent}>
                  <Text style={styles.actionTitle}>Configurar Pisos</Text>
                  <Text style={styles.actionSubtitle}>
                    Número de pisos y medidores
                  </Text>
                </View>
                <ArrowRight size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={styles.hintContainer}>
              <Bell size={14} color={colors.textMuted} />
              <Text style={styles.hintText}>
                Para ver Gastos, usa la pestaña inferior
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: colors.accent.greenLight }]}>
                <ChartBar size={18} color={colors.accent.green} weight="fill" />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Simulador de Deudas</Text>
                <Text style={styles.sectionDescription}>
                  Calcula cuánto tiempo teará pagar tus deudas
                </Text>
              </View>
            </View>

            {!financeData ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <ChartBar size={32} color={colors.textMuted} weight="light" />
                </View>
                <Text style={styles.emptyText}>
                  No hay datos de finanzas registrados.{'\n'}
                  Agrega ingresos y gastos en la sección Finanzas.
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.actionCard}
                activeOpacity={0.7}
                onPress={() => setShowSimulatorModal(true)}
              >
                <View style={styles.actionCardContent}>
                  <View style={[styles.actionIconWrap, { backgroundColor: colors.accent.greenLight }]}>
                    <ChartBar size={20} color={colors.accent.green} weight="fill" />
                  </View>
                  <View style={styles.actionTextContent}>
                    <Text style={styles.actionTitle}>Abrir Simulador</Text>
                    <Text style={styles.actionSubtitle}>
                      Ver análisis detallado por mes
                    </Text>
                  </View>
                  <ArrowRight size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: colors.warningLight }]}>
                <Crown size={18} color={colors.warning} weight="fill" />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Premium</Text>
              </View>
            </View>

            {isPremium ? (
              <View style={styles.premiumActiveCard}>
                <View style={styles.premiumBadge}>
                  <Check size={14} color={colors.common.white} weight="bold" />
                  <Text style={styles.premiumBadgeText}>PREMIUM ACTIVO</Text>
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
                <TouchableOpacity
                  style={styles.premiumButton}
                  activeOpacity={0.8}
                  onPress={handleBuyPremium}
                >
                  <View style={styles.premiumButtonInner}>
                    <View style={styles.premiumButtonIconWrap}>
                      <Star size={22} color={colors.common.white} weight="fill" />
                    </View>
                    <View style={styles.premiumButtonTextContent}>
                      <Text style={styles.premiumButtonTitle}>¡Desbloquea Premium!</Text>
                      <Text style={styles.premiumButtonSubtitle}>
                        Por solo S/9.90/mes
                      </Text>
                    </View>
                    <ArrowRight size={20} color={colors.common.white} />
                  </View>
                </TouchableOpacity>

                <View style={styles.premiumFeatures}>
                  <Text style={styles.premiumFeaturesTitle}>¿Qué incluye?</Text>
                  <View style={styles.featureItem}>
                    <View style={[styles.featureDot, { backgroundColor: colors.accent.green }]}>
                      <Check size={12} color={colors.common.white} weight="bold" />
                    </View>
                    <Text style={styles.featureText}>Sin publicidad</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <View style={[styles.featureDot, { backgroundColor: colors.accent.green }]}>
                      <Check size={12} color={colors.common.white} weight="bold" />
                    </View>
                    <Text style={styles.featureText}>Gráficos avanzados de gastos</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <View style={[styles.featureDot, { backgroundColor: colors.accent.green }]}>
                      <Check size={12} color={colors.common.white} weight="bold" />
                    </View>
                    <Text style={styles.featureText}>Exportar a Excel/PDF</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <View style={[styles.featureDot, { backgroundColor: colors.accent.green }]}>
                      <Check size={12} color={colors.common.white} weight="bold" />
                    </View>
                    <Text style={styles.featureText}>Funciones exclusivas</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconCircle, { backgroundColor: colors.warningLight }]}>
                <Bell size={18} color={colors.warning} weight="fill" />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Recordatorios de Pago</Text>
                <Text style={styles.sectionDescription}>
                  Notificaciones para pagar recibos
                </Text>
              </View>
              <Switch
                value={paymentSettings.enabled}
                onValueChange={togglePaymentReminders}
                trackColor={{ false: colors.border, true: colors.primary.main }}
                thumbColor={paymentSettings.enabled ? colors.common.white : colors.common.white}
              />
            </View>
          </View>

          {paymentSettings.enabled && (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Calendar size={18} color={colors.primary.main} weight="fill" />
                  <Text style={styles.cardTitle}>Días de recordatorio</Text>
                </View>
                <Text style={styles.cardDescription}>
                  Selecciona los días del mes
                </Text>

                <View style={styles.calendarGrid}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                    const isSelected = paymentSettings.days.includes(day);
                    return (
                      <TouchableOpacity
                        key={`day-${day}`}
                        style={[styles.calendarDay, isSelected && styles.calendarDayActive]}
                        onPress={() => toggleDay(day)}
                      >
                        {isSelected ? (
                          <Check size={14} color={colors.common.white} weight="bold" />
                        ) : (
                          <Text style={styles.calendarDayText}>{day}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.selectedDaysInfo}>
                  <Check size={14} color={colors.warning} weight="bold" />
                  <Text style={styles.selectedDaysText}>
                    {getDaysText()} seleccionado{paymentSettings.days.length > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Clock size={18} color={colors.primary.main} weight="fill" />
                  <Text style={styles.cardTitle}>Hora del recordatorio</Text>
                </View>

                <View style={styles.hourSelector}>
                  <TouchableOpacity
                    style={styles.hourButton}
                    onPress={() => updateHour(Math.max(6, paymentSettings.hour - 1))}
                  >
                    <Minus size={20} color={colors.text} weight="bold" />
                  </TouchableOpacity>

                  <View style={styles.hourDisplay}>
                    <Text style={styles.hourText} numberOfLines={1}>
                      {formatTime(paymentSettings.hour, paymentSettings.minute)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.hourButton}
                    onPress={() => updateHour(Math.min(22, paymentSettings.hour + 1))}
                  >
                    <Plus size={20} color={colors.text} weight="bold" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.minuteLabel}>Minutos</Text>
                <View style={styles.minuteGrid}>
                  {[0, 15, 30, 45].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.minuteButton,
                        paymentSettings.minute === m && styles.minuteButtonActive,
                      ]}
                      onPress={() => updateMinute(m)}
                    >
                      <Text style={[
                        styles.minuteButtonText,
                        paymentSettings.minute === m && styles.minuteButtonTextActive,
                      ]}>
                        :{m.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.infoCard}>
                <Bell size={16} color={colors.primary.main} weight="fill" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Resumen</Text>
                  <Text style={styles.infoText}>
                    Recordatorios los {getDaysText()} de cada mes a las {formatTime(paymentSettings.hour, paymentSettings.minute)} hrs.
                  </Text>
                </View>
              </View>
            </>
          )}

          {!paymentSettings.enabled && (
            <View style={styles.disabledCard}>
              <View style={styles.disabledIconCircle}>
                <Bell size={28} color={colors.textMuted} weight="light" />
              </View>
              <Text style={styles.disabledTitle}>Recordatorios de pago desactivados</Text>
              <Text style={styles.disabledText}>
                Activa para recibir notificaciones y no olvidar pagar tus recibos.
              </Text>
            </View>
          )}

          {groupCode && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconCircle, { backgroundColor: colors.accent.blueLight }]}>
                    <User size={18} color={colors.accent.blue} weight="fill" />
                  </View>
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>Mi Familia</Text>
                    <Text style={styles.sectionDescription}>
                      Código para compartir con tu familia
                    </Text>
                  </View>
                </View>

                <View style={styles.groupCodeCard}>
                  <Text style={styles.groupCodeLabel}>Código del grupo</Text>
                  <Text style={styles.groupCodeValue} numberOfLines={1} adjustsFontSizeToFit>{groupCode}</Text>
                  {groupName && (
                    <Text style={styles.groupNameText}>Grupo: {groupName}</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.leaveGroupButton}
                  onPress={handleLeaveGroup}
                >
                  <SignOut size={18} color={colors.error} weight="bold" />
                  <Text style={styles.leaveGroupButtonText}>Abandonar grupo</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.bottomSpacer} />

          <Modal
            visible={showSimulatorModal}
            animationType="slide"
            transparent={false}
            onRequestClose={() => setShowSimulatorModal(false)}
          >
            <StatusBar backgroundColor={colors.primary.main} barStyle="light-content" />
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <ChartBar size={22} color={colors.common.white} weight="fill" />
                  <Text style={styles.modalTitle}>Simulador de Deudas</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowSimulatorModal(false)}
                >
                  <X size={22} color={colors.common.white} weight="bold" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
                {financeData && financeData.totalDebtRemaining > 0 && (
                  <View style={styles.modalSummaryCard}>
                    <View style={styles.modalSummaryHeader}>
                      <Shield size={20} color={colors.primary.main} weight="fill" />
                      <Text style={styles.modalSummaryTitle}>Deudas Pendientes</Text>
                    </View>
                    
                    {detailedData.length > 0 && (
                      <>
                        {(() => {
                          console.log('=== RENDER Deudas Pendientes ===');
                          console.log('detailedData length:', detailedData.length);
                          detailedData.forEach((item, index) => {
                            console.log(`Periodo ${index}: ${item.month} ${item.year}`);
                            console.log('  debtDetails:', JSON.stringify(item.debtDetails));
                          });
                          return null;
                        })()}
                        {detailedData.map((item, index) => {
                          const debts = item?.debtDetails?.filter((d: any) => d.remaining > 0 && !d.paidThisMonth) || [];
                          console.log(`Render ${item.month}: ${debts.length} debts pendientes (no pagadas)`);
                          if (debts.length === 0) return null;
                          const isCurrent = index === detailedData.length - 1;
                          return (
                            <View key={index} style={styles.debtItemCard}>
                              <View style={styles.debtItemHeader}>
                                <Text style={styles.debtItemTitle}>
                                  {item.month} {item.year}
                                </Text>
                                {isCurrent && (
                                  <View style={styles.currentBadge}>
                                    <Text style={styles.currentBadgeText}>Actual</Text>
                                  </View>
                                )}
                              </View>
                              {debts.map((d: any, i: number) => (
                                <View key={i} style={styles.debtItemRow}>
                                  <View style={styles.debtItemDot} />
                                  <Text style={styles.debtItemName}>{d.name}</Text>
                                  <Text style={styles.debtItemAmount}>S/ {d.remaining.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</Text>
                                </View>
                              ))}
                            </View>
                          );
                        })}
                      </>
                    )}

                    <View style={styles.modalSummaryDivider} />
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Deuda total (original)</Text>
                      <Text style={[styles.modalSummaryValue, { color: colors.primary.main }]} numberOfLines={1}>S/ {(financeData.totalDebtOriginal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Total pendiente</Text>
                      <Text style={[styles.modalSummaryValue, { color: colors.warning, fontSize: 18 }]} numberOfLines={1}>S/ {financeData.totalDebtRemaining.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Pago mensual</Text>
                      <Text style={styles.modalSummaryValue} numberOfLines={1}>S/ {financeData.monthlyPayment.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</Text>
                    </View>
                  </View>
                )}

                {financeData && financeData.totalDebtRemaining === 0 && (
                  <View style={styles.modalSummaryCard}>
                    <View style={styles.modalSuccessIconCircle}>
                      <Check size={32} color={colors.success} weight="bold" />
                    </View>
                    <Text style={styles.modalSuccessTitle}>Sin Deudas</Text>
                    <Text style={styles.modalSuccessText}>¡Felicitaciones! No tienes deudas pendientes en este momento.</Text>
                  </View>
                )}

                {financeData && financeData.totalDebtRemaining > 0 && (
                  <View style={styles.modalSimulatorSection}>
                    <View style={styles.modalSimulatorHeader}>
                      <ChartBar size={20} color={colors.primary.main} weight="fill" />
                      <Text style={styles.modalSectionTitle}>Simular Tiempo de Pago</Text>
                    </View>
                    
                    <View style={styles.modalInputSection}>
                      <Text style={styles.modalInputLabel}>Ingresa tus propios valores (opcional):</Text>
                      
                      <View style={styles.modalInputRow}>
                        <Text style={styles.modalInputLabelSmall}>Ingreso mensual (S/):</Text>
                        <TextInput
                          style={styles.modalInput}
                          value={manualIncome}
                          onChangeText={text => setManualIncome(text.replace(/[^0-9.]/g, ''))}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={colors.input.placeholder}
                          returnKeyType="done"
                          blurOnSubmit={false}
                        />
                      </View>
                      
                      <View style={styles.modalInputRow}>
                        <Text style={styles.modalInputLabelSmall}>Total Gastos + Servicios (S/):</Text>
                        <TextInput
                          style={styles.modalInput}
                          value={manualExpenses}
                          onChangeText={text => setManualExpenses(text.replace(/[^0-9.]/g, ''))}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={colors.input.placeholder}
                          returnKeyType="done"
                          blurOnSubmit={false}
                        />
                      </View>
                    </View>

                    {(() => {
                      const hasIncome = manualIncome.trim() !== '';
                      const hasExpenses = manualExpenses.trim() !== '';
                      const hasValues = hasIncome || hasExpenses;
                      
                      if (!hasValues) {
                        return (
                          <View style={styles.modalAvailableCard}>
                            <Text style={styles.modalAvailableLabel}>Disponible (Ingresos - Gastos)</Text>
                            <Text style={[styles.modalAvailableValue, { color: colors.textMuted }]}>
                              S/ 0.00
                            </Text>
                            <Text style={styles.modalHintText}>Ingresa valores arriba para calcular</Text>
                          </View>
                        );
                      }
                      
                      const income = parseFloat(manualIncome) || 0;
                      const expenses = parseFloat(manualExpenses) || 0;
                      const available = income - expenses;
                      
                      return (
                        <View style={styles.modalAvailableCard}>
                          <Text style={styles.modalAvailableLabel}>Disponible (Ingresos - Gastos)</Text>
                          <Text style={[styles.modalAvailableValue, { color: available >= 0 ? colors.success : colors.error }]}>
                            S/ {available.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </Text>
                          {available < 0 && (
                            <View style={styles.warningRow}>
                              <X size={14} color={colors.error} weight="bold" />
                              <Text style={styles.modalWarningText}>Tus gastos superan tus ingresos</Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    <View style={styles.modalInputSection}>
                      <Text style={styles.modalInputLabel}>¿Cuánto adicional quieres usar para pagar deudas?</Text>
                      
                      <View style={styles.modalInputRow}>
                        <Text style={styles.modalInputLabelSmall}>Monto adicional mensual (S/):</Text>
                        <TextInput
                          style={styles.modalInput}
                          value={additionalPayment}
                          onChangeText={text => setAdditionalPayment(text.replace(/[^0-9.]/g, ''))}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={colors.input.placeholder}
                          returnKeyType="done"
                          blurOnSubmit={false}
                        />
                      </View>
                    </View>

                    {(() => {
                      const income = parseFloat(manualIncome) || financeData.averageIncome;
                      const expenses = parseFloat(manualExpenses) || financeData.averageExpenses;
                      const additional = parseFloat(additionalPayment) || 0;
                      const available = income - expenses;
                      const totalPayment = available + additional;
                      
                      const monthsRemaining = totalPayment > 0 ? Math.ceil(financeData.totalDebtRemaining / totalPayment) : 0;
                      const today = new Date();
                      const futureDate = new Date(today.getFullYear(), today.getMonth() + monthsRemaining, today.getDate());
                      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                      
                      return (
                        <View style={styles.modalResultCard}>
                          {monthsRemaining > 0 && monthsRemaining <= 600 ? (
                            <>
                              <View style={styles.resultSuccessIcon}>
                                <Check size={24} color={colors.success} weight="bold" />
                              </View>
                              <Text style={styles.modalResultValue}>Libre de deudas en {monthsRemaining} meses</Text>
                              <Text style={styles.modalResultDate}>Fecha estimada: {monthNames[futureDate.getMonth()]} {futureDate.getFullYear()}</Text>
                              <Text style={styles.modalResultSubtext} numberOfLines={3}>
                                Pagando S/ {totalPayment.toLocaleString('es-PE', { minimumFractionDigits: 2 })}/mes{'\n'}
                                (S/ {available.toLocaleString('es-PE', { minimumFractionDigits: 2 })} disponible + S/ {additional.toLocaleString('es-PE', { minimumFractionDigits: 2 })} adicional)
                              </Text>
                            </>
                          ) : totalPayment <= 0 ? (
                            <View style={styles.resultWarningContent}>
                              <X size={20} color={colors.error} weight="bold" />
                              <Text style={styles.modalResultWarning}>
                                Ingresa un monto adicional para pagar tus deudas{'\n'}
                                o increase tus ingresos
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.resultWarningContent}>
                              <X size={20} color={colors.error} weight="bold" />
                              <Text style={styles.modalResultWarning}>
                                El tiempo de pago es muy extenso.{'\n'}
                                Considera aumentar el monto adicional.
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                )}

                {financeData && financeData.totalDebtRemaining === 0 && (
                  <View style={styles.modalResultCard}>
                    <View style={styles.resultSuccessIcon}>
                      <Check size={28} color={colors.success} weight="bold" />
                    </View>
                    <Text style={styles.modalResultSuccess}>¡Felicitaciones! No tienes deudas pendientes</Text>
                  </View>
                )}

                <View style={styles.modalSpacer} />
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </ScrollView>
      </SafeAreaView>

      <ConfirmDialog
        visible={leaveGroupDialogVisible}
        title="Abandonar grupo"
        message={`¿Estás seguro de que quieres abandonar el grupo "${groupName || groupCode}"? Perderás acceso a los datos compartidos de la familia.`}
        confirmText="Abandonar"
        onConfirm={confirmLeaveGroup}
        onCancel={() => setLeaveGroupDialogVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary.main,
    paddingBottom: spacing[24],
  },
  headerSafeArea: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: spacing[16],
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.common.white,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textInverse,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing[2],
  },
  content: {
    flex: 1,
  },
  loadingText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing[64],
    color: colors.textMuted,
  },
  section: {
    backgroundColor: colors.card,
    marginHorizontal: spacing[16],
    marginTop: spacing[16],
    borderRadius: borderRadius.lg,
    padding: spacing[20],
    ...shadows.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[12],
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
  },
  sectionDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  actionCard: {
    marginTop: spacing[16],
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[16],
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[12],
  },
  actionTextContent: {
    flex: 1,
  },
  actionTitle: {
    ...typography.label,
    color: colors.text,
  },
  actionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[12],
    gap: spacing[6],
  },
  hintText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  emptyState: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing[24],
    alignItems: 'center',
    marginTop: spacing[12],
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    marginHorizontal: spacing[16],
    marginTop: spacing[12],
    borderRadius: borderRadius.lg,
    padding: spacing[20],
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: spacing[4],
  },
  cardTitle: {
    ...typography.label,
    color: colors.text,
  },
  cardDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing[16],
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
  },
  calendarDay: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayActive: {
    backgroundColor: colors.warning,
  },
  calendarDayText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  selectedDaysInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[12],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.sm,
    gap: spacing[6],
  },
  selectedDaysText: {
    ...typography.captionMedium,
    color: colors.warning,
    flex: 1,
  },
  hourSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing[16],
  },
  hourButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourDisplay: {
    paddingHorizontal: spacing[24],
    alignItems: 'center',
  },
  hourText: {
    ...typography.h1,
    color: colors.primary.main,
    fontSize: 36,
  },
  minuteLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  minuteGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[8],
  },
  minuteButton: {
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[16],
    borderRadius: borderRadius.sm,
    backgroundColor: colors.backgroundSecondary,
    minWidth: 50,
    alignItems: 'center',
  },
  minuteButtonActive: {
    backgroundColor: colors.primary.main,
  },
  minuteButtonText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  minuteButtonTextActive: {
    color: colors.common.white,
  },
  infoCard: {
    backgroundColor: colors.primary.light,
    marginHorizontal: spacing[16],
    marginTop: spacing[12],
    borderRadius: borderRadius.md,
    padding: spacing[16],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[10],
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    ...typography.label,
    color: colors.primary.main,
    marginBottom: spacing[2],
  },
  infoText: {
    ...typography.caption,
    color: colors.primary.dark,
    lineHeight: 18,
  },
  disabledCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing[16],
    marginTop: spacing[12],
    borderRadius: borderRadius.lg,
    padding: spacing[24],
    alignItems: 'center',
    ...shadows.sm,
  },
  disabledIconCircle: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  disabledTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing[6],
    textAlign: 'center',
  },
  disabledText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  divider: {
    height: spacing[8],
    backgroundColor: colors.backgroundSecondary,
    marginVertical: spacing[8],
  },
  groupCodeCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing[20],
    alignItems: 'center',
    marginTop: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupCodeLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing[4],
  },
  groupCodeValue: {
    ...typography.h1,
    color: colors.primary.main,
    letterSpacing: 2,
    fontSize: 24,
  },
  groupNameText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[6],
  },
  leaveGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[20],
    marginTop: spacing[16],
    gap: spacing[8],
    borderWidth: 1,
    borderColor: colors.error,
  },
  leaveGroupButtonText: {
    ...typography.buttonSmall,
    color: colors.error,
  },
  premiumButton: {
    marginTop: spacing[16],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.warning,
    ...shadows.colored(colors.warning),
  },
  premiumButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[16],
    gap: spacing[12],
  },
  premiumButtonIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumButtonTextContent: {
    flex: 1,
  },
  premiumButtonTitle: {
    ...typography.button,
    color: colors.common.white,
  },
  premiumButtonSubtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.9)',
    marginTop: spacing[2],
  },
  premiumFeatures: {
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.md,
    padding: spacing[16],
    marginTop: spacing[12],
  },
  premiumFeaturesTitle: {
    ...typography.label,
    color: colors.warning,
    marginBottom: spacing[12],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[10],
    gap: spacing[10],
  },
  featureDot: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  premiumActiveCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.lg,
    padding: spacing[20],
    alignItems: 'center',
    marginTop: spacing[16],
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    borderRadius: borderRadius.full,
    marginBottom: spacing[12],
    gap: spacing[6],
  },
  premiumBadgeText: {
    ...typography.captionMedium,
    color: colors.common.white,
  },
  premiumActiveText: {
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[12],
    lineHeight: 20,
  },
  restoreButton: {
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[16],
  },
  restoreButtonText: {
    ...typography.captionMedium,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  bottomSpacer: {
    height: spacing[24],
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[16],
    backgroundColor: colors.primary.main,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  modalTitle: {
    ...typography.h3,
    color: colors.common.white,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    padding: spacing[16],
  },
  modalSummaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing[20],
    marginBottom: spacing[20],
    ...shadows.md,
  },
  modalSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: spacing[12],
  },
  modalSummaryTitle: {
    ...typography.h4,
    color: colors.primary.main,
  },
  modalSummaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing[12],
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  modalSummaryLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  modalSummaryValue: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  modalSimulatorSection: {
    marginTop: spacing[20],
    paddingTop: spacing[20],
    borderTopWidth: 2,
    borderTopColor: colors.primary.light,
  },
  modalSimulatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: spacing[16],
  },
  modalSectionTitle: {
    ...typography.h4,
    color: colors.text,
  },
  modalInputSection: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing[16],
    marginTop: spacing[16],
  },
  modalInputLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing[12],
  },
  modalInputLabelSmall: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[8],
    gap: spacing[8],
  },
  modalInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    fontSize: 16,
    textAlign: 'right',
    minHeight: 44,
    color: colors.text,
  },
  modalAvailableCard: {
    backgroundColor: colors.primary.light,
    borderRadius: borderRadius.md,
    padding: spacing[20],
    marginTop: spacing[16],
    alignItems: 'center',
  },
  modalAvailableLabel: {
    ...typography.bodySmall,
    color: colors.primary.main,
    marginBottom: spacing[4],
  },
  modalAvailableValue: {
    ...typography.currency,
    fontSize: 24,
  },
  modalWarningText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing[4],
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginTop: spacing[4],
  },
  modalHintText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[4],
  },
  modalResultCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.lg,
    padding: spacing[24],
    marginTop: spacing[16],
    alignItems: 'center',
  },
  resultSuccessIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[12],
    borderWidth: 2,
    borderColor: colors.success,
  },
  resultWarningContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[8],
  },
  modalResultValue: {
    ...typography.h3,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  modalResultDate: {
    ...typography.bodyMedium,
    color: colors.success,
    marginBottom: spacing[8],
  },
  modalResultSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalResultSuccess: {
    ...typography.h4,
    color: colors.success,
    textAlign: 'center',
  },
  modalResultWarning: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    lineHeight: 20,
    flex: 1,
  },
  modalSpacer: {
    height: 32,
  },
  debtItemCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    padding: spacing[12],
    marginBottom: spacing[8],
    borderWidth: 1,
    borderColor: colors.warning,
  },
  debtItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  debtItemTitle: {
    ...typography.label,
    color: colors.warning,
  },
  currentBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
  },
  currentBadgeText: {
    ...typography.captionMedium,
    color: colors.warning,
  },
  debtItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    gap: spacing[6],
  },
  debtItemDot: {
    width: 4,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.warning,
  },
  debtItemName: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  debtItemAmount: {
    ...typography.captionMedium,
    color: colors.text,
  },
  modalSuccessIconCircle: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  modalSuccessTitle: {
    ...typography.h2,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  modalSuccessText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ProfileScreen;
