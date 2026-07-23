import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Dimensions, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Wallet, Plus, CurrencyDollar, Trash, CaretRight } from 'phosphor-react-native';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { SQLiteFinanceRepository } from '../../data/repositories/SQLiteFinanceRepository';
import { getDatabase } from '../../data/Database';
import { FinancePeriod } from '../../domain/entities/Finance';
import { formatCurrency, MONTHS } from '../../utils/formatting';
import { ConfirmDialog } from '../components/ConfirmDialog';
const { width } = Dimensions.get('window');

const LOG_PREFIX = '[FinancesTabScreen]';

const FinancesTabScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [financePeriods, setFinancePeriods] = useState<FinancePeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showYearModal, setShowYearModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinancePeriod | null>(null);

  useEffect(() => {
    loadFinanceData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFinanceData();
    }, [])
  );

  const loadFinanceData = async () => {
    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      const periods = await repo.getAllPeriods();
      console.log('======= loadFinanceData =======');
      console.log('Total periods loaded:', periods.length);
      periods.forEach((p, idx) => {
        const totalIncome = p.income.reduce((sum, i) => sum + i.amount, 0);
        const totalExpenses = p.expenses.reduce((sum, e) => sum + e.amount, 0);
        console.log(`Period[${idx}]: ${p.month} ${p.year} - Income: ${totalIncome}, Expenses: ${totalExpenses}, Debts: ${p.debts.length}`);
      });
      console.log('======= FIN loadFinanceData =======');
      setFinancePeriods(periods);
    } catch (error) {
      console.error('Error loading finance data:', error);
    }
  };

  const deletePeriod = async (period: FinancePeriod) => {
    setDeleteTarget(period);
    setDeleteDialogVisible(true);
  };

  const confirmDeletePeriod = async () => {
    if (!deleteTarget) return;
    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      await repo.deletePeriod(deleteTarget.id);
      await loadFinanceData();
    } catch (error) {
      console.error('Error deleting period:', error);
      Alert.alert('Error', 'No se pudo eliminar el período');
    }
    setDeleteDialogVisible(false);
    setDeleteTarget(null);
  };

  const createPeriod = async (year: number, month: number) => {
    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      const exists = await repo.getPeriodByMonth(monthStr);
      if (exists) {
        Alert.alert('Error', 'Ya existe un período para este mes');
        return;
      }
      
      const newPeriod = await repo.createPeriod({
        month: monthStr,
        year: year,
        monthName: MONTHS[month],
        income: [],
        expenses: [],
        debts: [],
        savings: 0,
        notes: '',
      });
      
      console.log('======= createPeriod =======');
      console.log(`${LOG_PREFIX} Created new period: ${newPeriod.monthName} ${newPeriod.year}`);
      
      const allPeriods = await repo.getAllPeriods();
      console.log(`${LOG_PREFIX} Total periods now: ${allPeriods.length}`);
      
      const debtsToCopy: typeof newPeriod.debts = [];
      let debtsFromCount = 0;
      
      for (const period of allPeriods) {
        if (period.year > year || (period.year === year && parseInt(period.month.split('-')[1]) > month + 1)) {
          break;
        }
        
        for (const debt of period.debts) {
          if (!debt.isPaid && debt.remainingAmount > 0) {
            debtsFromCount++;
            const prevMonth = parseInt(period.month.split('-')[1]) - 1;
            const monthDiff = (year - period.year) * 12 + (month - prevMonth);
            
            if (monthDiff > 0 && monthDiff <= 60) {
              const alreadyCopied = debtsToCopy.some(d => d.name === debt.name && d.totalAmount === debt.totalAmount);
              if (!alreadyCopied) {
                const paidAmount = debt.monthlyPayment * (debt.paidThisMonth ? monthDiff - 1 : monthDiff);
                const adjustedRemaining = Math.max(0, debt.totalAmount - paidAmount);
                
                debtsToCopy.push({
                  ...debt,
                  id: `${debt.id}_${year}${month + 1}`,
                  remainingAmount: adjustedRemaining,
                  paidThisMonth: false,
                  isPaid: adjustedRemaining <= 0,
                });
              }
            }
          }
        }
      }
      
      console.log(`${LOG_PREFIX} Found ${debtsFromCount} unpaid debts in previous periods, copying ${debtsToCopy.length} to new month`);
      if (debtsToCopy.length > 0) {
        await repo.updatePeriod(newPeriod.id, { debts: debtsToCopy });
        debtsToCopy.forEach(d => console.log(`${LOG_PREFIX}   Copied debt: "${d.name}" - ${d.remainingAmount}`));
      }
      console.log(`======= FIN createPeriod =======`);
      
      await loadFinanceData();
      setShowMonthModal(false);
      setSelectedYear(year);
    } catch (error) {
      console.error('Error creating period:', error);
    }
  };

  const getTotals = (period: FinancePeriod) => {
    const totalIncome = period.income.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = period.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalDebts = period.debts.filter(d => !d.paidThisMonth).reduce((sum, d) => sum + d.monthlyPayment, 0);
    return {
      totalIncome,
      totalExpenses,
      totalDebts,
      total: totalIncome - totalExpenses - totalDebts
    };
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const filteredPeriods = financePeriods.filter(p => p.year === selectedYear);
  const sortedPeriods = [...filteredPeriods].sort((a, b) => {
    const monthA = parseInt(a.month.split('-')[1]);
    const monthB = parseInt(b.month.split('-')[1]);
    return monthB - monthA;
  });

  const PeriodCard = React.memo<{ period: FinancePeriod }>(({ period }) => {
    const { totalIncome, totalExpenses, totalDebts } = getTotals(period);
    const balance = totalIncome - totalExpenses - totalDebts;
    const isPositive = balance >= 0;
    
    return (
      <TouchableOpacity
        style={styles.periodCard}
        onPress={() => navigation.navigate('FinanceDetail', { periodId: period.id })}
        onLongPress={() => deletePeriod(period)}
        activeOpacity={0.7}
      >
        <View style={styles.periodCardContent}>
          <View style={styles.periodHeader}>
            <View style={styles.periodHeaderLeft}>
              <View style={styles.periodIconContainer}>
                <Wallet size={24} color={colors.primary.main} weight="fill" />
              </View>
              <View>
                <Text style={styles.periodMonth} numberOfLines={1}>{period.monthName}</Text>
                <Text style={styles.periodYear}>{period.year}</Text>
              </View>
            </View>
            <View style={styles.periodHeaderRight}>
              <Text style={[styles.periodBalance, isPositive ? styles.balancePositive : styles.balanceNegative]} numberOfLines={1}>
                {isPositive ? '+' : ''}{formatCurrency(balance)}
              </Text>
              <CaretRight size={16} color={colors.textMuted} weight="bold" />
            </View>
          </View>
          
          <View style={styles.periodDivider} />
          
          <View style={styles.periodDetails}>
            <View style={styles.periodDetail}>
              <View style={[styles.periodDetailDot, { backgroundColor: colors.accent.green }]} />
              <View style={styles.periodDetailContent}>
                <Text style={styles.periodDetailLabel}>Ingresos</Text>
                <Text style={styles.periodDetailValue} numberOfLines={1}>{formatCurrency(totalIncome)}</Text>
              </View>
              <Text style={styles.periodDetailCount}>{period.income.length}</Text>
            </View>
            
            <View style={styles.periodDetail}>
              <View style={[styles.periodDetailDot, { backgroundColor: colors.accent.red }]} />
              <View style={styles.periodDetailContent}>
                <Text style={styles.periodDetailLabel}>Gastos</Text>
                <Text style={styles.periodDetailValue} numberOfLines={1}>{formatCurrency(totalExpenses)}</Text>
              </View>
              <Text style={styles.periodDetailCount}>{period.expenses.length}</Text>
            </View>

            <View style={styles.periodDetail}>
              <View style={[styles.periodDetailDot, { backgroundColor: colors.accent.orange }]} />
              <View style={styles.periodDetailContent}>
                <Text style={styles.periodDetailLabel}>Deudas</Text>
                <Text style={styles.periodDetailValue} numberOfLines={1}>
                  {totalDebts > 0 ? formatCurrency(totalDebts) : 'Sin deudas'}
                </Text>
              </View>
              <Text style={styles.periodDetailCount}>
                {period.debts.filter(d => !d.paidThisMonth).length}
              </Text>
            </View>
          </View>

          <View style={styles.periodFooter}>
            <Text style={styles.tapHint}>Mantén presionado para eliminar</Text>
            <Trash size={14} color={colors.textMuted} weight="light" />
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary.dark} />
      <LinearGradient colors={[colors.primary.dark, colors.primary.main]} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerTop}>
            <Wallet size={24} color={colors.common.white} weight="fill" />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Finanzas</Text>
              <Text style={styles.headerSubtitle}>Ingresos, gastos y deudas</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.yearSelector}>
        <TouchableOpacity 
          style={[styles.yearButton, selectedYear <= currentYear - 4 && styles.yearButtonDisabled]} 
          onPress={() => setSelectedYear(Math.max(currentYear - 4, selectedYear - 1))}
          disabled={selectedYear <= currentYear - 4}
        >
          <CaretRight size={18} color={selectedYear <= currentYear - 4 ? colors.textMuted : colors.primary.main} weight="bold" style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        
        <View style={styles.yearBadge}>
          <Text style={styles.yearText}>{selectedYear}</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.yearButton, selectedYear >= currentYear && styles.yearButtonDisabled]}
          onPress={() => setSelectedYear(Math.min(currentYear, selectedYear + 1))}
          disabled={selectedYear >= currentYear}
        >
          <CaretRight size={18} color={selectedYear >= currentYear ? colors.textMuted : colors.primary.main} weight="bold" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowMonthModal(true)} activeOpacity={0.7}>
          <View style={styles.addButtonContent}>
            <View style={styles.addButtonIconContainer}>
              <Plus size={20} color={colors.common.white} weight="bold" />
            </View>
            <Text style={styles.addButtonText}>Nuevo período</Text>
          </View>
        </TouchableOpacity>

        {sortedPeriods.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Wallet size={48} color={colors.textMuted} weight="light" />
            </View>
            <Text style={styles.emptyTitle}>Sin registros en {selectedYear}</Text>
            <Text style={styles.emptyText}>Toca "Nuevo período" para comenzar a registrar</Text>
          </View>
        ) : (
          sortedPeriods.map((period) => (
            <PeriodCard key={period.id} period={period} />
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={showMonthModal} transparent animationType="fade" onRequestClose={() => setShowMonthModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <CurrencyDollar size={24} color={colors.primary.main} weight="bold" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Crear período</Text>
                <Text style={styles.modalSubtitle}>Selecciona el mes para {selectedYear}</Text>
              </View>
            </View>
            
            <ScrollView style={styles.monthScroll} showsVerticalScrollIndicator={false}>
              {MONTHS.map((monthName, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.monthButton}
                  onPress={() => createPeriod(selectedYear, index)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.monthButtonText}>{monthName}</Text>
                  <CaretRight size={16} color={colors.textMuted} weight="bold" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowMonthModal(false)} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ConfirmDialog
        visible={deleteDialogVisible}
        title="Eliminar período"
        message={deleteTarget ? `¿Estás seguro de eliminar ${deleteTarget.monthName} ${deleteTarget.year}? Se borrarán todos los ingresos, gastos y deudas registrados.` : ''}
        confirmText="Eliminar"
        onConfirm={confirmDeletePeriod}
        onCancel={() => { setDeleteDialogVisible(false); setDeleteTarget(null); }}
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
    alignItems: 'center',
    gap: spacing[10],
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.common.white,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.common.white,
    opacity: 0.85,
    marginTop: spacing[2],
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing[12],
    marginTop: -spacing[8],
    borderRadius: borderRadius.md,
    padding: spacing[2],
    ...shadows.md,
    gap: spacing[16],
  },
  yearButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearButtonDisabled: {
    opacity: 0.4,
  },
  yearBadge: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[8],
    borderRadius: borderRadius.full,
  },
  yearText: {
    ...typography.h3,
    color: colors.common.white,
  },
  scrollView: {
    flex: 1,
  },
  addButton: {
    marginHorizontal: spacing[20],
    marginBottom: spacing[16],
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    ...shadows.primary,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
    gap: spacing[8],
  },
  addButtonIconContainer: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    ...typography.button,
    color: colors.common.white,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[64],
    paddingHorizontal: spacing[8],
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[20],
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing[8],
    textAlign: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  periodCard: {
    marginHorizontal: spacing[20],
    marginBottom: spacing[12],
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
  },
  periodHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    flex: 1,
  },
  periodIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodMonth: {
    ...typography.h4,
    color: colors.text,
  },
  periodYear: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  periodHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  periodBalance: {
    ...typography.currency,
  },
  balancePositive: {
    color: colors.accent.green,
  },
  balanceNegative: {
    color: colors.accent.red,
  },
  periodDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing[16],
  },
  periodDetails: {
    gap: spacing[12],
  },
  periodDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  periodDetailDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  periodDetailContent: {
    flex: 1,
  },
  periodDetailLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  periodDetailValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    marginTop: 1,
  },
  periodDetailCount: {
    ...typography.caption,
    color: colors.textMuted,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  periodFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[16],
    paddingTop: spacing[12],
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing[4],
  },
  tapHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[24],
  },
  modalContent: {
    backgroundColor: colors.common.white,
    borderRadius: borderRadius.xl,
    padding: spacing[24],
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    marginBottom: spacing[20],
  },
  modalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  monthScroll: {
    maxHeight: 320,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[16],
    borderRadius: borderRadius.md,
    marginBottom: spacing[8],
    backgroundColor: colors.backgroundSecondary,
  },
  monthButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  modalCancelButton: {
    paddingVertical: spacing[14],
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    marginTop: spacing[12],
  },
  modalCancelText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  bottomSpacer: {
    height: spacing[24],
  },
});

export default FinancesTabScreen;
