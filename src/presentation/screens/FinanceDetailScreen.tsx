import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  Wallet,
  Plus,
  CurrencyDollar,
  TrendUp,
  TrendDown,
  Warning,
  Check,
  X,
  CaretRight,
  PencilSimple,
  Trash,
} from 'phosphor-react-native';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { SQLiteFinanceRepository } from '../../data/repositories/SQLiteFinanceRepository';
import { getDatabase } from '../../data/Database';
import { FinancePeriod, FinanceIncome, FinanceExpense, FinanceDebt } from '../../domain/entities/Finance';
import { formatCurrency, MONTHS } from '../../utils/formatting';
import { ConfirmDialog } from '../components/ConfirmDialog';

const INCOME_SOURCES = ['Salario', 'Freelance', 'Inversión', 'Bono', 'Comisiones', 'Pensión', 'Otro'];
const EXPENSE_CATEGORIES = ['Alquiler', 'Servicios', 'Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educación', 'Ropa', 'Otros'];
const DEBT_TYPES = ['Tarjeta de crédito', 'Préstamo personal', 'Hipoteca', 'Préstamo vehicular', 'Deuda familiar', 'Otro'];

type FinanceDetailRouteProp = RouteProp<{ FinanceDetail: { periodId: string } }, 'FinanceDetail'>;

const LOG_PREFIX = '[FinanceDetailScreen]';

export const FinanceDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<FinanceDetailRouteProp>();
  const { periodId } = route.params;
  
  const [period, setPeriod] = useState<FinancePeriod | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [addType, setAddType] = useState<'income' | 'expense' | 'debt'>('income');
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [debtMonths, setDebtMonths] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedDebtType, setSelectedDebtType] = useState<string>('');
  const [showDebtTypePicker, setShowDebtTypePicker] = useState(false);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [newSavings, setNewSavings] = useState('');
  const [selectedDebtIndex, setSelectedDebtIndex] = useState<number | null>(null);
  const [showDebtPayModal, setShowDebtPayModal] = useState(false);
  const [deleteItemDialogVisible, setDeleteItemDialogVisible] = useState(false);
  const [deleteItemData, setDeleteItemData] = useState<{ type: string; name: string; onConfirm: () => void } | null>(null);
  const [deleteSavingsDialogVisible, setDeleteSavingsDialogVisible] = useState(false);
  const [feedbackDialogVisible, setFeedbackDialogVisible] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{ title: string; message: string; variant: 'success' | 'info' | 'action'; confirmText?: string; onConfirm?: () => void } | null>(null);
  const [payDebtDialogVisible, setPayDebtDialogVisible] = useState(false);
  const [payDebtData, setPayDebtData] = useState<{ index: number; name: string; monthlyPayment: number; remainingAmount: number } | null>(null);

  useEffect(() => {
    console.log(`${LOG_PREFIX} useEffect - ini`);
    loadPeriod();
    console.log(`${LOG_PREFIX} useEffect - fin`);
  }, []);

  const loadPeriod = async () => {
    console.log(`${LOG_PREFIX} loadPeriod - ini - periodId: ${periodId}`);
    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      const p = await repo.getPeriodById(periodId);
      console.log(`${LOG_PREFIX} loadPeriod - found: ${!!p}`);
      if (p) {
        console.log(`${LOG_PREFIX} loadPeriod - period: ${p.month} ${p.year}`);
        console.log(`${LOG_PREFIX} loadPeriod - income: ${p.income.length} items`);
        console.log(`${LOG_PREFIX} loadPeriod - expenses: ${p.expenses.length} items`);
        console.log(`${LOG_PREFIX} loadPeriod - debts: ${p.debts.length} items`);
        console.log(`${LOG_PREFIX} loadPeriod - savings: ${p.savings}`);
        setPeriod(p);
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} loadPeriod - error:`, error);
    }
  };

  const handleAddItem = async () => {
    if (!newAmount || !period) return;
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Monto inválido');
      return;
    }

    if (addType === 'income' && !selectedSource) {
      Alert.alert('Error', 'Selecciona una fuente');
      return;
    }
    if (addType === 'expense' && !selectedCategory) {
      Alert.alert('Error', 'Selecciona una categoría');
      return;
    }

    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      if (addType === 'income') {
        await repo.updatePeriod(period.id, { income: [...period.income, { id: Date.now().toString(), source: selectedSource, amount }] });
        console.log('======= AGREGAR INGRESO =======');
        console.log('Added income - source:', selectedSource, 'amount:', amount);
        console.log('======= FIN AGREGAR INGRESO =======');
      } else if (addType === 'expense') {
        await repo.updatePeriod(period.id, { expenses: [...period.expenses, { id: Date.now().toString(), category: selectedCategory, subcategory: selectedCategory, amount, isFixed: false }] });
        console.log('======= AGREGAR GASTO =======');
        console.log('Added expense - category:', selectedCategory, 'amount:', amount);
        console.log('======= FIN AGREGAR GASTO =======');
      }

      setShowAddModal(false);
      setNewAmount('');
      setSelectedSource('');
      setSelectedCategory('');
      await loadPeriod();
      setFeedbackData({ title: 'Éxito', message: 'Agregado correctamente', variant: 'success' });
      setFeedbackDialogVisible(true);
    } catch (error) {
      setFeedbackData({ title: 'Error', message: 'No se pudo agregar', variant: 'info' });
      setFeedbackDialogVisible(true);
    }
  };

  const handleSaveSavings = async () => {
    if (!period) return;
    const amount = parseFloat(newSavings);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Monto inválido');
      return;
    }

    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      const currentSavings = period.savings || 0;
      await repo.updatePeriod(period.id, { savings: currentSavings + amount });
      
      console.log('======= GUARDAR AHORRO =======');
      console.log('Added savings - previous:', currentSavings, 'added:', amount, 'new total:', currentSavings + amount);
      console.log('======= FIN GUARDAR AHORRO =======');
      
      setShowSavingsModal(false);
      setNewSavings('');
      await loadPeriod();
      setFeedbackData({ title: 'Éxito', message: `Ahorro de ${formatCurrency(amount)} registrado`, variant: 'success' });
      setFeedbackDialogVisible(true);
    } catch (error) {
      setFeedbackData({ title: 'Error', message: 'No se pudo guardar el ahorro', variant: 'info' });
      setFeedbackDialogVisible(true);
    }
  };

  const handleAddDebt = async () => {
    if (!newAmount || !period) return;
    const amount = parseFloat(newAmount);
    const monthsInput = parseInt(debtMonths);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Monto inválido');
      return;
    }
    if (!debtMonths || isNaN(monthsInput) || monthsInput <= 0) {
      Alert.alert('Error', 'Ingresa los meses a pagar');
      return;
    }
    if (!selectedDebtType) {
      Alert.alert('Error', 'Selecciona un tipo de deuda');
      return;
    }

    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      const monthlyPayment = amount / monthsInput;
      
      const newDebt: FinanceDebt = {
        id: Date.now().toString(),
        name: selectedDebtType,
        totalAmount: amount,
        monthlyPayment,
        remainingAmount: amount,
        isPaid: false,
        paidThisMonth: false,
      };

      // Guardar la deuda en el período actual
      await repo.updatePeriod(period.id, { debts: [...period.debts, newDebt] });
      
      console.log('======= AGREGAR DEUDA =======');
      console.log(`${LOG_PREFIX} Debt created - name: "${newDebt.name}", amount: ${newDebt.totalAmount}, monthly: ${newDebt.monthlyPayment}, months: ${monthsInput}`);
      console.log(`${LOG_PREFIX} Current period: ${period.monthName} ${period.year}`);

      // Obtener todos los períodos y ordenarlos por fecha
      const allPeriods = await repo.getAllPeriods();
      const sortedPeriods = [...allPeriods].sort((a, b) => {
        const yearDiff = a.year - b.year;
        if (yearDiff !== 0) return yearDiff;
        const monthA = parseInt(a.month.split('-')[1]);
        const monthB = parseInt(b.month.split('-')[1]);
        return monthA - monthB;
      });
      
      const currentIndex = sortedPeriods.findIndex(p => p.id === period.id);
      
      console.log(`${LOG_PREFIX} Total periods: ${sortedPeriods.length}, currentIndex: ${currentIndex}`);
      
      // NO copiar a meses anteriores - la deuda solo existe desde el mes actual hacia adelante
      console.log(`${LOG_PREFIX} Skipping past months (debt starts from current month only)`);
      
      // Copiar a meses futuros que ya existen
      let futureCopies = 0;
      for (let i = 1; i <= monthsInput; i++) {
        if (currentIndex + i >= sortedPeriods.length) {
          console.log(`${LOG_PREFIX} Future period index ${currentIndex + i} doesn't exist yet - will propagate when created via createPeriod`);
          break;
        }
        
        const futurePeriod = sortedPeriods[currentIndex + i];
        console.log(`${LOG_PREFIX} Copying debt to future period: ${futurePeriod.monthName} ${futurePeriod.year}`);
        
        const futureDebt: FinanceDebt = {
          ...newDebt,
          id: `${newDebt.id}_${futurePeriod.year}_${futurePeriod.month}`,
          remainingAmount: amount,
          paidThisMonth: false,
          isPaid: false,
        };
        
        const existingDebt = futurePeriod.debts.find(d => d.name === selectedDebtType && d.totalAmount === amount);
        if (!existingDebt) {
          await repo.updatePeriod(futurePeriod.id, {
            debts: [...futurePeriod.debts, futureDebt]
          });
          futureCopies++;
        }
      }
      
      console.log(`${LOG_PREFIX} Debt copied to ${futureCopies} existing future periods`);
      console.log(`======= FIN AGREGAR DEUDA =======`);

      setShowDebtModal(false);
      setNewAmount('');
      setSelectedDebtType('');
      setDebtMonths('');
      await loadPeriod();
      setFeedbackData({ title: 'Éxito', message: `Deuda registrada por ${monthsInput} meses`, variant: 'success' });
      setFeedbackDialogVisible(true);
    } catch (error) {
      setFeedbackData({ title: 'Error', message: 'No se pudo agregar', variant: 'info' });
      setFeedbackDialogVisible(true);
    }
  };

  const handleDebtPayment = async (index: number) => {
    if (!period) return;
    const debt = period.debts[index];
    setPayDebtData({ index, name: debt.name, monthlyPayment: debt.monthlyPayment, remainingAmount: debt.remainingAmount });
    setPayDebtDialogVisible(true);
  };

  const confirmDebtPayment = async () => {
    if (!period || !payDebtData) return;
    const debt = period.debts[payDebtData.index];
    
    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      const updatedDebts = [...period.debts];
      const newRemaining = debt.remainingAmount - debt.monthlyPayment;
      
      updatedDebts[payDebtData.index] = {
        ...debt,
        paidThisMonth: true,
        remainingAmount: Math.max(0, newRemaining),
        isPaid: newRemaining <= 0,
      };
      
      await repo.updatePeriod(period.id, { debts: updatedDebts });
      
      const allPeriods = await repo.getAllPeriods();
      const debtName = debt.name;
      const debtTotalAmount = debt.totalAmount;
      const currentPeriodDate = new Date(period.year, parseInt(period.month.split('-')[1]) - 1);
      
      for (const otherPeriod of allPeriods) {
        if (otherPeriod.id === period.id) continue;
        const otherPeriodDate = new Date(otherPeriod.year, parseInt(otherPeriod.month.split('-')[1]) - 1);
        if (otherPeriodDate <= currentPeriodDate) continue;
        
        const otherDebtIndex = otherPeriod.debts.findIndex(d => d.name === debtName && d.totalAmount === debtTotalAmount);
        if (otherDebtIndex >= 0) {
          const otherDebt = otherPeriod.debts[otherDebtIndex];
          const otherNewRemaining = Math.max(0, otherDebt.remainingAmount - debt.monthlyPayment);
          const updatedOtherDebts = [...otherPeriod.debts];
          updatedOtherDebts[otherDebtIndex] = { ...otherDebt, remainingAmount: otherNewRemaining, isPaid: otherNewRemaining <= 0 };
          await repo.updatePeriod(otherPeriod.id, { debts: updatedOtherDebts });
        }
      }
      
      await loadPeriod();
      setPayDebtDialogVisible(false);
      setPayDebtData(null);
      
      if (newRemaining <= 0) {
        setFeedbackData({ title: '¡Felicidades!', message: 'Has pagado completamente esta deuda', variant: 'success' });
      } else {
        setFeedbackData({ title: 'Pago registrado', message: `Ahora debes ${formatCurrency(newRemaining)}`, variant: 'success' });
      }
      setFeedbackDialogVisible(true);
    } catch (error) {
      setPayDebtDialogVisible(false);
      setPayDebtData(null);
      setFeedbackData({ title: 'Error', message: 'No se pudo registrar el pago', variant: 'info' });
      setFeedbackDialogVisible(true);
    }
  };

  const handleDeleteItem = async (type: 'income' | 'expense' | 'debt', index: number) => {
    if (!period) return;
    
    let itemName = '';
    if (type === 'income') itemName = period.income[index]?.source || 'Ingreso';
    else if (type === 'expense') itemName = period.expenses[index]?.category || 'Gasto';
    else if (type === 'debt') itemName = period.debts[index]?.name || 'Deuda';
    
    const debtToDelete = type === 'debt' ? period.debts[index] : null;
    
    const handleDelete = async () => {
      try {
        const repo = new SQLiteFinanceRepository(getDatabase());
        if (type === 'income') {
          const newIncome = [...period.income];
          newIncome.splice(index, 1);
          await repo.updatePeriod(period.id, { income: newIncome });
        } else if (type === 'expense') {
          const newExpenses = [...period.expenses];
          newExpenses.splice(index, 1);
          await repo.updatePeriod(period.id, { expenses: newExpenses });
        } else if (type === 'debt') {
          const allPeriods = await repo.getAllPeriods();
          for (const p of allPeriods) {
            const newDebts = p.debts.filter(
              d => !(d.name === debtToDelete?.name && d.totalAmount === debtToDelete?.totalAmount)
            );
            await repo.updatePeriod(p.id, { debts: newDebts });
          }
        }
        await loadPeriod();
      } catch (error) {
        Alert.alert('Error', 'No se pudo eliminar');
      }
    };
    
    const title = type === 'debt' ? 'Eliminar deuda' : 'Eliminar registro';
    const message = type === 'debt'
      ? `¿Eliminar "${itemName}" de todos los meses?`
      : `¿Estás seguro de eliminar "${itemName}"?`;

    setDeleteItemData({ type, name: itemName, onConfirm: handleDelete });
    setDeleteItemDialogVisible(true);
  };

  const handleDeleteSavings = async () => {
    if (!period || totalSavings <= 0) return;
    setDeleteSavingsDialogVisible(true);
  };

  const confirmDeleteSavings = async () => {
    if (!period) return;
    try {
      const repo = new SQLiteFinanceRepository(getDatabase());
      await repo.updatePeriod(period.id, { savings: 0 });
      await loadPeriod();
    } catch (error) {
      Alert.alert('Error', 'No se pudieron eliminar los ahorros');
    }
    setDeleteSavingsDialogVisible(false);
  };

  if (!period) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.loadingContainer}>
          <Wallet size={32} color={colors.primary.main} weight="light" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </SafeAreaView>
      </View>
    );
  }

  const totalIncome = period.income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = period.expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDebts = period.debts.filter(d => !d.isPaid && !d.paidThisMonth).reduce((sum, d) => sum + d.monthlyPayment, 0);
  const totalDebtRemaining = period.debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const totalSavings = period.savings || 0;
  const balance = totalIncome - totalExpenses - totalDebts;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary.dark} />
      <LinearGradient colors={[colors.primary.dark, colors.primary.main]} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <CaretRight size={18} color={colors.common.white} weight="bold" style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
            <Wallet size={22} color={colors.common.white} weight="fill" />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>{period.monthName} {period.year}</Text>
              <Text style={styles.headerSubtitle}>Finanzas del período</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.contentContainer}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <View style={styles.summaryIconRow}>
                  <View style={[styles.summaryDot, { backgroundColor: colors.accent.green }]} />
                  <Text style={styles.summaryLabel}>Ingresos</Text>
                </View>
                <Text style={[styles.summaryValue, styles.incomeValue]} numberOfLines={1}>{formatCurrency(totalIncome)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <View style={styles.summaryIconRow}>
                  <View style={[styles.summaryDot, { backgroundColor: colors.accent.red }]} />
                  <Text style={styles.summaryLabel}>Gastos</Text>
                </View>
                <Text style={[styles.summaryValue, styles.expenseValue]} numberOfLines={1}>{formatCurrency(totalExpenses)}</Text>
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <View style={styles.summaryIconRow}>
                  <View style={[styles.summaryDot, { backgroundColor: balance >= 0 ? colors.accent.green : colors.accent.red }]} />
                  <Text style={styles.summaryLabel}>Balance</Text>
                </View>
                <Text style={[styles.summaryValue, balance >= 0 ? styles.incomeValue : styles.expenseValue]} numberOfLines={1}>
                  {formatCurrency(balance)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <View style={styles.summaryIconRow}>
                  <View style={[styles.summaryDot, { backgroundColor: colors.primary.main }]} />
                  <Text style={styles.summaryLabel}>Ahorros</Text>
                </View>
                <Text style={[styles.summaryValue, styles.savingsValue]} numberOfLines={1}>{formatCurrency(totalSavings)}</Text>
              </View>
            </View>
            {totalDebtRemaining > 0 && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.debtSummaryRow}>
                  <View style={styles.summaryIconRow}>
                    <Warning size={16} color={colors.warning} weight="fill" />
                    <Text style={styles.debtLabel}>Deuda pendiente</Text>
                  </View>
                  <Text style={[styles.summaryValue, styles.debtValue]} numberOfLines={1}>{formatCurrency(totalDebtRemaining)}</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Acciones rápidas</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.accent.greenLight }]}
                onPress={() => { setAddType('income'); setShowAddModal(true); }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: colors.accent.green }]}>
                  <TrendUp size={18} color={colors.common.white} weight="bold" />
                </View>
                <Text style={styles.actionBtnLabel}>Ingreso</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.accent.redLight }]}
                onPress={() => { setAddType('expense'); setShowAddModal(true); }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: colors.accent.red }]}>
                  <TrendDown size={18} color={colors.common.white} weight="bold" />
                </View>
                <Text style={styles.actionBtnLabel}>Gasto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.warningLight }]}
                onPress={() => setShowDebtModal(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: colors.warning }]}>
                  <Warning size={18} color={colors.common.white} weight="bold" />
                </View>
                <Text style={styles.actionBtnLabel}>Deuda</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary.light }]}
                onPress={() => setShowSavingsModal(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: colors.primary.main }]}>
                  <Wallet size={18} color={colors.common.white} weight="bold" />
                </View>
                <Text style={styles.actionBtnLabel}>Ahorro</Text>
              </TouchableOpacity>
            </View>
          </View>

          {period.income.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: colors.accent.greenLight }]}>
                    <TrendUp size={16} color={colors.accent.green} weight="fill" />
                  </View>
                  <Text style={styles.sectionTitle}>Ingresos</Text>
                </View>
                <Text style={styles.sectionCount}>{period.income.length}</Text>
              </View>
              {period.income.map((inc, i) => (
                <TouchableOpacity key={i} style={styles.item} onLongPress={() => handleDeleteItem('income', i)} activeOpacity={0.7}>
                  <View style={styles.itemLeft}>
                    <View style={[styles.itemDot, { backgroundColor: colors.accent.green }]} />
                    <Text style={styles.itemText}>{inc.source}</Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={[styles.itemValue, styles.incomeValue]}>{formatCurrency(inc.amount)}</Text>
                    <Trash size={14} color={colors.textMuted} weight="light" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {period.expenses.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: colors.accent.redLight }]}>
                    <TrendDown size={16} color={colors.accent.red} weight="fill" />
                  </View>
                  <Text style={styles.sectionTitle}>Gastos</Text>
                </View>
                <Text style={styles.sectionCount}>{period.expenses.length}</Text>
              </View>
              {period.expenses.map((exp, i) => (
                <TouchableOpacity key={i} style={styles.item} onLongPress={() => handleDeleteItem('expense', i)} activeOpacity={0.7}>
                  <View style={styles.itemLeft}>
                    <View style={[styles.itemDot, { backgroundColor: colors.accent.red }]} />
                    <Text style={styles.itemText}>{exp.subcategory}</Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={[styles.itemValue, styles.expenseValue]}>{formatCurrency(exp.amount)}</Text>
                    <Trash size={14} color={colors.textMuted} weight="light" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {period.debts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: colors.warningLight }]}>
                    <Warning size={16} color={colors.warning} weight="fill" />
                  </View>
                  <Text style={styles.sectionTitle}>Deudas</Text>
                </View>
                <Text style={styles.sectionCount}>{period.debts.length}</Text>
              </View>
              {period.debts.map((debt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.item}
                  onPress={() => !debt.paidThisMonth && handleDebtPayment(i)}
                  onLongPress={() => handleDeleteItem('debt', i)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <View style={[styles.itemDot, { backgroundColor: debt.paidThisMonth ? colors.accent.green : colors.warning }]} />
                    <View style={styles.itemContent}>
                      <Text style={styles.itemText}>{debt.name}</Text>
                      <Text style={styles.itemSubtext} numberOfLines={2}>
                        Cuota: {formatCurrency(debt.monthlyPayment)} · Restante: {formatCurrency(debt.remainingAmount)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.itemRight}>
                    {debt.paidThisMonth ? (
                      <View style={styles.paidBadge}>
                        <Check size={12} color={colors.accent.green} weight="bold" />
                        <Text style={styles.paidBadgeText}>Pagado</Text>
                      </View>
                    ) : (
                      <View style={styles.payBadge}>
                        <Text style={styles.payBadgeText}>Pagar</Text>
                        <CaretRight size={12} color={colors.primary.main} weight="bold" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {totalSavings > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIconContainer, { backgroundColor: colors.primary.light }]}>
                    <Wallet size={16} color={colors.primary.main} weight="fill" />
                  </View>
                  <Text style={styles.sectionTitle}>Ahorros</Text>
                </View>
                <Text style={styles.sectionCount}>1</Text>
              </View>
              <TouchableOpacity style={styles.item} onLongPress={() => handleDeleteSavings()} activeOpacity={0.7}>
                <View style={styles.itemLeft}>
                  <View style={[styles.itemDot, { backgroundColor: colors.primary.main }]} />
                  <Text style={styles.itemText}>Total Ahorrado</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={[styles.itemValue, styles.savingsValue]}>{formatCurrency(totalSavings)}</Text>
                  <Trash size={14} color={colors.textMuted} weight="light" />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {period.income.length === 0 && period.expenses.length === 0 && period.debts.length === 0 && totalSavings === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Wallet size={48} color={colors.textMuted} weight="light" />
              </View>
              <Text style={styles.emptyTitle}>Sin registros</Text>
              <Text style={styles.emptyText}>Agrega ingresos, gastos o deudas para comenzar</Text>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <Modal visible={showAddModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowAddModal(false); setSelectedSource(''); setSelectedCategory(''); setNewAmount(''); }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconContainer, { backgroundColor: addType === 'income' ? colors.accent.greenLight : colors.accent.redLight }]}>
                  {addType === 'income' ? (
                    <TrendUp size={24} color={colors.accent.green} weight="fill" />
                  ) : (
                    <TrendDown size={24} color={colors.accent.red} weight="fill" />
                  )}
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>Agregar {addType === 'income' ? 'Ingreso' : 'Gasto'}</Text>
                  <Text style={styles.modalSubtitle}>Registra un nuevo movimiento</Text>
                </View>
              </View>

              {addType === 'income' ? (
                <>
                  <TouchableOpacity style={styles.selectButton} onPress={() => setShowSourcePicker(true)} activeOpacity={0.7}>
                    <Text style={[styles.selectButtonText, !selectedSource && styles.selectButtonPlaceholder]}>
                      {selectedSource || 'Seleccionar fuente'}
                    </Text>
                    <CaretRight size={16} color={colors.textMuted} weight="bold" />
                  </TouchableOpacity>
                  <Modal visible={showSourcePicker} transparent animationType="fade">
                    <TouchableOpacity style={styles.pickerOverlay} onPress={() => setShowSourcePicker(false)} activeOpacity={1}>
                      <View style={styles.pickerContent}>
                        <Text style={styles.pickerTitle}>Seleccionar fuente</Text>
                        {INCOME_SOURCES.map((source) => (
                          <TouchableOpacity key={source} style={styles.pickerOption} onPress={() => { setSelectedSource(source); setShowSourcePicker(false); }} activeOpacity={0.7}>
                            <Text style={styles.pickerOptionText}>{source}</Text>
                            {selectedSource === source && <Check size={16} color={colors.primary.main} weight="bold" />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    </TouchableOpacity>
                  </Modal>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.selectButton} onPress={() => setShowCategoryPicker(true)} activeOpacity={0.7}>
                    <Text style={[styles.selectButtonText, !selectedCategory && styles.selectButtonPlaceholder]}>
                      {selectedCategory || 'Seleccionar categoría'}
                    </Text>
                    <CaretRight size={16} color={colors.textMuted} weight="bold" />
                  </TouchableOpacity>
                  <Modal visible={showCategoryPicker} transparent animationType="fade">
                    <TouchableOpacity style={styles.pickerOverlay} onPress={() => setShowCategoryPicker(false)} activeOpacity={1}>
                      <View style={styles.pickerContent}>
                        <Text style={styles.pickerTitle}>Seleccionar categoría</Text>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <TouchableOpacity key={cat} style={styles.pickerOption} onPress={() => { setSelectedCategory(cat); setShowCategoryPicker(false); }} activeOpacity={0.7}>
                            <Text style={styles.pickerOptionText}>{cat}</Text>
                            {selectedCategory === cat && <Check size={16} color={colors.primary.main} weight="bold" />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    </TouchableOpacity>
                  </Modal>
                </>
              )}

              <TextInput style={styles.input} placeholder="Monto (S/)" keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} placeholderTextColor={colors.input.placeholder} />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowAddModal(false); setSelectedSource(''); setSelectedCategory(''); setNewAmount(''); }} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={handleAddItem} activeOpacity={0.7}>
                  <Plus size={16} color={colors.common.white} weight="bold" />
                  <Text style={styles.modalConfirmText}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showDebtModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowDebtModal(false); setSelectedDebtType(''); setNewAmount(''); setDebtMonths(''); }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconContainer, { backgroundColor: colors.warningLight }]}>
                  <Warning size={24} color={colors.warning} weight="fill" />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>Agregar Deuda/Préstamo</Text>
                  <Text style={styles.modalSubtitle}>Registra una nueva deuda</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.selectButton} onPress={() => setShowDebtTypePicker(true)} activeOpacity={0.7}>
                <Text style={[styles.selectButtonText, !selectedDebtType && styles.selectButtonPlaceholder]}>
                  {selectedDebtType || 'Seleccionar tipo de deuda'}
                </Text>
                <CaretRight size={16} color={colors.textMuted} weight="bold" />
              </TouchableOpacity>
              <Modal visible={showDebtTypePicker} transparent animationType="fade">
                <TouchableOpacity style={styles.pickerOverlay} onPress={() => setShowDebtTypePicker(false)} activeOpacity={1}>
                  <View style={styles.pickerContent}>
                    <Text style={styles.pickerTitle}>Seleccionar tipo de deuda</Text>
                    {DEBT_TYPES.map((type) => (
                      <TouchableOpacity key={type} style={styles.pickerOption} onPress={() => { setSelectedDebtType(type); setShowDebtTypePicker(false); }} activeOpacity={0.7}>
                        <Text style={styles.pickerOptionText}>{type}</Text>
                        {selectedDebtType === type && <Check size={16} color={colors.primary.main} weight="bold" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              </Modal>

              <TextInput style={styles.input} placeholder="Monto total (S/)" keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} placeholderTextColor={colors.input.placeholder} />
              <TextInput style={styles.input} placeholder="Meses a pagar" keyboardType="numeric" value={debtMonths} onChangeText={setDebtMonths} placeholderTextColor={colors.input.placeholder} />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowDebtModal(false); setSelectedDebtType(''); setNewAmount(''); setDebtMonths(''); }} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={handleAddDebt} activeOpacity={0.7}>
                  <Plus size={16} color={colors.common.white} weight="bold" />
                  <Text style={styles.modalConfirmText}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showSavingsModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowSavingsModal(false); setNewSavings(''); }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconContainer, { backgroundColor: colors.primary.light }]}>
                  <Wallet size={24} color={colors.primary.main} weight="fill" />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>Registrar Ahorro</Text>
                  <Text style={styles.modalSubtitle}>Ahorros actuales: {formatCurrency(totalSavings)}</Text>
                </View>
              </View>

              <TextInput style={styles.input} placeholder="Monto a ahorrar (S/)" keyboardType="numeric" value={newSavings} onChangeText={setNewSavings} placeholderTextColor={colors.input.placeholder} />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowSavingsModal(false); setNewSavings(''); }} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={handleSaveSavings} activeOpacity={0.7}>
                  <Check size={16} color={colors.common.white} weight="bold" />
                  <Text style={styles.modalConfirmText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>

      <ConfirmDialog
        visible={deleteItemDialogVisible}
        title={deleteItemData?.type === 'debt' ? 'Eliminar deuda' : 'Eliminar registro'}
        message={deleteItemData?.type === 'debt'
          ? `¿Eliminar "${deleteItemData?.name}" de todos los meses?`
          : `¿Estás seguro de eliminar "${deleteItemData?.name}"?`}
        confirmText="Eliminar"
        onConfirm={() => { deleteItemData?.onConfirm(); setDeleteItemDialogVisible(false); setDeleteItemData(null); }}
        onCancel={() => { setDeleteItemDialogVisible(false); setDeleteItemData(null); }}
      />

      <ConfirmDialog
        visible={deleteSavingsDialogVisible}
        title="Eliminar ahorros"
        message={`¿Estás seguro de eliminar ${formatCurrency(totalSavings)} en ahorros?`}
        confirmText="Eliminar"
        onConfirm={confirmDeleteSavings}
        onCancel={() => setDeleteSavingsDialogVisible(false)}
      />

      <ConfirmDialog
        visible={payDebtDialogVisible}
        title={`Pagar cuota - ${payDebtData?.name || ''}`}
        message={payDebtData ? `¿Ya pagaste la cuota de ${formatCurrency(payDebtData.monthlyPayment)} este mes?\n\nTotal restante: ${formatCurrency(payDebtData.remainingAmount)}` : ''}
        variant="action"
        confirmText="Sí, pagué"
        cancelText="No"
        onConfirm={confirmDebtPayment}
        onCancel={() => { setPayDebtDialogVisible(false); setPayDebtData(null); }}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[12],
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingBottom: spacing[12],
  },
  headerSafeArea: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[6],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
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
  scrollView: {
    flex: 1,
  },
  summaryCard: {
    marginHorizontal: spacing[20],
    marginTop: spacing[16],
    marginBottom: spacing[12],
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing[20],
    ...shadows.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing[16],
  },
  summaryItem: {
    flex: 1,
  },
  summaryIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    marginBottom: spacing[4],
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  summaryLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.currency,
  },
  incomeValue: {
    color: colors.accent.green,
  },
  expenseValue: {
    color: colors.accent.red,
  },
  savingsValue: {
    color: colors.primary.main,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing[16],
  },
  debtSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  debtLabel: {
    ...typography.captionMedium,
    color: colors.warning,
    marginLeft: spacing[4],
  },
  debtValue: {
    color: colors.warning,
  },
  actionsCard: {
    marginHorizontal: spacing[20],
    marginBottom: spacing[16],
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing[20],
    ...shadows.sm,
  },
  actionsTitle: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[12],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
    borderRadius: borderRadius.lg,
    gap: spacing[6],
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnLabel: {
    ...typography.tabLabel,
    color: colors.text,
  },
  section: {
    marginHorizontal: spacing[20],
    marginBottom: spacing[16],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[10],
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  sectionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.label,
    color: colors.text,
  },
  sectionCount: {
    ...typography.caption,
    color: colors.textMuted,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing[14],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[6],
    ...shadows.sm,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing[10],
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  itemSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  itemValue: {
    ...typography.currencySmall,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.accent.greenLight,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.full,
  },
  paidBadgeText: {
    ...typography.captionMedium,
    color: colors.accent.green,
  },
  payBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.primary.light,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.full,
  },
  payBadgeText: {
    ...typography.captionMedium,
    color: colors.primary.main,
  },
  emptyState: {
    alignItems: 'center',
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
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
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
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    marginBottom: spacing[20],
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
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
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.input.background,
    borderRadius: borderRadius.md,
    padding: spacing[14],
    marginBottom: spacing[12],
  },
  selectButtonText: {
    ...typography.body,
    color: colors.text,
  },
  selectButtonPlaceholder: {
    color: colors.input.placeholder,
  },
  input: {
    backgroundColor: colors.input.background,
    borderRadius: borderRadius.md,
    padding: spacing[14],
    ...typography.body,
    color: colors.text,
    marginBottom: spacing[12],
  },
  modalBtns: {
    flexDirection: 'row',
    gap: spacing[10],
    marginTop: spacing[8],
  },
  modalCancel: {
    flex: 1,
    paddingVertical: spacing[14],
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  modalConfirm: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing[14],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
    ...shadows.primary,
  },
  modalConfirmText: {
    ...typography.button,
    color: colors.common.white,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[24],
  },
  pickerContent: {
    backgroundColor: colors.common.white,
    borderRadius: borderRadius.xl,
    padding: spacing[20],
    width: '100%',
    maxWidth: 320,
    maxHeight: '70%',
    ...shadows.xl,
  },
  pickerTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing[16],
    textAlign: 'center',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[14],
    borderRadius: borderRadius.md,
    marginBottom: spacing[4],
    backgroundColor: colors.backgroundSecondary,
  },
  pickerOptionText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  bottomSpacer: {
    height: spacing[24],
  },
});

export default FinanceDetailScreen;
