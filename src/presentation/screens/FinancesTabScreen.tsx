import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { SQLiteFinanceRepository } from '../../data/repositories/SQLiteFinanceRepository';
import { getDatabase } from '../../data/Database';
import { FinancePeriod } from '../../domain/entities/Finance';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const { width } = Dimensions.get('window');

const LOG_PREFIX = '[FinancesTabScreen]';

const FinancesTabScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [financePeriods, setFinancePeriods] = useState<FinancePeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showYearModal, setShowYearModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);

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
    Alert.alert(
      'Eliminar período',
      `¿Estás seguro de eliminar ${period.monthName} ${period.year}? Se borrarán todos los ingresos, gastos y deudas registrados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const repo = new SQLiteFinanceRepository(getDatabase());
              await repo.deletePeriod(period.id);
              await loadFinanceData();
            } catch (error) {
              console.error('Error deleting period:', error);
              Alert.alert('Error', 'No se pudo eliminar el período');
            }
          },
        },
      ]
    );
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
      console.log('Created new period:', newPeriod.month, newPeriod.year);
      console.log('======= FIN createPeriod =======');
      
      const allPeriods = await repo.getAllPeriods();
      
      const debtsToCopy: typeof newPeriod.debts = [];
      
      for (const period of allPeriods) {
        if (period.year > year || (period.year === year && parseInt(period.month.split('-')[1]) > month + 1)) {
          break;
        }
        
        for (const debt of period.debts) {
          if (!debt.isPaid && debt.remainingAmount > 0) {
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
      
      if (debtsToCopy.length > 0) {
        await repo.updatePeriod(newPeriod.id, { debts: debtsToCopy });
      }
      
      await loadFinanceData();
      setShowMonthModal(false);
      setSelectedYear(year);
    } catch (error) {
      console.error('Error creating period:', error);
    }
  };

  const formatCurrency = (amount: number) => `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getTotals = (period: FinancePeriod) => {
    const totalIncome = period.income.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = period.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalDebts = period.debts.filter(d => !d.paidThisMonth).reduce((sum, d) => sum + d.monthlyPayment, 0);
    return {
      totalIncome,
      totalExpenses,
      totalDebts,
      total: totalIncome - totalExpenses
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

  const PeriodCard: React.FC<{ period: FinancePeriod }> = ({ period }) => {
    const { totalIncome, totalExpenses, totalDebts } = getTotals(period);
    
    return (
      <TouchableOpacity
        style={styles.periodCard}
        onPress={() => navigation.navigate('FinanceDetail', { periodId: period.id })}
        onLongPress={() => deletePeriod(period)}
      >
        <LinearGradient colors={['#ffffff', '#f8f9fa']} style={styles.periodCardGradient}>
          <View style={styles.periodHeader}>
            <Text style={styles.periodMonth}>{period.monthName} {period.year}</Text>
            <Text style={styles.periodTotal}>
              {formatCurrency(totalIncome - totalExpenses)}
            </Text>
          </View>
          
          <View style={styles.periodDetails}>
            <View style={styles.periodDetail}>
              <Text style={styles.periodDetailIcon}>💵</Text>
              <View>
                <Text style={styles.periodDetailLabel}>Ingresos</Text>
                <Text style={styles.periodDetailValue}>
                  {period.income.length} registros • {formatCurrency(totalIncome)}
                </Text>
              </View>
            </View>
            
            <View style={styles.periodDetail}>
              <Text style={styles.periodDetailIcon}>📝</Text>
              <View>
                <Text style={styles.periodDetailLabel}>Gastos</Text>
                <Text style={styles.periodDetailValue}>
                  {formatCurrency(totalExpenses)}
                </Text>
              </View>
            </View>

            <View style={styles.periodDetail}>
              <Text style={styles.periodDetailIcon}>🏦</Text>
              <View>
                <Text style={styles.periodDetailLabel}>Deudas</Text>
                <Text style={styles.periodDetailValue}>
                  {totalDebts > 0 ? formatCurrency(totalDebts) : 'Sin deudas'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.tapHint}>Toca para editar • Mantén presionado para eliminar</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1565C0', '#2196F3']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>💰 Finanzas</Text>
            <Text style={styles.headerSubtitle}>Ingresos, Gastos y Deudas</Text>
          </View>
        </View>
        
        <View style={styles.yearSelector}>
          <TouchableOpacity 
            style={styles.yearButton} 
            onPress={() => setSelectedYear(Math.max(currentYear - 4, selectedYear - 1))}
            disabled={selectedYear <= currentYear - 4}
          >
            <Text style={[styles.yearButtonText, selectedYear <= currentYear - 4 && styles.yearButtonDisabled]}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.yearText}>{selectedYear}</Text>
          <TouchableOpacity 
            style={styles.yearButton}
            onPress={() => setSelectedYear(Math.min(currentYear, selectedYear + 1))}
            disabled={selectedYear >= currentYear}
          >
            <Text style={[styles.yearButtonText, selectedYear >= currentYear && styles.yearButtonDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowMonthModal(true)}>
          <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.addButtonGradient}>
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Nuevo período</Text>
          </LinearGradient>
        </TouchableOpacity>

        {sortedPeriods.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyTitle}>Sin registros en {selectedYear}</Text>
            <Text style={styles.emptyText}>Toca "Nuevo período" para comenzar a registrar</Text>
          </View>
        ) : (
          sortedPeriods.map((period) => (
            <PeriodCard key={period.id} period={period} />
          ))
        )}
      </ScrollView>

      <Modal visible={showMonthModal} transparent animationType="fade" onRequestClose={() => setShowMonthModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear nuevo período</Text>
            <Text style={styles.modalSubtitle}>Selecciona el mes</Text>
            
            <ScrollView style={styles.monthScroll} showsVerticalScrollIndicator={false}>
              {MONTHS.map((monthName, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.monthButton}
                  onPress={() => createPeriod(selectedYear, index)}
                >
                  <Text style={styles.monthButtonText}>{monthName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowMonthModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.common.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.common.white,
    opacity: 0.9,
    marginTop: 2,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 20,
  },
  yearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearButtonText: {
    fontSize: 24,
    color: colors.common.white,
    fontWeight: 'bold',
  },
  yearButtonDisabled: {
    opacity: 0.3,
  },
  yearText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.common.white,
  },
  scrollView: {
    flex: 1,
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
    color: colors.common.white,
    fontWeight: 'bold',
  },
  addButtonText: {
    fontSize: 16,
    color: colors.common.white,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
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
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  periodCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  periodCardGradient: {
    padding: 20,
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  periodMonth: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  periodTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary.main,
  },
  periodDetails: {
    gap: 14,
    marginBottom: 8,
  },
  periodDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodDetailIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  periodDetailLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  periodDetailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 11,
    color: colors.textMuted,
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
    backgroundColor: colors.common.white,
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
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  monthScroll: {
    maxHeight: 300,
  },
  monthButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  monthButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
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
});

export default FinancesTabScreen;