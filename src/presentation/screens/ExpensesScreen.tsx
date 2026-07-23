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
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ClipboardAPI from 'expo-clipboard';
import { Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Lightning,
  Drop,
  GearSix,
  Plus,
  House,
  CaretRight,
  Trash,
  MagnifyingGlass,
  Share as ShareIcon,
} from 'phosphor-react-native';
import { ExpensePeriod, ExpenseSettings } from '../../domain/entities/Expense';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { getDatabase } from '../../data/Database';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatCurrency, MONTHS } from '../../utils/formatting';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  getSavedGroupCode,
  getSavedGroupName,
  savePeriodToCloud,
  getPeriodsFromCloud,
  deletePeriodFromCloud,
} from '../../services/SyncService';

type ExpensesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

const LOG_PREFIX = '[ExpensesScreen]';

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
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpensePeriod | null>(null);
  const [feedbackDialogVisible, setFeedbackDialogVisible] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{ title: string; message: string; variant: 'success' | 'info' } | null>(null);

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
    console.log(`${LOG_PREFIX} useEffect [] - ini`);
    initScreen();
    console.log(`${LOG_PREFIX} useEffect [] - fin`);
  }, []);

  const initScreen = async () => {
    console.log(`${LOG_PREFIX} initScreen - ini`);
    setIsLoading(true);
    const code = await getSavedGroupCode();
    console.log(`${LOG_PREFIX} initScreen - code: ${code}`);
    const name = await getSavedGroupName();
    console.log(`${LOG_PREFIX} initScreen - name: ${name}`);

    if (code) {
      console.log(`${LOG_PREFIX} initScreen - hay código, cargando desde cloud`);
      setGroupCode(code);
      setGroupName(name || 'Mi Grupo');

      const cloudPeriods = await getPeriodsFromCloud(code);
      console.log(`${LOG_PREFIX} initScreen - cloudPeriods: ${cloudPeriods.length}`);
      setPeriods(cloudPeriods);
      setIsLoading(false);
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

  const createNewPeriod = async () => {
    console.log(`${LOG_PREFIX} createNewPeriod - ini - month: ${selectedMonth + 1}, year: ${selectedYear}`);
    try {
      const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      console.log(`${LOG_PREFIX} createNewPeriod - monthStr: ${monthStr}`);

      const existing = periods.find(p => p.month === monthStr);
      if (existing) {
        console.log(`${LOG_PREFIX} createNewPeriod - ya existe`);
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
        setFeedbackData({
          title: 'Período creado',
          message: `Se creó ${MONTHS[selectedMonth]} ${selectedYear}.\n\nLas lecturas anteriores se copiaron automáticamente.`,
          variant: 'success',
        });
        setFeedbackDialogVisible(true);
      }
    } catch (error) {
      console.error('Error creating period:', error);
      setFeedbackData({ title: 'Error', message: 'No se pudo crear el período', variant: 'info' });
      setFeedbackDialogVisible(true);
    }
  };

  const deletePeriod = (period: ExpensePeriod) => {
    setDeleteTarget(period);
    setDeleteDialogVisible(true);
  };

  const confirmDeletePeriod = async () => {
    if (!deleteTarget) return;
    try {
      if (groupCode) {
        await deletePeriodFromCloud(groupCode, deleteTarget.id);
      }
      setPeriods(prev => prev.filter(p => p.id !== deleteTarget.id));
    } catch (error) {
      console.error('Error deleting period:', error);
    }
    setDeleteDialogVisible(false);
    setDeleteTarget(null);
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

  const getTotalElectricity = (period: ExpensePeriod) => {
    return period.floorsElectricity.reduce((sum, f) => sum + f.totalToPay, 0);
  };

  const getTotalWater = (period: ExpensePeriod) => {
    return period.floorsWater.reduce((sum, f) => sum + f.amount, 0);
  };

  const PeriodCard = React.memo<{ period: ExpensePeriod }>(({ period }) => (
    <TouchableOpacity
      style={styles.periodCard}
      onPress={() => navigation.navigate('ExpenseDetail', { periodId: period.id })}
      onLongPress={() => deletePeriod(period)}
      activeOpacity={0.7}
    >
      <View style={styles.periodCardContent}>
        <View style={styles.periodHeader}>
          <Text style={styles.periodMonth} numberOfLines={1}>{period.monthName} {period.year}</Text>
          <Text style={styles.periodTotal} numberOfLines={1}>
            {formatCurrency(getTotalElectricity(period) + getTotalWater(period))}
          </Text>
        </View>

        <View style={styles.periodDetails}>
          <View style={styles.periodDetail}>
            <View style={[styles.periodDetailIconContainer, styles.electricityIconBg]}>
              <Lightning size={16} color={colors.accent.orange} weight="fill" />
            </View>
            <View style={styles.periodDetailTextContainer}>
              <Text style={styles.periodDetailLabel}>Electricidad</Text>
              <Text style={styles.periodDetailValue} numberOfLines={1}>
                {period.floorsElectricity.length} pisos • {formatCurrency(getTotalElectricity(period))}
              </Text>
            </View>
          </View>

          <View style={styles.periodDetail}>
            <View style={[styles.periodDetailIconContainer, styles.waterIconBg]}>
              <Drop size={16} color={colors.accent.blue} weight="fill" />
            </View>
            <View style={styles.periodDetailTextContainer}>
              <Text style={styles.periodDetailLabel}>Agua</Text>
              <Text style={styles.periodDetailValue} numberOfLines={1}>
                {formatCurrency(getTotalWater(period))}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.periodFooter}>
          <Text style={styles.tapHint}>Toca para editar</Text>
          <View style={styles.tapHintDot} />
          <Text style={styles.tapHint}>Mantén para eliminar</Text>
        </View>
      </View>
    </TouchableOpacity>
  ));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary.dark} />
      <LinearGradient colors={[colors.primary.dark, colors.primary.main]} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleRow}>
              <House size={22} color={colors.common.white} weight="fill" />
              <View>
                <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
                <Text style={styles.headerSubtitle}>Luz y Agua</Text>
              </View>
            </View>
            {groupCode && (
              <TouchableOpacity style={styles.shareCodeButton} onPress={handleShareCode} activeOpacity={0.7}>
                <ShareIcon size={14} color={colors.common.white} weight="bold" />
                <Text style={styles.shareCodeText}>Compartir</Text>
              </TouchableOpacity>
            )}
          </View>

          {groupCode && (
            <View style={styles.codeBanner}>
              <Text style={styles.codeLabel}>Código:</Text>
              <Text style={styles.codeValue} numberOfLines={1}>{groupCode}</Text>
            </View>
          )}
        </SafeAreaView>
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
              activeOpacity={0.7}
            >
              <View style={styles.settingsIconContainer}>
                <GearSix size={20} color={colors.primary.main} weight="bold" />
              </View>
              <View style={styles.settingsText}>
                <Text style={styles.settingsTitle}>Configuración</Text>
                <Text style={styles.settingsSubtitle}>
                  {settings.floors.length} pisos • Tarifa: S/ {settings.electricityTariffPerKwh}/kWh
                </Text>
              </View>
              <CaretRight size={16} color={colors.textMuted} weight="bold" />
            </TouchableOpacity>
          </Animated.View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowNewPeriodModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.addButtonContent}>
            <Plus size={20} color={colors.common.white} weight="bold" />
            <Text style={styles.addButtonText}>Nuevo período</Text>
          </View>
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
            <View style={styles.emptyIconContainer}>
              <MagnifyingGlass size={40} color={colors.textMuted} weight="light" />
            </View>
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
                  activeOpacity={0.7}
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
                activeOpacity={0.7}
              >
                <Text style={styles.yearButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.yearText}>{selectedYear}</Text>
              <TouchableOpacity
                style={styles.yearButton}
                onPress={() => setSelectedYear(y => y + 1)}
                activeOpacity={0.7}
              >
                <Text style={styles.yearButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowNewPeriodModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={createNewPeriod}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleteDialogVisible}
        title="Eliminar período"
        message={deleteTarget ? `¿Eliminar ${deleteTarget.monthName} ${deleteTarget.year}? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        onConfirm={confirmDeletePeriod}
        onCancel={() => { setDeleteDialogVisible(false); setDeleteTarget(null); }}
      />

      <ConfirmDialog
        visible={feedbackDialogVisible}
        title={feedbackData?.title || ''}
        message={feedbackData?.message || ''}
        variant={feedbackData?.variant || 'success'}
        showCancel={false}
        confirmText="Aceptar"
        onConfirm={() => { setFeedbackDialogVisible(false); setFeedbackData(null); }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingBottom: spacing[16],
  },
  headerSafeArea: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[6],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  headerTitle: {
    ...typography.h3,
    color: colors.common.white,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.common.white,
    opacity: 0.85,
    marginTop: spacing[2],
  },
  shareCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: borderRadius.full,
    gap: spacing[6],
  },
  shareCodeText: {
    ...typography.buttonSmall,
    color: colors.common.white,
  },
  codeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[10],
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    gap: spacing[8],
  },
  codeLabel: {
    ...typography.caption,
    color: colors.common.white,
    opacity: 0.7,
  },
  codeValue: {
    ...typography.bodyMedium,
    color: colors.common.white,
    letterSpacing: 1,
    flexShrink: 1,
  },
  scrollView: {
    flex: 1,
  },
  settingsCard: {
    marginHorizontal: spacing[20],
    marginTop: spacing[16],
    marginBottom: spacing[12],
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[16],
    gap: spacing[12],
  },
  settingsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: {
    flex: 1,
  },
  settingsTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  settingsSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  addButton: {
    marginHorizontal: spacing[20],
    marginBottom: spacing[16],
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    ...shadows.primary,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
    gap: spacing[8],
  },
  addButtonText: {
    ...typography.button,
    color: colors.common.white,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[10],
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[10],
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[16],
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing[8],
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  periodsList: {
    paddingHorizontal: spacing[20],
    paddingBottom: spacing[8],
    gap: spacing[12],
  },
  periodCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    ...shadows.md,
  },
  periodCardContent: {
    padding: spacing[20],
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[16],
  },
  periodMonth: {
    ...typography.h4,
    color: colors.text,
  },
  periodTotal: {
    ...typography.currency,
    color: colors.primary.main,
  },
  periodDetails: {
    gap: spacing[12],
    marginBottom: spacing[16],
  },
  periodDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
  },
  periodDetailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  electricityIconBg: {
    backgroundColor: colors.warningLight,
  },
  waterIconBg: {
    backgroundColor: colors.infoLight,
  },
  periodDetailTextContainer: {
    flex: 1,
  },
  periodDetailLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  periodDetailValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing[1],
  },
  periodFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
    paddingTop: spacing[12],
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  tapHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  tapHintDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing[24],
    width: '85%',
    maxWidth: 340,
    ...shadows.xl,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[20],
  },
  modalLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing[8],
  },
  monthScroll: {
    marginBottom: spacing[16],
  },
  monthButton: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    marginRight: spacing[8],
  },
  monthButtonActive: {
    backgroundColor: colors.primary.main,
  },
  monthButtonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  monthButtonTextActive: {
    color: colors.common.white,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[20],
    marginBottom: spacing[24],
  },
  yearButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearButtonText: {
    ...typography.h3,
    color: colors.text,
  },
  yearText: {
    ...typography.h2,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing[12],
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing[14],
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: spacing[14],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
  },
  modalConfirmText: {
    ...typography.button,
    color: colors.common.white,
  },
});

export default ExpensesScreen;
