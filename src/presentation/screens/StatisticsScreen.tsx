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
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExpensePeriod } from '../../domain/entities/Expense';
import { FinancePeriod, FinanceDebt } from '../../domain/entities/Finance';
import { getDatabase } from '../../data/Database';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { SQLiteFinanceRepository } from '../../data/repositories/SQLiteFinanceRepository';
import { getSavedGroupCode, getPeriodsFromCloud } from '../../services/SyncService';
import { formatCurrency, MONTHS } from '../../utils/formatting';
import { TrendUp, TrendDown, Wallet, Warning, Lightning, Drop, House, CaretRight, Check } from 'phosphor-react-native';

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

const SCREEN_WIDTH = Dimensions.get('window').width;

const LOG_PREFIX = '[StatisticsScreen]';


const SimpleBarChart: React.FC<{
  labels: string[];
  years: number[];
  incomeData: number[];
  expenseData: number[];
}> = ({ labels, years, incomeData, expenseData }) => {
  const safeLabels = labels && labels.length > 0 ? labels : [''];
  const safeYears = years && years.length > 0 ? years : [0];
  const safeIncome = incomeData && incomeData.length > 0 ? incomeData : [0];
  const safeExpense = expenseData && expenseData.length > 0 ? expenseData : [0];
  
  const [pageIndex, setPageIndex] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.max(1, Math.ceil(safeLabels.length / itemsPerPage));
  const startIdx = pageIndex * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, safeLabels.length);
  
  const pageLabels = safeLabels.slice(startIdx, endIdx);
  const pageIncome = safeIncome.slice(startIdx, endIdx);
  const pageExpense = safeExpense.slice(startIdx, endIdx);
  const pageYears = safeYears.slice(startIdx, endIdx);
  
  const maxValue = Math.max(...pageIncome, ...pageExpense, 1);
  const chartHeight = 120;
  
  const totalIncome = safeIncome.reduce((a, b) => a + b, 0);
  const totalExpense = safeExpense.reduce((a, b) => a + b, 0);
  const netBalance = totalIncome - totalExpense;
  
  return (
    <View style={customChartStyles.container}>
      <View style={customChartStyles.barSummary}>
        <View style={customChartStyles.barSummaryItem}>
          <Text style={[customChartStyles.barSummaryLabel, { color: '#2196F3' }]}>Total Ingresos</Text>
          <Text style={[customChartStyles.barSummaryValue, { color: '#2196F3' }]}>{formatCurrency(totalIncome)}</Text>
        </View>
        <View style={customChartStyles.barSummaryItem}>
          <Text style={[customChartStyles.barSummaryLabel, { color: '#E53935' }]}>Total Gastos</Text>
          <Text style={[customChartStyles.barSummaryValue, { color: '#E53935' }]}>{formatCurrency(totalExpense)}</Text>
        </View>
        <View style={customChartStyles.barSummaryItem}>
          <Text style={[customChartStyles.barSummaryLabel, { color: netBalance >= 0 ? '#43A047' : '#FF9800' }]}>Balance</Text>
          <Text style={[customChartStyles.barSummaryValue, { color: netBalance >= 0 ? '#43A047' : '#FF9800' }]}>{formatCurrency(netBalance)}</Text>
        </View>
      </View>
      {totalPages > 1 && (
        <View style={customChartStyles.pageNav}>
          <TouchableOpacity 
            style={[customChartStyles.pageBtn, pageIndex === 0 && customChartStyles.pageBtnDisabled]}
            onPress={() => setPageIndex(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
          >
            <Text style={customChartStyles.pageBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={customChartStyles.pageIndicator}>{pageIndex + 1}/{totalPages}</Text>
          <TouchableOpacity 
            style={[customChartStyles.pageBtn, pageIndex >= totalPages - 1 && customChartStyles.pageBtnDisabled]}
            onPress={() => setPageIndex(Math.min(totalPages - 1, pageIndex + 1))}
            disabled={pageIndex >= totalPages - 1}
          >
            <Text style={customChartStyles.pageBtnText}>›</Text>
          </TouchableOpacity>
        </View>
)}
      <View style={customChartStyles.barHorizontalContainer}>
        {pageLabels.map((label, index) => (
          <View key={label + index} style={customChartStyles.barGroup}>
            <View style={customChartStyles.barsContainer}>
              <View style={[customChartStyles.barIncome, { height: Math.max((pageIncome[index] || 0) / maxValue * chartHeight, 4) }]} />
              <View style={[customChartStyles.barExpense, { height: Math.max((pageExpense[index] || 0) / maxValue * chartHeight, 4) }]} />
            </View>
            <View style={customChartStyles.barValuesRow}>
              <View style={customChartStyles.barValueItem}>
                <View style={[customChartStyles.barDot, { backgroundColor: '#2196F3' }]} />
                <Text style={customChartStyles.barValue}>{formatCurrency(pageIncome[index] || 0)}</Text>
              </View>
              <View style={customChartStyles.barValueItem}>
                <View style={[customChartStyles.barDot, { backgroundColor: '#E53935' }]} />
                <Text style={customChartStyles.barValue}>{formatCurrency(pageExpense[index] || 0)}</Text>
              </View>
            </View>
            <Text style={customChartStyles.barLabel}>{pageLabels[index]}</Text>
            <Text style={customChartStyles.barYear}>{pageYears[index]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const SimplePieChart: React.FC<{
  data: { name: string; amount: number; color: string }[];
}> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  if (total === 0) return null;
  
  return (
    <View style={customChartStyles.pieContainer}>
      {data.map((item, index) => (
        <View key={item.name} style={customChartStyles.pieRow}>
          <View style={[customChartStyles.pieDot, { backgroundColor: item.color }]} />
          <Text style={customChartStyles.pieLabel}>{item.name}</Text>
          <Text style={customChartStyles.pieValue}>{formatCurrency(item.amount)}</Text>
          <Text style={customChartStyles.piePercent}>{Math.round((item.amount / total) * 100)}%</Text>
        </View>
      ))}
    </View>
  );
};

const SimpleLineChart: React.FC<{
  labels: string[];
  years: number[];
  data: number[];
}> = ({ labels, years, data }) => {
  const [pageIndex, setPageIndex] = useState(0);
  const itemsPerPage = 6;
  const totalPages = Math.ceil(labels.length / itemsPerPage);
  const startIdx = pageIndex * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, labels.length);
  
  const pageLabels = labels.slice(startIdx, endIdx);
  const pageData = data.slice(startIdx, endIdx);
  const pageYears = years.slice(startIdx, endIdx);
  
  const isSingleMonth = data.length === 1;
  const value = data[0] || 0;
  const isPositive = value >= 0;
  
  if (isSingleMonth) {
    return (
      <View style={customChartStyles.lineContainer}>
        <View style={customChartStyles.lineSummary}>
          <Text style={[customChartStyles.lineSummaryText, { color: isPositive ? '#43A047' : '#E53935' }]}>
            Balance: {formatCurrency(value)} ({isPositive ? 'positivo' : 'negativo'})
          </Text>
        </View>
        <View style={customChartStyles.balanceBarContainer}>
          <View style={customChartStyles.balanceBarGroup}>
            <Text style={[customChartStyles.balanceBarValue, { color: isPositive ? '#43A047' : '#E53935' }]}>
              {formatCurrency(value)}
            </Text>
            <View style={customChartStyles.balanceBarWrapper}>
              <View 
                style={[
                  customChartStyles.balanceBar, 
                  { 
                    height: 100,
                    backgroundColor: isPositive ? '#43A047' : '#E53935',
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    borderBottomLeftRadius: isPositive ? 0 : 4,
                    borderBottomRightRadius: isPositive ? 0 : 4,
                    marginTop: isPositive ? 0 : undefined,
                    marginBottom: isPositive ? undefined : 0,
                  }
                ]} 
              />
            </View>
            <Text style={customChartStyles.balanceBarLabel}>{labels[0]}</Text>
            <Text style={customChartStyles.balanceBarYear}>{years[0]}</Text>
          </View>
        </View>
      </View>
    );
  }
  
  const maxValue = Math.max(...pageData.filter(v => v > 0), 1);
  const minValue = Math.min(...pageData.filter(v => v < 0), 0);
  const chartHeight = 120;
  
  const totalPositive = data.filter(v => v > 0).reduce((a, b) => a + b, 0);
  const totalNegative = Math.abs(data.filter(v => v < 0).reduce((a, b) => a + b, 0));
  const netTrend = totalPositive - totalNegative;
  
  return (
    <View style={customChartStyles.lineContainer}>
      <View style={customChartStyles.lineSummary}>
        <Text style={[customChartStyles.lineSummaryText, { color: netTrend >= 0 ? '#43A047' : '#E53935' }]}>
          Balance Total: {formatCurrency(netTrend)} ({netTrend >= 0 ? 'positivo' : 'negativo'})
        </Text>
      </View>
      {totalPages > 1 && (
        <View style={customChartStyles.pageNav}>
          <TouchableOpacity 
            style={[customChartStyles.pageBtn, pageIndex === 0 && customChartStyles.pageBtnDisabled]}
            onPress={() => setPageIndex(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
          >
            <Text style={customChartStyles.pageBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={customChartStyles.pageIndicator}>{pageIndex + 1}/{totalPages}</Text>
          <TouchableOpacity 
            style={[customChartStyles.pageBtn, pageIndex >= totalPages - 1 && customChartStyles.pageBtnDisabled]}
            onPress={() => setPageIndex(Math.min(totalPages - 1, pageIndex + 1))}
            disabled={pageIndex >= totalPages - 1}
          >
            <Text style={customChartStyles.pageBtnText}>›</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={customChartStyles.balanceBarContainer}>
        {pageData.map((val, index) => {
          const pos = val >= 0;
          const barHeight = pos 
            ? (val / maxValue) * chartHeight 
            : (Math.abs(val) / Math.abs(minValue)) * chartHeight;
          return (
            <View key={index} style={customChartStyles.balanceBarGroup}>
              <Text style={[customChartStyles.balanceBarValue, { color: pos ? '#43A047' : '#E53935' }]}>
                {formatCurrency(val)}
              </Text>
              <View style={customChartStyles.balanceBarWrapper}>
                <View 
                  style={[
                    customChartStyles.balanceBar, 
                    { 
                      height: Math.max(barHeight, 4),
                      backgroundColor: pos ? '#43A047' : '#E53935',
                      borderTopLeftRadius: pos ? 4 : 0,
                      borderTopRightRadius: pos ? 4 : 0,
                      borderBottomLeftRadius: pos ? 0 : 4,
                      borderBottomRightRadius: pos ? 0 : 4,
                      marginTop: pos ? 0 : undefined,
                      marginBottom: pos ? undefined : 0,
                    }
                  ]} 
                />
              </View>
              <Text style={customChartStyles.balanceBarLabel}>{pageLabels[index]}</Text>
              <Text style={customChartStyles.balanceBarYear}>{pageYears[index]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

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
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const [chartViewMode, setChartViewMode] = useState<'single' | 'all'>('single');
  
  const [chartData, setChartData] = useState<{
    monthlyLabels: string[];
    years: number[];
    incomeData: number[];
    expenseData: number[];
    categoryData: { name: string; amount: number; color: string; legendFontColor: string }[];
    trendData: number[];
  }>({
    monthlyLabels: [],
    years: [],
    incomeData: [],
    expenseData: [],
    categoryData: [],
    trendData: [],
  });
  
  useEffect(() => {
    setCurrentChartIndex(0);
    if (chartViewMode === 'all') {
      console.log('===== MODO TODOS LOS PERIODOS (chartViewMode) =====');
      console.log('monthlyLabels:', JSON.stringify(chartData.monthlyLabels));
      console.log('years:', JSON.stringify(chartData.years));
      console.log('incomeData:', JSON.stringify(chartData.incomeData));
      console.log('expenseData:', JSON.stringify(chartData.expenseData));
      console.log('trendData:', JSON.stringify(chartData.trendData));
      console.log('categoryData:', JSON.stringify(chartData.categoryData));
      const totalIncome = chartData.incomeData.reduce((a, b) => a + b, 0);
      const totalExpenses = chartData.expenseData.reduce((a, b) => a + b, 0);
      console.log('Total income (sum):', totalIncome);
      console.log('Total expenses (sum):', totalExpenses);
      console.log('Net balance:', totalIncome - totalExpenses);
      console.log('===== FIN MODO TODOS LOS PERIODOS =====');
    }
  }, [chartViewMode]);
  
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
    console.log('loadAllData called, timeRange:', timeRange, 'selectedMonth:', selectedMonth, 'selectedYear:', selectedYear);
    setCurrentChartIndex(0);
    await Promise.all([
      loadSummaryData(),
      loadExpenseData(),
    ]);
    
    const repo = new SQLiteFinanceRepository(getDatabase());
    const allPeriods = await repo.getAllPeriods();
    console.log('All periods count:', allPeriods.length);
    
    if (timeRange === 'month') {
      const sortedPeriods = [...allPeriods].sort((a, b) => {
        const monthA = parseInt(a.month.split('-')[1]);
        const monthB = parseInt(b.month.split('-')[1]);
        return monthB - monthA;
      });
      const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      console.log('Looking for month:', monthStr);
      const index = sortedPeriods.findIndex(p => p.year === selectedYear && parseInt(p.month.split('-')[1]) === selectedMonth + 1);
      console.log('Found index:', index);
      if (index >= 0) setCurrentChartIndex(index);
    } else {
      if (allPeriods.length > 0) {
        const newIndex = allPeriods.length - 1;
        console.log('Setting chart index to:', newIndex);
        setCurrentChartIndex(newIndex);
      }
    }
  };

  const loadSummaryData = async () => {
    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      const allPeriods = await repo.getAllPeriods();
      
      const sortedPeriods = [...allPeriods].sort((a, b) => {
        const yearA = a.year;
        const yearB = b.year;
        const monthA = parseInt(a.month.split('-')[1]);
        const monthB = parseInt(b.month.split('-')[1]);
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
      });
      
      let filteredPeriods = allPeriods;
      let chartPeriods = allPeriods;
      let monthLabel = '';
      
      if (timeRange === 'month') {
        const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        filteredPeriods = allPeriods.filter(p => p.month === monthStr);
        const targetIndex = sortedPeriods.findIndex(p => p.year === selectedYear && parseInt(p.month.split('-')[1]) === selectedMonth + 1);
        chartPeriods = targetIndex >= 0 ? sortedPeriods.slice(0, targetIndex + 1) : [];
        monthLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;
      } else {
        chartPeriods = sortedPeriods;
        filteredPeriods = sortedPeriods;
        monthLabel = 'Todos los períodos';
        
        console.log('======= TODOS LOS PERIODOS (timeRange=all) =======');
        console.log('Total periods from DB:', allPeriods.length);
        allPeriods.forEach((p, idx) => {
          const totalIncome = p.income.reduce((sum, i) => sum + i.amount, 0);
          const totalExpenses = p.expenses.reduce((sum, e) => sum + e.amount, 0);
          console.log(`Period[${idx}]: ${p.month} (${p.monthName}) - Income: ${totalIncome}, Expenses: ${totalExpenses}`);
          if (p.income.length > 0) {
            console.log('  Income items:', JSON.stringify(p.income.map(i => ({ source: i.source, amount: i.amount }))));
          }
          if (p.expenses.length > 0) {
            console.log('  Expense items:', JSON.stringify(p.expenses.map(e => ({ category: e.category, amount: e.amount }))));
          }
        });
        console.log('======= FIN TODOS LOS PERIODOS =======');
      }
      
      setFinancePeriods(filteredPeriods);
      setCurrentMonth(monthLabel);
      
      const monthlyLabels = chartPeriods.map(p => p.monthName.substring(0, 3));
      const years = chartPeriods.map(p => p.year);
      const incomeData = chartPeriods.map(p => p.income.reduce((sum, i) => sum + i.amount, 0));
      const expenseData = chartPeriods.map(p => p.expenses.reduce((sum, e) => sum + e.amount, 0));
      
      const categoryColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#00D09E', '#E53935'];
      const categoryMap = new Map<string, number>();
      
      filteredPeriods.forEach(period => {
        period.expenses.forEach(exp => {
          const current = categoryMap.get(exp.category) || 0;
          categoryMap.set(exp.category, current + exp.amount);
        });
      });
      
      const categoryData = Array.from(categoryMap.entries())
        .map(([name, amount], index) => ({
          name,
          amount,
          color: categoryColors[index % categoryColors.length],
          legendFontColor: '#666',
        }))
        .sort((a, b) => b.amount - a.amount);
      
      const trendData = filteredPeriods.map(p => {
        const income = p.income.reduce((sum, i) => sum + i.amount, 0);
        const expenses = p.expenses.reduce((sum, e) => sum + e.amount, 0);
        return income - expenses;
      });
      
      setChartData({
        monthlyLabels,
        years,
        incomeData,
        expenseData,
        categoryData,
        trendData,
      });

      let totalIncome = 0;
      let totalExpenses = 0;
      let totalSavings = 0;
      let totalDebts = 0;
      let paidDebts = 0;
      let incomeChange = 0;
      let expensesChange = 0;
      
      if (timeRange === 'all') {
        console.log('======= CALCULO DE DEUDAS EN MODO ALL =======');
        
        // Usar Map para evitar duplicación de deudas - usar el período más reciente
        const uniqueDebts = new Map<string, { monthlyPayment: number, remainingAmount: number, isPaid: boolean, periodIndex: number }>();
        
        filteredPeriods.forEach((p, periodIndex) => {
          totalIncome += p.income.reduce((sum, i) => sum + i.amount, 0);
          totalExpenses += p.expenses.reduce((sum, e) => sum + e.amount, 0);
          totalSavings += p.savings || 0;
          
          console.log(`Period ${p.month} ${p.year}: debts count = ${p.debts.length}`);
          p.debts.forEach(d => {
            const key = `${d.name}_${d.totalAmount}`;
            const existing = uniqueDebts.get(key);
            
            // Solo guardar la deuda del período más reciente (mayor periodIndex)
            if (!existing || periodIndex > existing.periodIndex) {
              uniqueDebts.set(key, {
                monthlyPayment: d.monthlyPayment,
                remainingAmount: d.remainingAmount,
                isPaid: d.isPaid,
                periodIndex: periodIndex
              });
            }
          });
        });
        
        console.log('Unique debts:', JSON.stringify(Array.from(uniqueDebts.entries()).map(([k, v]) => ({ key: k, remainingAmount: v.remainingAmount, isPaid: v.isPaid, periodIndex: v.periodIndex }))));
        
        uniqueDebts.forEach((d, key) => {
          console.log(`Debt ${key}: monthlyPayment=${d.monthlyPayment}, remainingAmount=${d.remainingAmount}, isPaid=${d.isPaid}, periodIndex=${d.periodIndex}`);
          if (!d.isPaid && d.remainingAmount > 0) {
            totalDebts += d.monthlyPayment;
          }
          if (d.isPaid) {
            paidDebts += d.monthlyPayment;
          }
        });
        
        console.log('totalDebts calculated:', totalDebts, 'paidDebts calculated:', paidDebts);
        console.log('======= FIN CALCULO DE DEUDAS =======');
      } else if (filteredPeriods.length > 0) {
        const current = filteredPeriods[0];
        const previous = filteredPeriods.length > 1 ? filteredPeriods[1] : null;

        totalIncome = current.income.reduce((sum, i) => sum + i.amount, 0);
        totalExpenses = current.expenses.reduce((sum, e) => sum + e.amount, 0);
        totalDebts = current.debts
          .filter(d => !d.isPaid && !d.paidThisMonth)
          .reduce((sum, d) => sum + d.monthlyPayment, 0);
        paidDebts = current.debts
          .filter(d => d.isPaid || d.paidThisMonth)
          .reduce((sum, d) => sum + d.monthlyPayment, 0);
        totalSavings = current.savings || 0;

        if (previous) {
          const prevIncome = previous.income.reduce((sum, i) => sum + i.amount, 0);
          const prevExpenses = previous.expenses.reduce((sum, e) => sum + e.amount, 0);
          const prevPaidDebts = previous.debts
            .filter(d => d.isPaid || d.paidThisMonth)
            .reduce((sum, d) => sum + d.monthlyPayment, 0);
          const prevTotalWithDebts = prevExpenses + prevPaidDebts;
          const currentTotalWithDebts = totalExpenses + totalDebts + paidDebts;
          
          if (prevIncome > 0) {
            incomeChange = ((totalIncome - prevIncome) / prevIncome) * 100;
          }
          if (prevTotalWithDebts > 0) {
            expensesChange = ((currentTotalWithDebts - prevTotalWithDebts) / prevTotalWithDebts) * 100;
          }
        }
      }
      
      const totalWithDebts = totalExpenses + totalDebts + paidDebts;

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
                : 'Intenta ahorrar al menos 20%'}
          </Text>
        </LinearGradient>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: '#E8F5E9' }]}>
            <TrendUp size={20} color="#43A047" weight="fill" />
          </View>
          <Text style={styles.kpiLabel}>Ingresos</Text>
          <Text style={[styles.kpiValue, { color: '#43A047' }]}>{formatCurrency(summaryStats.totalIncome)}</Text>
          {renderChangeIndicator(summaryStats.incomeChange)}
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: '#FFEBEE' }]}>
            <TrendDown size={20} color="#E53935" weight="fill" />
          </View>
          <Text style={styles.kpiLabel}>Gastos</Text>
          <Text style={[styles.kpiValue, { color: '#E53935' }]}>{formatCurrency(summaryStats.totalExpenses)}</Text>
          {renderChangeIndicator(summaryStats.expensesChange)}
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: '#E3F2FD' }]}>
            <Wallet size={20} color="#1565C0" weight="fill" />
          </View>
          <Text style={styles.kpiLabel}>Ahorros</Text>
          <Text style={[styles.kpiValue, { color: '#1565C0' }]}>{formatCurrency(summaryStats.totalSavings)}</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: '#FFF3E0' }]}>
            <Warning size={20} color="#FF9800" weight="fill" />
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

      {chartData.monthlyLabels.length > 0 && (
        <>
          <View style={styles.chartViewToggle}>
            <TouchableOpacity
              style={[styles.chartToggleBtn, chartViewMode === 'single' && styles.chartToggleBtnActive]}
              onPress={() => { setChartViewMode('single'); setCurrentChartIndex(0); }}
            >
              <Text style={[styles.chartToggleText, chartViewMode === 'single' && styles.chartToggleTextActive]}>
                Mes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chartToggleBtn, chartViewMode === 'all' && styles.chartToggleBtnActive]}
              onPress={() => setChartViewMode('all')}
            >
              <Text style={[styles.chartToggleText, chartViewMode === 'all' && styles.chartToggleTextActive]}>
                Comparar Todos
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
              <Text style={styles.chartTitle}>Ingresos vs Gastos</Text>
              {chartViewMode === 'single' && chartData.monthlyLabels.length > 1 && (
                <View style={styles.chartNav}>
                  <TouchableOpacity 
                    style={[styles.chartNavBtn, currentChartIndex === 0 && styles.chartNavBtnDisabled]}
                    onPress={() => setCurrentChartIndex(Math.max(0, currentChartIndex - 1))}
                    disabled={currentChartIndex === 0}
                  >
                    <Text style={styles.chartNavText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.chartNavMonth}>
                    {chartData.monthlyLabels.length > 0 ? chartData.monthlyLabels[Math.min(currentChartIndex, chartData.monthlyLabels.length - 1)] : ''} {chartData.years.length > 0 ? chartData.years[Math.min(currentChartIndex, chartData.years.length - 1)] : ''}
                  </Text>
                  <TouchableOpacity 
                    style={[styles.chartNavBtn, currentChartIndex >= chartData.monthlyLabels.length - 1 && styles.chartNavBtnDisabled]}
                    onPress={() => setCurrentChartIndex(Math.min(chartData.monthlyLabels.length - 1, currentChartIndex + 1))}
                    disabled={currentChartIndex >= chartData.monthlyLabels.length - 1}
                  >
                    <Text style={styles.chartNavText}>›</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {(() => {
              const safeIndex = chartData.monthlyLabels.length > 0 ? Math.min(currentChartIndex, chartData.monthlyLabels.length - 1) : 0;
              const chartLabels = chartViewMode === 'all' 
                ? chartData.monthlyLabels 
                : (chartData.monthlyLabels.length > 0 ? [chartData.monthlyLabels[safeIndex]] : ['']);
              const chartYears = chartViewMode === 'all'
                ? chartData.years
                : (chartData.years.length > 0 ? [chartData.years[safeIndex]] : [0]);
              const chartIncomeData = chartViewMode === 'all'
                ? chartData.incomeData
                : (chartData.incomeData.length > 0 ? [chartData.incomeData[safeIndex]] : [0]);
              const chartExpenseData = chartViewMode === 'all'
                ? chartData.expenseData
                : (chartData.expenseData.length > 0 ? [chartData.expenseData[safeIndex]] : [0]);
              return (
                <SimpleBarChart
                  labels={chartLabels}
                  years={chartYears}
                  incomeData={chartIncomeData}
                  expenseData={chartExpenseData}
                />
              );
            })()}
            <View style={styles.chartLegend}>
              {chartViewMode === 'single' ? (
                <>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
                    <Text style={styles.legendText}>Ingresos: {formatCurrency(chartData.incomeData.length > 0 ? chartData.incomeData[Math.min(currentChartIndex, chartData.incomeData.length - 1)] : 0)}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#E53935' }]} />
                    <Text style={styles.legendText}>Gastos: {formatCurrency(chartData.expenseData.length > 0 ? chartData.expenseData[Math.min(currentChartIndex, chartData.expenseData.length - 1)] : 0)}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
                    <Text style={styles.legendText}>Total Ingresos: {formatCurrency(chartData.incomeData.reduce((a, b) => a + b, 0))}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#E53935' }]} />
                    <Text style={styles.legendText}>Total Gastos: {formatCurrency(chartData.expenseData.reduce((a, b) => a + b, 0))}</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {chartData.categoryData.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Gastos por Categoría</Text>
              <SimplePieChart data={chartData.categoryData} />
            </View>
          )}

          {chartData.trendData.length > 1 && (
            <View style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <Text style={styles.chartTitle}>Tendencia de Balance</Text>
                {chartViewMode === 'single' && chartData.monthlyLabels.length > 1 && (
                  <View style={styles.chartNav}>
                    <TouchableOpacity 
                      style={[styles.chartNavBtn, currentChartIndex === 0 && styles.chartNavBtnDisabled]}
                      onPress={() => setCurrentChartIndex(Math.max(0, currentChartIndex - 1))}
                      disabled={currentChartIndex === 0}
                    >
                      <Text style={styles.chartNavText}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.chartNavMonth}>
                      {chartData.monthlyLabels.length > 0 ? chartData.monthlyLabels[Math.min(currentChartIndex, chartData.monthlyLabels.length - 1)] : ''} {chartData.years.length > 0 ? chartData.years[Math.min(currentChartIndex, chartData.years.length - 1)] : ''}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.chartNavBtn, currentChartIndex >= chartData.monthlyLabels.length - 1 && styles.chartNavBtnDisabled]}
                      onPress={() => setCurrentChartIndex(Math.min(chartData.monthlyLabels.length - 1, currentChartIndex + 1))}
                      disabled={currentChartIndex >= chartData.monthlyLabels.length - 1}
                    >
                      <Text style={styles.chartNavText}>›</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {(() => {
                const safeIndex2 = chartData.monthlyLabels.length > 0 ? Math.min(currentChartIndex, chartData.monthlyLabels.length - 1) : 0;
                const lineLabels = chartViewMode === 'all' 
                  ? chartData.monthlyLabels 
                  : (chartData.monthlyLabels.length > 0 ? [chartData.monthlyLabels[safeIndex2]] : ['']);
                const lineYears = chartViewMode === 'all'
                  ? chartData.years
                  : (chartData.years.length > 0 ? [chartData.years[safeIndex2]] : [0]);
                const lineData = chartViewMode === 'all'
                  ? chartData.trendData
                  : (chartData.trendData.length > 0 ? [chartData.trendData[safeIndex2]] : [0]);
                return (
                  <SimpleLineChart
                    labels={lineLabels}
                    years={lineYears}
                    data={lineData}
                  />
                );
              })()}
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderExpensesTab = () => (
    <View style={styles.expensesContainer}>
      <View style={styles.expenseCard}>
        <View style={styles.expenseHeader}>
          <View style={[styles.expenseIcon, { backgroundColor: '#FFF3E0' }]}>
            <Lightning size={20} color="#FF9800" weight="fill" />
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
              ? '✓ ¡Bien! Bajaste el consumo' 
              : 'Uso normal este mes'}
        </Text>
      </View>

      <View style={styles.expenseCard}>
        <View style={styles.expenseHeader}>
          <View style={[styles.expenseIcon, { backgroundColor: '#E3F2FD' }]}>
            <Drop size={20} color="#1565C0" weight="fill" />
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
              ? '✓ ¡Bien! Ahorraste agua' 
              : 'Uso normal este mes'}
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
    const current = financePeriods.length > 0 ? financePeriods[financePeriods.length - 1] : null;
    const isAllRange = timeRange === 'all';
    const periodLabel = isAllRange ? 'Todos los períodos' : (current ? `${current.monthName} ${current.year}` : '');
    
    if (!current && !isAllRange) {
      return (
        <View style={styles.emptyState}>
          <Wallet size={48} color={colors.textMuted} weight="light" />
          <Text style={styles.emptyTitle}>Sin datos financieros</Text>
          <Text style={styles.emptyText}>Registra tus finanzas para ver estadísticas</Text>
        </View>
      );
    }

    let totalIncome = 0, totalExpenses = 0, totalDebtRemaining = 0, totalDebtOriginal = 0, totalSavings = 0;
    let activeDebts: FinanceDebt[] = [];
    
    if (isAllRange) {
      console.log('======= ESTADO DE DEUDAS (isAllRange) =======');
      const debtMap = new Map<string, { debt: FinanceDebt; remaining: number; periodIndex: number }>();
      financePeriods.forEach((p, periodIndex) => {
        totalIncome += p.income.reduce((sum, i) => sum + i.amount, 0);
        totalExpenses += p.expenses.reduce((sum, e) => sum + e.amount, 0);
        totalSavings += p.savings || 0;
        p.debts.forEach(d => {
          const key = `${d.name}_${d.totalAmount}`;
          const existing = debtMap.get(key);
          
          // Usar la deuda del período más reciente (mayor periodIndex)
          if (!existing || periodIndex > existing.periodIndex) {
            debtMap.set(key, { debt: d, remaining: d.remainingAmount, periodIndex: periodIndex });
          }
        });
      });
      
      console.log('Debt map entries:', JSON.stringify(Array.from(debtMap.entries()).map(([k, v]) => ({ key: k, remaining: v.remaining, isPaid: v.debt.isPaid, periodIndex: v.periodIndex }))));
      
      // Calcular totalDebtRemaining y totalDebtOriginal solo con debts únicas del período más reciente
      let uniqueDebts: { debt: FinanceDebt; remaining: number }[] = [];
      debtMap.forEach((value) => {
        uniqueDebts.push({ debt: value.debt, remaining: value.remaining });
        // totalDebtOriginal siempre incluye el monto original (ya pagado o no)
        totalDebtOriginal += value.debt.totalAmount;
        // totalDebtRemaining solo incluye las deudas no pagadas
        if (!value.debt.isPaid) {
          totalDebtRemaining += value.debt.remainingAmount;
          
        }
      });
      
      console.log('totalDebtRemaining:', totalDebtRemaining, 'totalDebtOriginal:', totalDebtOriginal);
      console.log('======= FIN ESTADO DE DEUDAS =======');
      
      activeDebts = uniqueDebts
        .sort((a, b) => a.remaining - b.remaining)
        .map(v => v.debt);
    } else if (current) {
      totalIncome = current.income.reduce((sum, i) => sum + i.amount, 0);
      totalExpenses = current.expenses.reduce((sum, e) => sum + e.amount, 0);
      totalSavings = current.savings || 0;
      activeDebts = current.debts.filter(d => !d.isPaid && !d.paidThisMonth);
      totalDebtRemaining = current.debts.filter(d => !d.isPaid).reduce((sum, d) => sum + d.remainingAmount, 0);
      totalDebtOriginal = current.debts.filter(d => !d.isPaid).reduce((sum, d) => sum + d.totalAmount, 0);
    }
    
    const totalDebts = activeDebts.reduce((sum, d) => sum + d.monthlyPayment, 0);
    const totalPaid = totalDebtOriginal - totalDebtRemaining;
    const monthsRemaining = totalDebts > 0 ? Math.ceil(totalDebtRemaining / totalDebts) : 0;

    return (
      <View style={styles.financeContainer}>
        <View style={styles.financeHeader}>
          <Text style={styles.financeTitle}>{periodLabel}</Text>
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
              {formatCurrency(totalDebtRemaining)}
            </Text>
          </View>
          <View style={[styles.financeCard, { borderLeftColor: '#1565C0' }]}>
            <Text style={styles.financeCardLabel}>Ahorro</Text>
            <Text style={[styles.financeCardValue, { color: '#1565C0' }]}>
              {formatCurrency(totalSavings)}
            </Text>
          </View>
        </View>

        {totalDebtRemaining > 0 && (
          <View style={styles.debtSummaryCard}>
            <Text style={styles.debtSummaryTitle}>Resumen de Deudas</Text>
            <View style={styles.debtSummaryGrid}>
              <View style={styles.debtSummaryItem}>
                <Text style={styles.debtSummaryLabel}>Total Deuda</Text>
                <Text style={styles.debtSummaryValue}>{formatCurrency(totalDebtOriginal)}</Text>
              </View>
              <View style={styles.debtSummaryItem}>
                <Text style={styles.debtSummaryLabel}>Ya Pagado</Text>
                <Text style={[styles.debtSummaryValue, { color: '#43A047' }]}>{formatCurrency(totalPaid)}</Text>
              </View>
              <View style={styles.debtSummaryItem}>
                <Text style={styles.debtSummaryLabel}>Restante</Text>
                <Text style={[styles.debtSummaryValue, { color: '#FF9800' }]}>{formatCurrency(totalDebtRemaining)}</Text>
              </View>
              <View style={styles.debtSummaryItem}>
                <Text style={styles.debtSummaryLabel}>Cuota Mensual</Text>
                <Text style={[styles.debtSummaryValue, { color: '#1565C0' }]}>{formatCurrency(totalDebts)}</Text>
              </View>
            </View>
            <View style={styles.debtProgressContainer}>
              <View style={styles.debtProgressBar}>
                <View style={[styles.debtProgressFill, { width: `${(totalPaid / totalDebtOriginal) * 100}%` }]} />
              </View>
              <Text style={styles.debtProgressText}>
                {Math.round((totalPaid / totalDebtOriginal) * 100)}% pagado • {monthsRemaining} meses restantes
              </Text>
            </View>
          </View>
        )}

        {activeDebts.length > 0 && (
          <View style={styles.debtsCard}>
            <Text style={styles.debtsTitle}>Estado de Deudas ({activeDebts.length})</Text>
            {activeDebts.map((debt, index) => (
              <View key={debt.id || index} style={styles.debtRow}>
                <View style={styles.debtInfo}>
                  <Text style={styles.debtName}>{debt.name}</Text>
                  {debt.isPaid ? (
                    <Text style={[styles.debtRemaining, { color: '#43A047' }]}>
                      Total: {formatCurrency(debt.totalAmount)} • Pagado ✓
                    </Text>
                  ) : (
                    <Text style={styles.debtRemaining}>
                      {formatCurrency(debt.remainingAmount)} restante de {formatCurrency(debt.totalAmount)}
                    </Text>
                  )}
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

        {activeDebts.length === 0 && (isAllRange || (current && current.debts.length === 0)) && (
            <View style={styles.emptyDebts}>
              <Check size={32} color={colors.accent.green} weight="bold" />
              <Text style={styles.emptyDebtsText}>No tienes deudas registradas</Text>
            </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />
      <LinearGradient colors={['#1565C0', '#2196F3']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
           <Text style={styles.headerTitle}>Estadísticas</Text>
          <Text style={styles.headerSubtitle}>Resumen de tus finanzas</Text>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.tabContainer}>
        {[
          { key: 'summary', label: 'Resumen', Icon: House },
          { key: 'expenses', label: 'Luz/Agua', Icon: Lightning },
          { key: 'finance', label: 'Finanzas', Icon: Wallet },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <tab.Icon size={18} color={activeTab === tab.key ? '#FFFFFF' : colors.textMuted} weight="fill" />
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

const customChartStyles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    minHeight: 200,
  },
  barSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  barSummaryItem: {
    alignItems: 'center',
  },
  barSummaryLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  barSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  barGroup: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 2,
  },
  barValuesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  barValueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  barDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  barValue: {
    fontSize: 8,
    color: '#666',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 4,
  },
  barIncome: {
    width: 22,
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  barExpense: {
    width: 22,
    backgroundColor: '#E53935',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
  },
  barYear: {
    fontSize: 9,
    color: '#999',
  },
  barHorizontalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingVertical: 10,
  },
  pageNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
    gap: 12,
  },
  pageBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  pageIndicator: {
    fontSize: 12,
    color: '#666',
  },
  pieContainer: {
    gap: 8,
  },
  pieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  pieDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  pieLabel: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  pieValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  piePercent: {
    fontSize: 12,
    color: '#666',
    width: 40,
    textAlign: 'right',
  },
  lineContainer: {
    paddingVertical: 10,
  },
  lineSummary: {
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  lineSummaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  lineChartArea: {
    height: 100,
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  lineDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00D09E',
    borderWidth: 2,
    borderColor: '#fff',
  },
  lineValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  lineValue: {
    fontSize: 10,
    fontWeight: '500',
  },
  lineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  lineLabel: {
    fontSize: 10,
    color: '#666',
  },
  balanceBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 160,
    paddingVertical: 10,
  },
  balanceBarGroup: {
    alignItems: 'center',
    flex: 1,
  },
  balanceBarValue: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceBarWrapper: {
    height: 120,
    justifyContent: 'flex-end',
  },
  balanceBar: {
    width: 28,
  },
  balanceBarLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  balanceBarYear: {
    fontSize: 9,
    color: '#999',
  },
});

const styles = StyleSheet.create({
  container: {
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
  debtSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  debtSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  debtSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  debtSummaryItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 8,
  },
  debtSummaryLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  debtSummaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  debtProgressContainer: {
    marginTop: 8,
  },
  debtProgressBar: {
    height: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  debtProgressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  debtProgressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
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
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartNav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartNavBtnDisabled: {
    opacity: 0.4,
  },
  chartNavText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  chartNavMonth: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: 8,
    minWidth: 60,
    textAlign: 'center',
  },
  chartViewToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  chartToggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  chartToggleBtnActive: {
    backgroundColor: colors.primary.main,
  },
  chartToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  chartToggleTextActive: {
    color: '#fff',
  },
  chart: {
    borderRadius: 12,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 13,
    color: '#666',
  },
});

export default StatisticsScreen;
