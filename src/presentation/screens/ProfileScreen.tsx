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
  FlatList,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { colors } from '../theme/colors';
import { SQLiteFinanceRepository } from '../../data/repositories/SQLiteFinanceRepository';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { getDatabase } from '../../data/Database';
import { FinancePeriod } from '../../domain/entities/Finance';
import { getSavedGroupCode, getSavedGroupName, clearGroupCode } from '../../services/SyncService';

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
  const [selectedPercentage, setSelectedPercentage] = useState(20);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [detailedData, setDetailedData] = useState<any[]>([]);
  const [manualIncome, setManualIncome] = useState('');
  const [manualExpenses, setManualExpenses] = useState('');
  const [additionalPayment, setAdditionalPayment] = useState('');
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);

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

  // Recargar datos del simulador cada vez que se abre el modal
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
          
          // Reconstruir financeData
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

          // Generar detailedData
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

      // Calcular TOTAL de ingresos de Finanzas
      let totalIncome = 0;
      let totalFinanceExpenses = 0;
      let totalDebtRemaining = 0;
      let totalDebtOriginal = 0;
      let totalMonthlyPayment = 0;

      // Deudas únicas del período más reciente
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

      // Calcular TOTAL de gastos de Luz y Agua
      let totalLuz = 0;
      let totalAgua = 0;
      
      expensePeriods.forEach(p => {
        // Gastos de luz por piso
        p.floorsElectricity.forEach(floor => {
          totalLuz += floor.consumptionPrice + floor.igv;
        });
        // Gastos de agua
        totalAgua += p.water.totalReceipt || 0;
      });

      console.log('Gastos de Luz y Agua:');
      console.log('  Total Luz:', totalLuz);
      console.log('  Total Agua:', totalAgua);

      // Calcular PROMEDIOS
      const totalMonths = Math.max(financePeriods.length, expensePeriods.length, 1);
      const averageIncome = totalIncome / totalMonths;
      const averageFinanceExpenses = totalFinanceExpenses / totalMonths;
      const averageLuz = totalLuz / totalMonths;
      const averageAgua = totalAgua / totalMonths;
      
      // Total de todos los gastos
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
      
      // Generar datos detallados por mes
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
      '🎉 ¡Únete a Premium!',
      `Versión premium por ${MONETIZATION_CONFIG.PRICES.MONTHLY}/mes\n\n✓ Sin publicidad\n✓ Gráficos avanzados\n✓ Exportar a Excel\n✓ Funciones exclusivas\n\n*Esta es una versión de prueba`,
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
    Alert.alert(
      '🚪 Abandonar grupo',
      `¿Estás seguro de que quieres abandonar el grupo "${groupName || groupCode}"?\n\nPerderás acceso a los datos compartidos de la familia.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abandonar',
          style: 'destructive',
          onPress: async () => {
            console.log(`${LOG_PREFIX} handleLeaveGroup - confirmando`);
            await clearGroupCode();
            console.log(`${LOG_PREFIX} handleLeaveGroup - código limpiado`);
            setGroupCode(null);
            setGroupName(null);
            Alert.alert('Listo', 'Has abandonado el grupo. Ahora puedes crear o unirte a otro.');
            console.log(`${LOG_PREFIX} handleLeaveGroup - fin`);
          },
        },
      ]
    );
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
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />
      <LinearGradient colors={['#1565C0', '#2196F3']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>U</Text>
              </View>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Mi Perfil</Text>
              <Text style={styles.headerSubtitle}>Configura tus preferencias</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <SafeAreaView style={styles.contentContainer} edges={['bottom']}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Luz y Agua</Text>
          <Text style={styles.sectionDescription}>
            Gestiona los servicios de tu hogar
          </Text>
          
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
          
          <Text style={styles.tabHint}>
            💡 Para ver Gastos, usa la pestaña inferior
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Simulador de Deudas</Text>
          <Text style={styles.sectionDescription}>
            Calcula cuánto tiempo teará pagar tus deudas
          </Text>
          
          {!financeData ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📈</Text>
              <Text style={styles.emptyText}>
                No hay datos de finanzas registrados.{'\n'}
                Agrega ingresos y gastos en la sección Finanzas.
              </Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.utilityButton}
              onPress={() => setShowSimulatorModal(true)}
            >
              <LinearGradient
                colors={['#4CAF50', '#388E3C']}
                style={styles.utilityButtonGradient}
              >
                <Text style={styles.utilityButtonIcon}>📊</Text>
                <View style={styles.utilityButtonContent}>
                  <Text style={styles.utilityButtonTitle}>Abrir Simulador</Text>
                  <Text style={styles.utilityButtonSubtitle}>
                    Ver análisis detallado por mes
                  </Text>
                </View>
                <Text style={styles.utilityButtonArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
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

              <View style={styles.calendarGrid}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                  const isSelected = paymentSettings.days.includes(day);
                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      style={[styles.calendarDay, isSelected && styles.calendarDayActive]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[styles.calendarDayText, isSelected && styles.calendarDayTextActive]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
                    {formatTime(paymentSettings.hour, paymentSettings.minute)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.hourButton}
                  onPress={() => updateHour(Math.min(22, paymentSettings.hour + 1))}
                >
                  <Text style={styles.hourButtonText}>+</Text>
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
              <Text style={styles.infoIcon}>💡</Text>
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
            <Text style={styles.disabledIcon}>🔕</Text>
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
              <Text style={styles.sectionTitle}>👨‍👩‍👧‍👦 Mi Familia</Text>
              <Text style={styles.sectionDescription}>
                Código para compartir con tu familia
              </Text>
              <View style={styles.groupCodeCard}>
                <Text style={styles.groupCodeLabel}>Código del grupo:</Text>
                <Text style={styles.groupCodeValue}>{groupCode}</Text>
                {groupName && (
                  <Text style={styles.groupNameText}>Grupo: {groupName}</Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.leaveGroupButton}
                onPress={handleLeaveGroup}
              >
                <Text style={styles.leaveGroupButtonText}>🚪 Abandonar grupo</Text>
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
        <StatusBar backgroundColor="#1565C0" barStyle="light-content" />
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📊 Simulador de Deudas</Text>
            <TouchableOpacity onPress={() => setShowSimulatorModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Deudas Pendientes - Todos los períodos no pagados */}
            {financeData && financeData.totalDebtRemaining > 0 && (
              <View style={styles.modalSummaryCard}>
                <Text style={styles.modalSummaryTitle}>🏦 Deudas Pendientes</Text>
                
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
                          <Text style={styles.debtItemTitle}>
                            {item.month} {item.year} {isCurrent ? '(Actual)' : ''}
                          </Text>
                          {debts.map((d: any, i: number) => (
                            <View key={i} style={styles.debtItemRow}>
                              <Text style={styles.debtItemName}>• {d.name}</Text>
                              <Text style={styles.debtItemAmount}>S/ {d.remaining.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </>
                )}

                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Deuda total (original):</Text>
                  <Text style={[styles.modalSummaryValue, { color: '#1565C0' }]}>S/ {(financeData.totalDebtOriginal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={[styles.modalSummaryRow, { borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 10, marginTop: 5 }]}>
                  <Text style={styles.modalSummaryLabel}>Total pendiente:</Text>
                  <Text style={[styles.modalSummaryValue, { color: '#FF9800', fontSize: 18 }]}>S/ {financeData.totalDebtRemaining.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Pago mensual:</Text>
                  <Text style={styles.modalSummaryValue}>S/ {financeData.monthlyPayment.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>
            )}

            {financeData && financeData.totalDebtRemaining === 0 && (
              <View style={styles.modalSummaryCard}>
                <Text style={styles.modalSuccessTitle}>✅ Sin Deudas</Text>
                <Text style={styles.modalSuccessText}>¡Felicitaciones! No tienes deudas pendientes en este momento.</Text>
              </View>
            )}

            {/* Simulador */}
            {financeData && financeData.totalDebtRemaining > 0 && (
              <View style={styles.modalSimulatorSection}>
                <Text style={styles.modalSectionTitle}>🎯 Simular Tiempo de Pago</Text>
                
                {/* Editor de Ingresos y Gastos */}
                <View style={styles.modalInputSection}>
                  <Text style={styles.modalInputLabel}>📝 Ingresa tus propios valores (opcional):</Text>
                  
                  <View style={styles.modalInputRow}>
                    <Text style={styles.modalInputLabelSmall}>Ingreso mensual (S/):</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={manualIncome}
                      onChangeText={text => setManualIncome(text.replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#999"
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
                      placeholderTextColor="#999"
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>
                </View>

                {/* Cálculo del Disponible - solo mostrar cuando usuario ingrese valores */}
                {(() => {
                  const hasIncome = manualIncome.trim() !== '';
                  const hasExpenses = manualExpenses.trim() !== '';
                  const hasValues = hasIncome || hasExpenses;
                  
                  if (!hasValues) {
                    return (
                      <View style={styles.modalAvailableCard}>
                        <Text style={styles.modalAvailableLabel}>💰 Disponible (Ingresos - Gastos):</Text>
                        <Text style={[styles.modalAvailableValue, { color: '#666' }]}>
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
                      <Text style={styles.modalAvailableLabel}>💰 Disponible (Ingresos - Gastos):</Text>
                      <Text style={[styles.modalAvailableValue, { color: available >= 0 ? '#43A047' : '#E53935' }]}>
                        S/ {available.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </Text>
                      {available < 0 && (
                        <Text style={styles.modalWarningText}>⚠️ Tus gastos superan tus ingresos</Text>
                      )}
                    </View>
                  );
                })()}

                {/* Pago adicional para deudas */}
                <View style={styles.modalInputSection}>
                  <Text style={styles.modalInputLabel}>💳 ¿Cuánto adicional quieres usar para pagar deudas?</Text>
                  
                  <View style={styles.modalInputRow}>
                    <Text style={styles.modalInputLabelSmall}>Monto adicional mensual (S/):</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={additionalPayment}
                      onChangeText={text => setAdditionalPayment(text.replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#999"
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>
                </View>

                {/* Resultado del cálculo */}
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
                          <Text style={styles.modalResultValue}>✓ Libre de deudas en {monthsRemaining} meses</Text>
                          <Text style={styles.modalResultDate}>Fecha estimada: {monthNames[futureDate.getMonth()]} {futureDate.getFullYear()}</Text>
                          <Text style={styles.modalResultSubtext}>
                            Pagando S/ {totalPayment.toLocaleString('es-PE', { minimumFractionDigits: 2 })}/mes{'\n'}
                            (S/ {available.toLocaleString('es-PE', { minimumFractionDigits: 2 })} disponible + S/ {additional.toLocaleString('es-PE', { minimumFractionDigits: 2 })} adicional)
                          </Text>
                        </>
                      ) : totalPayment <= 0 ? (
                        <Text style={styles.modalResultWarning}>
                          ⚠️ Ingresa un monto adicional para pagar tus deudas{'\n'}
                          o increase tus ingresos
                        </Text>
                      ) : (
                        <Text style={styles.modalResultWarning}>
                          ⚠️ El tiempo de pago es muy extenso.{'\n'}
                          Considera aumentar el monto adicional.
                        </Text>
                      )}
                    </View>
                  );
                })()}
              </View>
            )}

            {financeData && financeData.totalDebtRemaining === 0 && (
              <View style={styles.modalResultCard}>
                <Text style={styles.modalResultSuccess}>🎉 ¡Felicitaciones! No tienes deudas pendientes</Text>
              </View>
            )}

            <View style={styles.modalSpacer} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  contentContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingBottom: 20,
  },
  headerSafeArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
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
  headerTextContainer: {
    flex: 1,
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
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
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
  tabHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
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
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  calendarHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarEmpty: {
    width: 40,
    height: 36,
    margin: 2,
  },
  calendarDay: {
    width: 40,
    height: 36,
    margin: 2,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayActive: {
    backgroundColor: '#FF9800',
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  calendarDayTextActive: {
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
  minuteLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  minuteGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  minuteButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    minWidth: 50,
    alignItems: 'center',
  },
  minuteButtonActive: {
    backgroundColor: '#FF9800',
  },
  minuteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  minuteButtonTextActive: {
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
  emptyState: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  simulatorCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  simulatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  simulatorLabel: {
    fontSize: 14,
    color: '#666',
  },
  simulatorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  percentageLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 15,
    marginBottom: 10,
  },
  percentageOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  percentageButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  percentageButtonActive: {
    backgroundColor: '#1565C0',
    borderColor: '#1565C0',
  },
  percentageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  percentageButtonTextActive: {
    color: '#fff',
  },
  resultCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 20,
    marginTop: 15,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 14,
    color: '#1565C0',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 5,
  },
  resultDate: {
    fontSize: 16,
    color: '#1565C0',
    fontWeight: '600',
  },
  resultSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  resultWarning: {
    fontSize: 13,
    color: '#E53935',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1565C0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalClose: {
    fontSize: 24,
    color: '#fff',
    padding: 5,
  },
  modalContent: {
    flex: 1,
    padding: 15,
  },
  modalSummaryCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  modalSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 10,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  modalSummaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  modalSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
  },
  modalEmpty: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  modalMonthCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  modalMonthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalMonthName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  modalMonthDebt: {
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '600',
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  modalDetailLabel: {
    fontSize: 13,
    color: '#666',
  },
  modalDetailValue: {
    fontSize: 13,
    color: '#333',
  },
  modalDetailLabelBold: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalDetailValueBold: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalDebtInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalDebtTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  modalDebtItem: {
    fontSize: 12,
    color: '#FF9800',
  },
  modalSimulatorSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#1565C0',
  },
  modalPercentageLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  modalResultCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 20,
    marginTop: 15,
    alignItems: 'center',
  },
  modalResultValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#43A047',
    marginBottom: 5,
  },
  modalResultDate: {
    fontSize: 16,
    color: '#43A047',
    marginBottom: 5,
  },
  modalResultSubtext: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  modalResultSuccess: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#43A047',
    textAlign: 'center',
  },
  modalResultWarning: {
    fontSize: 14,
    color: '#E53935',
    textAlign: 'center',
  },
  modalInputSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginTop: 15,
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  modalInputLabelSmall: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'right',
    minHeight: 44,
    color: '#000',
  },
  modalAvailableCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    alignItems: 'center',
  },
  modalAvailableLabel: {
    fontSize: 14,
    color: '#1565C0',
    marginBottom: 5,
  },
  modalAvailableValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalWarningText: {
    fontSize: 12,
    color: '#E53935',
    marginTop: 5,
  },
  modalHintText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  debtItemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  debtItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
    marginBottom: 5,
  },
  debtItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  debtItemName: {
    fontSize: 13,
    color: '#666',
  },
  debtItemAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  modalSuccessTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#43A047',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalSuccessText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalSpacer: {
    height: 30,
  },
  groupCodeCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupCodeLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  groupCodeValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary.main,
    letterSpacing: 3,
  },
  groupNameText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },
  leaveGroupButton: {
    backgroundColor: '#ffebee',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef5350',
  },
  leaveGroupButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#c62828',
  },
  bottomSpacer: {
    height: 20,
  },
});

export default ProfileScreen;
