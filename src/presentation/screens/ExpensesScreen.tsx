import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  Modal,
  StatusBar,
  Share,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as ClipboardAPI from 'expo-clipboard';
import { ExpensePeriod, ExpenseSettings } from '../../domain/entities/Expense';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { getDatabase } from '../../data/Database';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import {
  getSavedGroupCode,
  getSavedGroupName,
  savePeriodToCloud,
  getPeriodsFromCloud,
  deletePeriodFromCloud,
  subscribeToPeriods,
  subscribeToSettings,
} from '../../services/SyncService';
import AdBanner from '../components/AdBanner';

type ExpensesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const ExpensesScreen: React.FC = () => {
  const navigation = useNavigation<ExpensesScreenNavigationProp>();
  const [periods, setPeriods] = useState<ExpensePeriod[]>([]);
  const [settings, setSettings] = useState<ExpenseSettings | null>(null);
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('Mi Grupo');
  const [isLoading, setIsLoading] = useState(true);
  
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    initScreen();
  }, []);

  const initScreen = async () => {
    setIsLoading(true);
    const code = await getSavedGroupCode();
    const name = await getSavedGroupName();
    
    if (code) {
      setGroupCode(code);
      setGroupName(name || 'Mi Grupo');
      
      const unsubPeriods = subscribeToPeriods(code, (cloudPeriods) => {
        setPeriods(cloudPeriods);
        setIsLoading(false);
      });
      
      const unsubSettings = subscribeToSettings(code, (cloudSettings) => {
        if (cloudSettings) setSettings(cloudSettings);
      });
      
      const cloudPeriods = await getPeriodsFromCloud(code);
      setPeriods(cloudPeriods);
      setIsLoading(false);
      
      return () => {
        unsubPeriods();
        unsubSettings();
      };
    } else {
      const repo = new SQLiteExpenseRepository(getDatabase());
      const [periodsData, settingsData] = await Promise.all([
        repo.getAllPeriods(),
        repo.getSettings(),
      ]);
      setPeriods(periodsData);
      setSettings(settingsData);
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!groupCode) {
        loadDataLocal();
      }
    }, [groupCode])
  );

  const loadDataLocal = async () => {
    try {
      const repo = new SQLiteExpenseRepository(getDatabase());
      const [periodsData, settingsData] = await Promise.all([
        repo.getAllPeriods(),
        repo.getSettings(),
      ]);
      setPeriods(periodsData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Error loading local data:', error);
    }
  };

  const createNewPeriod = async () => {
    try {
      const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      
      const existing = periods.find(p => p.month === monthStr);
      if (existing) {
        Alert.alert('Error', 'Ya existe un registro para este mes');
        return;
      }

      let latestReadings = new Map<string, number>();
      
      if (groupCode) {
        if (periods.length > 0) {
          const sortedPeriods = [...periods].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return parseInt(b.month.split('-')[1]) - parseInt(a.month.split('-')[1]);
          });
          const latestPeriod = sortedPeriods[0];
          latestPeriod.floorsElectricity.forEach(floor => {
            latestReadings.set(floor.floorId, floor.currentReading);
          });
        }
      } else {
        const repo = new SQLiteExpenseRepository(getDatabase());
        const latestPeriod = await repo.getLatestPeriod();
        if (latestPeriod) {
          latestReadings = repo.getLatestReadingsFromPeriod(latestPeriod);
        }
      }

      const floorsElectricity = settings?.floors.filter(f => f.hasElectricityMeter).map(floor => {
        const previousReading = latestReadings.get(floor.id) || 0;
        return {
          floorId: floor.id,
          floorName: floor.name,
          previousReading,
          currentReading: 0,
          realReading: 0,
          consumptionPrice: 0,
          igv: 0,
          fixedCharge: floor.fixedCharge || 0,
          surplus: 0,
          paysSurplus: false,
          totalToPay: 0,
        };
      }) || [];

      const floorsWater = settings?.floors.map(floor => ({
        floorId: floor.id,
        floorName: floor.name,
        percentage: floor.waterPercentage || 0,
        fixedAmount: floor.waterFixedAmount || 0,
        amount: 0,
      })) || [];

      const newPeriod: ExpensePeriod = {
        id: Date.now().toString(),
        month: monthStr,
        year: selectedYear,
        monthName: MONTHS[selectedMonth],
        electricity: {
          tariffPerKwh: settings?.electricityTariffPerKwh || 0.66,
          igvPercentage: settings?.igvPercentage || 18,
          totalReceipt: 0,
          totalFromMeters: 0,
          surplus: 0,
          surplusToDistribute: 0,
        },
        water: {
          totalReceipt: 0,
        },
        floorsElectricity,
        floorsWater,
        otherExpenses: [],
        income: [],
        savedSettings: settings || {
          floors: [],
          electricityTariffPerKwh: 0.66,
          igvPercentage: 18,
          waterTotalPercentage: 100,
          expenseCategories: [],
          incomeSources: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (groupCode) {
        await savePeriodToCloud(groupCode, newPeriod);
      } else {
        const repo = new SQLiteExpenseRepository(getDatabase());
        await repo.createPeriod(newPeriod);
        setPeriods(prev => [...prev, newPeriod]);
      }

      setShowNewPeriodModal(false);
      
      if (latestReadings.size > 0) {
        Alert.alert(
          'Período creado',
          `Se creó ${MONTHS[selectedMonth]} ${selectedYear}.\n\nLas lecturas anteriores se copiaron automáticamente.`
        );
      }
    } catch (error) {
      console.error('Error creating period:', error);
      Alert.alert('Error', 'No se pudo crear el período');
    }
  };

  const deletePeriod = (period: ExpensePeriod) => {
    Alert.alert(
      'Eliminar período',
      `¿Eliminar ${period.monthName} ${period.year}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (groupCode) {
                await deletePeriodFromCloud(groupCode, period.id);
              }
              setPeriods(prev => prev.filter(p => p.id !== period.id));
            } catch (error) {
              console.error('Error deleting period:', error);
            }
          },
        },
      ]
    );
  };

  const handleShareCode = async () => {
    if (!groupCode) return;
    
    try {
      await ClipboardAPI.setStringAsync(groupCode);
      await Share.share({
        message: `Únete a mi grupo "${groupName}" en CasaBalance!\n\nCódigo: ${groupCode}\n\nDescarga la app e ingresa este código para ver y editar los gastos de la casa.`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatCurrency = (amount: number) => `S/ ${amount.toFixed(2)}`;

  const getTotalElectricity = (period: ExpensePeriod) => {
    return period.floorsElectricity.reduce((sum, f) => sum + f.totalToPay, 0);
  };

  const getTotalWater = (period: ExpensePeriod) => {
    return period.floorsWater.reduce((sum, f) => sum + f.amount, 0);
  };

  const PeriodCard: React.FC<{ period: ExpensePeriod }> = ({ period }) => (
    <TouchableOpacity
      style={styles.periodCard}
      onPress={() => navigation.navigate('ExpenseDetail', { periodId: period.id })}
      onLongPress={() => deletePeriod(period)}
    >
      <LinearGradient
        colors={['#ffffff', '#f8f9fa']}
        style={styles.periodCardGradient}
      >
        <View style={styles.periodHeader}>
          <Text style={styles.periodMonth}>{period.monthName} {period.year}</Text>
          <Text style={styles.periodTotal}>
            {formatCurrency(getTotalElectricity(period) + getTotalWater(period))}
          </Text>
        </View>
        
        <View style={styles.periodDetails}>
          <View style={styles.periodDetail}>
            <Text style={styles.periodDetailIcon}>⚡</Text>
            <View>
              <Text style={styles.periodDetailLabel}>Electricidad</Text>
              <Text style={styles.periodDetailValue}>
                {period.floorsElectricity.length} pisos • {formatCurrency(getTotalElectricity(period))}
              </Text>
            </View>
          </View>
          
          <View style={styles.periodDetail}>
            <Text style={styles.periodDetailIcon}>💧</Text>
            <View>
              <Text style={styles.periodDetailLabel}>Agua</Text>
              <Text style={styles.periodDetailValue}>
                {formatCurrency(getTotalWater(period))}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.tapHint}>Toca para editar • Mantén para eliminar</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1565C0', '#2196F3']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>💡 {groupName}</Text>
            <Text style={styles.headerSubtitle}>Luz y Agua</Text>
          </View>
          {groupCode && (
            <TouchableOpacity style={styles.shareCodeButton} onPress={handleShareCode}>
              <Text style={styles.shareCodeIcon}>📤</Text>
              <Text style={styles.shareCodeText}>Compartir</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {groupCode && (
          <View style={styles.codeBanner}>
            <Text style={styles.codeLabel}>Código:</Text>
            <Text style={styles.codeValue}>{groupCode}</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {settings && (
          <Animated.View 
            style={[
              styles.settingsCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => navigation.navigate('FloorsConfig')}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
              <View style={styles.settingsText}>
                <Text style={styles.settingsTitle}>Configuración</Text>
                <Text style={styles.settingsSubtitle}>
                  {settings.floors.length} pisos • Tarifa: S/ {settings.electricityTariffPerKwh}/kWh
                </Text>
              </View>
              <Text style={styles.settingsArrow}>›</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowNewPeriodModal(true)}
        >
          <LinearGradient
            colors={['#4CAF50', '#388E3C']}
            style={styles.addButtonGradient}
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Nuevo período</Text>
          </LinearGradient>
        </TouchableOpacity>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        ) : periods.length === 0 ? (
          <Animated.View 
            style={[
              styles.emptyState,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Sin registros</Text>
            <Text style={styles.emptyText}>
              Crea un nuevo período para comenzar a registrar tus gastos
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.periodsList}>
            {periods.map((period) => (
              <Animated.View
                key={period.id}
                style={[
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}
              >
                <PeriodCard period={period} />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showNewPeriodModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewPeriodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Período</Text>
            
            <Text style={styles.modalLabel}>Mes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
              {MONTHS.map((month, index) => (
                <TouchableOpacity
                  key={month}
                  style={[
                    styles.monthButton,
                    selectedMonth === index && styles.monthButtonActive
                  ]}
                  onPress={() => setSelectedMonth(index)}
                >
                  <Text style={[
                    styles.monthButtonText,
                    selectedMonth === index && styles.monthButtonTextActive
                  ]}>
                    {month.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Año</Text>
            <View style={styles.yearSelector}>
              <TouchableOpacity 
                style={styles.yearButton}
                onPress={() => setSelectedYear(y => y - 1)}
              >
                <Text style={styles.yearButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.yearText}>{selectedYear}</Text>
              <TouchableOpacity 
                style={styles.yearButton}
                onPress={() => setSelectedYear(y => y + 1)}
              >
                <Text style={styles.yearButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowNewPeriodModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={createNewPeriod}
              >
                <Text style={styles.modalConfirmText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: colors.header.background,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.header.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.header.text,
    opacity: 0.9,
    marginTop: 2,
  },
  shareCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareCodeIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  shareCodeText: {
    fontSize: 13,
    color: colors.header.text,
    fontWeight: '600',
  },
  codeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  codeLabel: {
    fontSize: 12,
    color: colors.header.text,
    opacity: 0.8,
    marginRight: 6,
  },
  codeValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.header.text,
    letterSpacing: 2,
  },
  scrollView: {
    flex: 1,
  },
  settingsCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingsText: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  settingsSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  settingsArrow: {
    fontSize: 24,
    color: colors.textMuted,
  },
  addButton: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  addButtonIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  addButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  periodsList: {
    padding: 16,
    gap: 12,
  },
  periodCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  periodCardGradient: {
    padding: 16,
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  periodMonth: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  periodTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  periodDetails: {
    gap: 12,
    marginBottom: 12,
  },
  periodDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodDetailIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  periodDetailLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  periodDetailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 11,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  monthScroll: {
    marginBottom: 16,
  },
  monthButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  monthButtonActive: {
    backgroundColor: '#2196F3',
  },
  monthButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  monthButtonTextActive: {
    color: '#fff',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  yearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearButtonText: {
    fontSize: 24,
    color: '#333',
  },
  yearText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default ExpensesScreen;
