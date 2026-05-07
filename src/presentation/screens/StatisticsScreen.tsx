import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { format, subDays, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { LinearGradient } from 'expo-linear-gradient';
import { ExpensePeriod } from '../../domain/entities/Expense';
import { FinancePeriod, FinanceDebt } from '../../domain/entities/Finance';
import { getDatabase } from '../../data/Database';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { SQLiteFinanceRepository } from '../../data/repositories/SQLiteFinanceRepository';
import { getSavedGroupCode, getPeriodsFromCloud } from '../../services/SyncService';

type TimeRange = 'month' | 'all';
type TabType = 'summary' | 'expenses' | 'finance';

interface SummaryStats {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  totalDebts: number;
  savingsRate: number;
  incomeChange: number;
  expensesChange: number;
}

interface ExpenseStats {
  totalLuz: number;
  totalAgua: number;
  luzChange: number;
  aguaChange: number;
}

type StatisticsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const SCREEN_WIDTH = Dimensions.get('window').width;

const StatisticsScreen: React.FC = () => {
  const navigation = useNavigation<StatisticsScreenNavigationProp>();
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalIncome: 0,
    totalExpenses: 0,
    totalSavings: 0,
    totalDebts: 0,
    savingsRate: 0,
    incomeChange: 0,
    expensesChange: 0,
  });
  
  const [expenseStats, setExpenseStats] = useState<ExpenseStats>({
    totalLuz: 0,
    totalAgua: 0,
    luzChange: 0,
    aguaChange: 0,
  });

  const [financePeriods, setFinancePeriods] = useState<FinancePeriod[]>([]);
  const [currentMonth, setCurrentMonth] = useState('');
  
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [timeRange, selectedMonth, selectedYear])
  );

  const loadAllData = async () => {
    await Promise.all([
      loadSummaryData(),
      loadExpenseData(),
    ]);
  };

  const loadSummaryData = async () => {
    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      const allPeriods = await repo.getAllPeriods();
      
      let filteredPeriods = allPeriods;
      let monthLabel = '';
      
      if (timeRange === 'month') {
        const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        filteredPeriods = allPeriods.filter(p => p.month === monthStr);
        monthLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;
      } else {
        filteredPeriods = allPeriods.slice(0, 5);
        monthLabel = 'Últimos 5 meses';
      }
      
      setFinancePeriods(filteredPeriods);
      setCurrentMonth(monthLabel);

      if (filteredPeriods.length > 0) {
        const current = filteredPeriods[0];
        const previous = filteredPeriods.length > 1 ? filteredPeriods[1] : null;

        const totalIncome = current.income.reduce((sum, i) => sum + i.amount, 0);
        
        const totalExpenses = current.expenses.reduce((sum, e) => sum + e.amount, 0);
        
        const totalDebts = current.debts
          .filter(d => !d.isPaid && !d.paidThisMonth)
          .reduce((sum, d) => sum + d.monthlyPayment, 0);
        
        const paidDebts = current.debts
          .filter(d => d.isPaid || d.paidThisMonth)
          .reduce((sum, d) => sum + d.monthlyPayment, 0);
        
        const totalWithDebts = totalExpenses + totalDebts + paidDebts;
        
        const totalSavings = current.savings || 0;

        let incomeChange = 0;
        let expensesChange = 0;

        if (previous) {
          const prevIncome = previous.income.reduce((sum, i) => sum + i.amount, 0);
          const prevExpenses = previous.expenses.reduce((sum, e) => sum + e.amount, 0);
          const prevPaidDebts = previous.debts
            .filter(d => d.isPaid || d.paidThisMonth)
            .reduce((sum, d) => sum + d.monthlyPayment, 0);
          const prevTotalWithDebts = prevExpenses + prevPaidDebts;
          
          if (prevIncome > 0) {
            incomeChange = ((totalIncome - prevIncome) / prevIncome) * 100;
          }
          if (prevTotalWithDebts > 0) {
            expensesChange = ((totalWithDebts - prevTotalWithDebts) / prevTotalWithDebts) * 100;
          }
        }

        const savingsRate = totalIncome > 0 
          ? Math.round(((totalIncome - totalWithDebts) / totalIncome) * 100) 
          : 0;

        setSummaryStats({
          totalIncome,
          totalExpenses: totalWithDebts,
          totalSavings,
          totalDebts,
          savingsRate,
          incomeChange,
          expensesChange,
        });
      }
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const loadExpenseData = async () => {
    try {
      const code = await getSavedGroupCode();
      let allPeriods: ExpensePeriod[] = [];
      
      if (code) {
        allPeriods = await getPeriodsFromCloud(code);
      } else {
        const repo = new SQLiteExpenseRepository(getDatabase());
        allPeriods = await repo.getAllPeriods();
      }

      let filteredPeriods = allPeriods;

      if (timeRange === 'month') {
        const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        filteredPeriods = allPeriods.filter(p => p.month === monthStr);
      } else {
        filteredPeriods = allPeriods.slice(0, 5);
      }

      if (filteredPeriods.length > 0) {
        const current = filteredPeriods[0];
        const previous = filteredPeriods.length > 1 ? filteredPeriods[1] : null;

        const totalLuz = current.electricity.totalReceipt;
        const totalAgua = current.water.totalReceipt;

        let luzChange = 0;
        let aguaChange = 0;

        if (previous) {
          const prevLuz = previous.electricity.totalReceipt;
          const prevAgua = previous.water.totalReceipt;
          
          if (prevLuz > 0) {
            luzChange = ((totalLuz - prevLuz) / prevLuz) * 100;
          }
          if (prevAgua > 0) {
            aguaChange = ((totalAgua - prevAgua) / prevAgua) * 100;
          }
        }

        setExpenseStats({
          totalLuz,
          totalAgua,
          luzChange,
          aguaChange,
        });
      }
    } catch (error) {
      console.error('Error loading expense data:', error);
    }
  };

  const formatCurrency = (amount: number) => `S/ ${amount.toFixed(2)}`;
  const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value)}%`;

  const renderCircularProgress = (percentage: number, size: number = 80) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = Math.min(100, Math.max(0, percentage));
    
    return (
      <View style={[styles.progressCircle, { width: size, height: size }]}>
        <View style={[styles.progressBackground, { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          borderWidth: strokeWidth,
        }]} />
        <View style={[styles.progressForeground, { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: percentage >= 100 ? '#4CAF50' : percentage >= 50 ? '#FF9800' : '#E53935',
          transform: [{ rotate: '-90deg' }],
        }]} />
        <View style={styles.progressContent}>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      </View>
    );
  };

  const renderChangeIndicator = (change: number) => {
    if (change === 0) return null;
    const isPositive = change > 0;
    return (
      <View style={[styles.changeBadge, isPositive ? styles.changeNegative : styles.changePositive]}>
        <Text style={[styles.changeText, isPositive ? styles.changeTextNegative : styles.changeTextPositive]}>
          {isPositive ? '↑' : '↓'} {Math.abs(Math.round(change))}%
        </Text>
      </View>
    );
  };

  const renderSummaryTab = () => (
    <View style={styles.summaryContainer}>
      <View style={styles.welcomeCard}>
        <LinearGradient
          colors={['#1565C0', '#2196F3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeGradient}
        >
          <Text style={styles.welcomeTitle}>Resumen de {currentMonth || 'este mes'}</Text>
          <Text style={styles.welcomeSubtitle}>Tu tasa de ahorro</Text>
          <View style={styles.savingsCircle}>
            <Text style={styles.savingsPercent}>{summaryStats.savingsRate}%</Text>
          </View>
          <Text style={styles.welcomeTip}>
            {summaryStats.savingsRate >= 20 
              ? '¡Excelente! Estás ahorrando bien 🎉' 
              : summaryStats.savingsRate >= 10 
                ? '¡Bien! Sigue así 💪' 
                : 'Intenta ahorrar al menos 20% 💡'}
          </Text>
        </LinearGradient>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: '#E8F5E9' }]}>
            <Text style={styles.kpiEmoji}>💰</Text>
          </View>
          <Text style={styles.kpiLabel}>Ingresos</Text>
          <Text style={[styles.kpiValue, { color: '#43A047' }]}>{formatCurrency(summaryStats.totalIncome)}</Text>
          {renderChangeIndicator(summaryStats.incomeChange)}
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: '#FFEBEE' }]}>
            <Text style={styles.kpiEmoji}>📤</Text>
          </View>
          <Text style={styles.kpiLabel}>Gastos</Text>
          <Text style={[styles.kpiValue, { color: '#E53935' }]}>{formatCurrency(summaryStats.totalExpenses)}</Text>
          {renderChangeIndicator(summaryStats.expensesChange)}
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: '#E3F2FD' }]}>
            <Text style={styles.kpiEmoji}>🏦</Text>
          </View>
          <Text style={styles.kpiLabel}>Ahorros</Text>
          <Text style={[styles.kpiValue, { color: '#1565C0' }]}>{formatCurrency(summaryStats.totalSavings)}</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: '#FFF3E0' }]}>
            <Text style={styles.kpiEmoji}>💳</Text>
          </View>
          <Text style={styles.kpiLabel}>Deudas</Text>
          <Text style={[styles.kpiValue, { color: '#FF9800' }]}>{formatCurrency(summaryStats.totalDebts)}</Text>
        </View>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceTitle}>Balance del mes</Text>
        <Text style={[
          styles.balanceValue,
          { color: summaryStats.totalIncome - summaryStats.totalExpenses >= 0 ? '#43A047' : '#E53935' }
        ]}>
          {formatCurrency(summaryStats.totalIncome - summaryStats.totalExpenses)}
        </Text>
        <Text style={styles.balanceSubtext}>
          {summaryStats.totalIncome - summaryStats.totalExpenses >= 0 
            ? 'Te sobra dinero este mes 🎊' 
            : 'Gastaste más de lo que ganaste ⚠️'}
        </Text>
      </View>
    </View>
  );

  const renderExpensesTab = () => (
    <View style={styles.expensesContainer}>
      <View style={styles.expenseCard}>
        <View style={styles.expenseHeader}>
          <View style={[styles.expenseIcon, { backgroundColor: '#FFF3E0' }]}>
            <Text style={styles.expenseEmoji}>⚡</Text>
          </View>
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseLabel}>Luz</Text>
            <Text style={styles.expenseValue}>{formatCurrency(expenseStats.totalLuz)}</Text>
          </View>
          {renderChangeIndicator(expenseStats.luzChange)}
        </View>
        <Text style={styles.expenseTip}>
          {expenseStats.luzChange > 10 
            ? '⚠️ Consumo alto. Apaga luces innecesarias' 
            : expenseStats.luzChange < 0 
              ? '✅ ¡Bien! Bajaste el consumo' 
              : '💡 Uso normal este mes'}
        </Text>
      </View>

      <View style={styles.expenseCard}>
        <View style={styles.expenseHeader}>
          <View style={[styles.expenseIcon, { backgroundColor: '#E3F2FD' }]}>
            <Text style={styles.expenseEmoji}>💧</Text>
          </View>
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseLabel}>Agua</Text>
            <Text style={styles.expenseValue}>{formatCurrency(expenseStats.totalAgua)}</Text>
          </View>
          {renderChangeIndicator(expenseStats.aguaChange)}
        </View>
        <Text style={styles.expenseTip}>
          {expenseStats.aguaChange > 10 
            ? '⚠️ Revisa llaves que goteen' 
            : expenseStats.aguaChange < 0 
              ? '✅ ¡Bien! Ahorraste agua' 
              : '💡 Uso normal este mes'}
        </Text>
      </View>

      <View style={styles.totalExpenseCard}>
        <Text style={styles.totalExpenseLabel}>Total Luz + Agua</Text>
        <Text style={styles.totalExpenseValue}>
          {formatCurrency(expenseStats.totalLuz + expenseStats.totalAgua)}
        </Text>
      </View>
    </View>
  );

  const renderFinanceTab = () => {
    const current = financePeriods.length > 0 ? financePeriods[0] : null;
    
    if (!current) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💰</Text>
          <Text style={styles.emptyTitle}>Sin datos financieros</Text>
          <Text style={styles.emptyText}>Registra tus finanzas para ver estadísticas</Text>
        </View>
      );
    }

    const totalIncome = current.income.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = current.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalDebts = current.debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
    const activeDebts = current.debts.filter(d => !d.isPaid);

    return (
      <View style={styles.financeContainer}>
        <View style={styles.financeHeader}>
          <Text style={styles.financeTitle}>{current.monthName} {current.year}</Text>
        </View>

        <View style={styles.financeGrid}>
          <View style={[styles.financeCard, { borderLeftColor: '#43A047' }]}>
            <Text style={styles.financeCardLabel}>Ingresos</Text>
            <Text style={[styles.financeCardValue, { color: '#43A047' }]}>
              {formatCurrency(totalIncome)}
            </Text>
          </View>
          <View style={[styles.financeCard, { borderLeftColor: '#E53935' }]}>
            <Text style={styles.financeCardLabel}>Gastos</Text>
            <Text style={[styles.financeCardValue, { color: '#E53935' }]}>
              {formatCurrency(totalExpenses)}
            </Text>
          </View>
          <View style={[styles.financeCard, { borderLeftColor: '#FF9800' }]}>
            <Text style={styles.financeCardLabel}>Deuda Total</Text>
            <Text style={[styles.financeCardValue, { color: '#FF9800' }]}>
              {formatCurrency(current.debts.reduce((sum, d) => sum + d.remainingAmount, 0))}
            </Text>
          </View>
          <View style={[styles.financeCard, { borderLeftColor: '#1565C0' }]}>
            <Text style={styles.financeCardLabel}>Ahorro</Text>
            <Text style={[styles.financeCardValue, { color: '#1565C0' }]}>
              {formatCurrency(current.savings || 0)}
            </Text>
          </View>
        </View>

        {activeDebts.length > 0 && (
          <View style={styles.debtsCard}>
            <Text style={styles.debtsTitle}>🏦 Estado de Deudas ({activeDebts.length})</Text>
            {current.debts.filter(d => !d.isPaid).map((debt, index) => (
              <View key={debt.id || index} style={styles.debtRow}>
                <View style={styles.debtInfo}>
                  <Text style={styles.debtName}>{debt.name}</Text>
                  <Text style={styles.debtRemaining}>
                    {formatCurrency(debt.remainingAmount)} restante
                  </Text>
                </View>
                <View style={[
                  styles.debtStatus,
                  debt.isPaid || debt.paidThisMonth ? styles.debtPaid : styles.debtPending
                ]}>
                  <Text style={[
                    styles.debtStatusText,
                    debt.isPaid || debt.paidThisMonth ? styles.debtPaidText : styles.debtPendingText
                  ]}>
                    {debt.isPaid || debt.paidThisMonth ? 'Pagado' : 'Pendiente'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeDebts.length === 0 && current.debts.length === 0 && (
          <View style={styles.emptyDebts}>
            <Text style={styles.emptyDebtsEmoji}>✅</Text>
            <Text style={styles.emptyDebtsText}>No tienes deudas registradas</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />
      <View style={styles.header}>
        <View style={styles.statusBarSpacer} />
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📊 Dashboard</Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        {[
          { key: 'summary', label: 'Resumen', icon: '🏠' },
          { key: 'expenses', label: 'Luz/Agua', icon: '💡' },
          { key: 'finance', label: 'Finanzas', icon: '💰' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.timeRangeContainer}>
        {(['month', 'all'] as TimeRange[]).map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeButton,
              timeRange === range && styles.timeRangeButtonActive
            ]}
            onPress={() => setTimeRange(range)}
          >
            <Text style={[
              styles.timeRangeText,
              timeRange === range && styles.timeRangeTextActive
            ]}>
              {range === 'month' ? 'Mes' : 'Todo'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {timeRange === 'month' && (
        <View style={styles.monthSelectorContainer}>
          <TouchableOpacity 
            style={styles.monthSelectorButton}
            onPress={() => {
              if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
          >
            <Text style={styles.monthSelectorArrow}>‹</Text>
          </TouchableOpacity>
          
          <View style={styles.monthSelectorDisplay}>
            <Text style={styles.monthSelectorText}>
              {MONTHS[selectedMonth]} {selectedYear}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.monthSelectorButton}
            onPress={() => {
              const now = new Date();
              if (selectedYear < now.getFullYear() || 
                (selectedYear === now.getFullYear() && selectedMonth < now.getMonth())) {
                if (selectedMonth === 11) {
                  setSelectedMonth(0);
                  setSelectedYear(selectedYear + 1);
                } else {
                  setSelectedMonth(selectedMonth + 1);
                }
              }
            }}
          >
            <Text style={styles.monthSelectorArrow}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
          {activeTab === 'summary' && renderSummaryTab()}
          {activeTab === 'expenses' && renderExpensesTab()}
          {activeTab === 'finance' && renderFinanceTab()}
        </Animated.View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.header.background,
    paddingTop: 8,
  },
  headerContent: {
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBarSpacer: {
    height: StatusBar.currentHeight || 0,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.header.text,
    marginLeft: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: colors.header.text,
    fontWeight: 'bold',
    marginTop: -2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary.main,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.common.white,
  },
  scrollView: {
    flex: 1,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 8,
    gap: 8,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: '#1565C0',
  },
  timeRangeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  timeRangeTextActive: {
    color: '#fff',
  },
  monthSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 16,
  },
  monthSelectorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },
  monthSelectorArrow: {
    fontSize: 22,
    color: '#1565C0',
    fontWeight: 'bold',
  },
  monthSelectorDisplay: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  monthSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  bottomSpacer: {
    height: 100,
  },

  summaryContainer: {
    gap: 16,
  },
  welcomeCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  welcomeGradient: {
    padding: 20,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  savingsCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  savingsPercent: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  welcomeTip: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiEmoji: {
    fontSize: 22,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  changeBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  changePositive: {
    backgroundColor: '#E8F5E9',
  },
  changeNegative: {
    backgroundColor: '#FFEBEE',
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  changeTextPositive: {
    color: '#43A047',
  },
  changeTextNegative: {
    color: '#E53935',
  },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  balanceTitle: {
    fontSize: 14,
    color: '#666',
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  balanceSubtext: {
    fontSize: 13,
    color: '#666',
  },

  mealsContainer: {
    gap: 16,
  },
  mealProgressCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  mealProgressGradient: {
    flexDirection: 'row',
    padding: 16,
  },
  mealProgressLeft: {
    flex: 1,
  },
  mealProgressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  mealProgressSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  mealProgressRight: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  mealProgressPercent: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  mealStatsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  mealStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  mealStatEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  mealStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  mealStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  tipCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
  },

  expensesContainer: {
    gap: 12,
  },
  expenseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseEmoji: {
    fontSize: 22,
  },
  expenseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  expenseLabel: {
    fontSize: 12,
    color: '#666',
  },
  expenseValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  expenseTip: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalExpenseCard: {
    backgroundColor: '#1565C0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  totalExpenseLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  totalExpenseValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },

  financeContainer: {
    gap: 16,
  },
  financeHeader: {
    alignItems: 'center',
  },
  financeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  financeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  financeCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
  },
  financeCardLabel: {
    fontSize: 12,
    color: '#666',
  },
  financeCardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  debtsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  debtsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  debtInfo: {
    flex: 1,
  },
  debtName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  debtRemaining: {
    fontSize: 12,
    color: '#666',
  },
  debtStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  debtPaid: {
    backgroundColor: '#E8F5E9',
  },
  debtPending: {
    backgroundColor: '#FFF3E0',
  },
  debtStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  debtPaidText: {
    color: '#43A047',
  },
  debtPendingText: {
    color: '#FF9800',
  },

  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  emptyDebts: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 16,
  },
  emptyDebtsEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyDebtsText: {
    fontSize: 14,
    color: '#43A047',
    fontWeight: '600',
  },
  progressCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBackground: {
    position: 'absolute',
    borderColor: '#e0e0e0',
  },
  progressForeground: {
    position: 'absolute',
  },
  progressContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default StatisticsScreen;
