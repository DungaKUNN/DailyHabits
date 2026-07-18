import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, FlatList, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { SQLiteFinanceRepository } from '../../data/repositories/SQLiteFinanceRepository';
import { getDatabase } from '../../data/Database';
import { FinancePeriod, FinanceIncome, FinanceExpense, FinanceDebt } from '../../domain/entities/Finance';
import { formatCurrency, MONTHS } from '../../utils/formatting';

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
      Alert.alert('Éxito', 'Agregado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar');
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
      Alert.alert('Éxito', `Ahorro de S/ ${amount.toFixed(2)} registrado`);
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el ahorro');
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
      Alert.alert('Éxito', `Deuda registrada por ${monthsInput} meses`);
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar');
    }
  };

  const handleDebtPayment = async (index: number) => {
    if (!period) return;
    const debt = period.debts[index];
    
    Alert.alert(
      `Pagar cuota - ${debt.name}`,
      `¿Ya pagaste la cuota de S/ ${debt.monthlyPayment.toFixed(2)} este mes?\n\nTotal restante: S/ ${debt.remainingAmount.toFixed(2)}`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, pagué',
          onPress: async () => {
            try {
              const repo = new SQLiteFinanceRepository(getDatabase());
              const updatedDebts = [...period.debts];
              const newRemaining = debt.remainingAmount - debt.monthlyPayment;
              
              updatedDebts[index] = {
                ...debt,
                paidThisMonth: true,
                remainingAmount: Math.max(0, newRemaining),
                isPaid: newRemaining <= 0,
              };
              
              await repo.updatePeriod(period.id, { debts: updatedDebts });
              console.log('======= PAGAR DEUDA =======');
              console.log(`${LOG_PREFIX} Debt paid in ${period.monthName} ${period.year}: name="${debt.name}", paidAmount=${debt.monthlyPayment}, remaining=${Math.max(0, newRemaining)}, isFullyPaid=${newRemaining <= 0}`);
              
              // Sincronizar el pago con otros períodos que tengan la misma deuda
              const allPeriods = await repo.getAllPeriods();
              const debtName = debt.name;
              const debtTotalAmount = debt.totalAmount;
              
              // Solo actualizar períodos futuros (posteriores al actual)
              const currentPeriodDate = new Date(period.year, parseInt(period.month.split('-')[1]) - 1);
              
              console.log(`${LOG_PREFIX} Syncing payment to future periods...`);
              let syncCount = 0;
              for (const otherPeriod of allPeriods) {
                if (otherPeriod.id === period.id) continue;
                
                const otherPeriodDate = new Date(otherPeriod.year, parseInt(otherPeriod.month.split('-')[1]) - 1);
                if (otherPeriodDate <= currentPeriodDate) {
                  console.log(`${LOG_PREFIX}   Skipping ${otherPeriod.monthName} ${otherPeriod.year} (past period)`);
                  continue;
                }
                
                const otherDebtIndex = otherPeriod.debts.findIndex(d => 
                  d.name === debtName && d.totalAmount === debtTotalAmount
                );
                
                if (otherDebtIndex >= 0) {
                  const otherDebt = otherPeriod.debts[otherDebtIndex];
                  const otherNewRemaining = Math.max(0, otherDebt.remainingAmount - debt.monthlyPayment);
                  
                  const updatedOtherDebts = [...otherPeriod.debts];
                  updatedOtherDebts[otherDebtIndex] = {
                    ...otherDebt,
                    remainingAmount: otherNewRemaining,
                    isPaid: otherNewRemaining <= 0,
                  };
                  
                  await repo.updatePeriod(otherPeriod.id, { debts: updatedOtherDebts });
                  console.log(`${LOG_PREFIX}   Synced ${otherPeriod.monthName} ${otherPeriod.year}: remainingAmount ${otherDebt.remainingAmount} -> ${otherNewRemaining}`);
                  syncCount++;
                } else {
                  console.log(`${LOG_PREFIX}   ${otherPeriod.monthName} ${otherPeriod.year}: debt not found (may not exist yet)`);
                }
              }
              console.log(`${LOG_PREFIX} Payment synced to ${syncCount} future periods`);
              console.log('======= FIN PAGAR DEUDA =======');
              await loadPeriod();
              
              if (newRemaining <= 0) {
                Alert.alert('¡Felicidades!', 'Has pagado completamente esta deuda 🎉');
              } else {
                Alert.alert('Pago registrado', `Ahora debes S/ ${newRemaining.toFixed(2)}`);
              }
            } catch (error) {
              Alert.alert('Error', 'No se pudo registrar el pago');
            }
          },
        },
      ]
    );
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
    
    if (type === 'debt') {
      Alert.alert(
        'Eliminar deuda',
        `¿Eliminar "${itemName}" de todos los meses?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: handleDelete },
        ]
      );
    } else {
      Alert.alert(
        'Eliminar registro',
        `¿Estás seguro de eliminar "${itemName}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: handleDelete },
        ]
      );
    }
  };

  const handleDeleteSavings = async () => {
    if (!period || totalSavings <= 0) return;
    
    Alert.alert(
      'Eliminar ahorros',
      `¿Estás seguro de eliminar S/ ${totalSavings.toFixed(2)} en ahorros?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const repo = new SQLiteFinanceRepository(getDatabase());
              await repo.updatePeriod(period.id, { savings: 0 });
              await loadPeriod();
            } catch (error) {
              Alert.alert('Error', 'No se pudieron eliminar los ahorros');
            }
          },
        },
      ]
    );
  };

  if (!period) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Cargando...</Text>
      </SafeAreaView>
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
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />
      <LinearGradient colors={['#1565C0', '#2196F3']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>‹ Volver</Text>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{period.monthName} {period.year}</Text>
              <Text style={styles.headerSubtitle}>Finanzas</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <SafeAreaView style={styles.contentContainer} edges={['bottom']}>
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Ingresos</Text>
              <Text style={[styles.summaryValue, { color: '#43A047' }]}>{formatCurrency(totalIncome)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Gastos</Text>
              <Text style={[styles.summaryValue, { color: '#E53935' }]}>{formatCurrency(totalExpenses)}</Text>
            </View>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Balance</Text>
              <Text style={[styles.summaryValue, { color: balance >= 0 ? '#43A047' : '#E53935' }]}>{formatCurrency(balance)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Ahorros</Text>
              <Text style={[styles.summaryValue, { color: '#1565C0' }]}>{formatCurrency(totalSavings)}</Text>
            </View>
          </View>
          {totalDebtRemaining > 0 && (
            <View style={[styles.summaryRow, styles.debtRow]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, styles.debtLabel]}>Deuda pendiente</Text>
                <Text style={[styles.summaryValue, { color: '#FF9800' }]}>{formatCurrency(totalDebtRemaining)}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Agregar</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E8F5E9' }]} onPress={() => { setAddType('income'); setShowAddModal(true); }}>
              <Text style={styles.actionBtnIcon}>💵</Text>
              <Text style={styles.actionBtnLabel}>Ingreso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]} onPress={() => { setAddType('expense'); setShowAddModal(true); }}>
              <Text style={styles.actionBtnIcon}>📝</Text>
              <Text style={styles.actionBtnLabel}>Gasto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FFF3E0' }]} onPress={() => setShowDebtModal(true)}>
              <Text style={styles.actionBtnIcon}>🏦</Text>
              <Text style={styles.actionBtnLabel}>Deuda</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E3F2FD' }]} onPress={() => setShowSavingsModal(true)}>
              <Text style={styles.actionBtnIcon}>💎</Text>
              <Text style={styles.actionBtnLabel}>Ahorro</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content}>
        {period.income.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💵 Ingresos ({period.income.length})</Text>
            {period.income.map((inc, i) => (
              <TouchableOpacity key={i} style={styles.item} onLongPress={() => handleDeleteItem('income', i)}>
                <Text style={styles.itemText}>{inc.source}</Text>
                <Text style={[styles.itemValue, { color: '#43A047' }]}>{formatCurrency(inc.amount)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {period.expenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Gastos ({period.expenses.length})</Text>
            {period.expenses.map((exp, i) => (
              <TouchableOpacity key={i} style={styles.item} onLongPress={() => handleDeleteItem('expense', i)}>
                <Text style={styles.itemText}>{exp.subcategory}</Text>
                <Text style={[styles.itemValue, { color: '#E53935' }]}>{formatCurrency(exp.amount)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {period.debts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏦 Deudas ({period.debts.length})</Text>
            {period.debts.map((debt, i) => (
              <TouchableOpacity key={i} style={styles.item} onPress={() => !debt.paidThisMonth && handleDebtPayment(i)} onLongPress={() => handleDeleteItem('debt', i)}>
                <View>
                  <Text style={styles.itemText}>{debt.name}</Text>
                  <Text style={styles.itemSubtext}>Pago: {formatCurrency(debt.monthlyPayment)} • Restante: {formatCurrency(debt.remainingAmount)}</Text>
                </View>
                <Text style={[styles.itemValue, { color: debt.paidThisMonth ? '#43A047' : '#FF9800' }]}>
                  {debt.paidThisMonth ? '✓ Pagado' : 'Toca para pagar'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {totalSavings > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💎 Ahorros ({totalSavings > 0 ? 1 : 0})</Text>
            <TouchableOpacity style={styles.item} onLongPress={() => handleDeleteSavings()}>
              <Text style={styles.itemText}>Total Ahorrado</Text>
              <Text style={[styles.itemValue, { color: '#1565C0' }]}>{formatCurrency(totalSavings)}</Text>
            </TouchableOpacity>
          </View>
        )}

        {period.income.length === 0 && period.expenses.length === 0 && period.debts.length === 0 && totalSavings === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Sin registros. Agrega ingresos, gastos o deudas.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Agregar {addType === 'income' ? 'Ingreso' : 'Gasto'}</Text>
            
            {addType === 'income' ? (
              <>
                <TouchableOpacity style={styles.selectButton} onPress={() => setShowSourcePicker(true)}>
                  <Text style={[styles.selectButtonText, !selectedSource && styles.selectButtonPlaceholder]}>
                    {selectedSource || 'Seleccionar fuente'}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
                <Modal visible={showSourcePicker} transparent animationType="fade">
                  <TouchableOpacity style={styles.pickerOverlay} onPress={() => setShowSourcePicker(false)}>
                    <View style={styles.pickerContent}>
                      <Text style={styles.pickerTitle}>Seleccionar fuente</Text>
                      {INCOME_SOURCES.map((source) => (
                        <TouchableOpacity key={source} style={styles.pickerOption} onPress={() => { setSelectedSource(source); setShowSourcePicker(false); }}>
                          <Text style={styles.pickerOptionText}>{source}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                </Modal>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.selectButton} onPress={() => setShowCategoryPicker(true)}>
                  <Text style={[styles.selectButtonText, !selectedCategory && styles.selectButtonPlaceholder]}>
                    {selectedCategory || 'Seleccionar categoría'}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
                <Modal visible={showCategoryPicker} transparent animationType="fade">
                  <TouchableOpacity style={styles.pickerOverlay} onPress={() => setShowCategoryPicker(false)}>
                    <View style={styles.pickerContent}>
                      <Text style={styles.pickerTitle}>Seleccionar categoría</Text>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <TouchableOpacity key={cat} style={styles.pickerOption} onPress={() => { setSelectedCategory(cat); setShowCategoryPicker(false); }}>
                          <Text style={styles.pickerOptionText}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                </Modal>
              </>
            )}
            
            <TextInput style={styles.input} placeholder="Monto (S/)" keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} placeholderTextColor={colors.textMuted} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowAddModal(false); setSelectedSource(''); setSelectedCategory(''); setNewAmount(''); }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleAddItem}><Text style={styles.modalConfirmText}>Agregar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDebtModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Agregar Deuda/Préstamo</Text>
            
            <TouchableOpacity style={styles.selectButton} onPress={() => setShowDebtTypePicker(true)}>
              <Text style={[styles.selectButtonText, !selectedDebtType && styles.selectButtonPlaceholder]}>
                {selectedDebtType || 'Seleccionar tipo de deuda'}
              </Text>
              <Text style={styles.selectArrow}>▼</Text>
            </TouchableOpacity>
            <Modal visible={showDebtTypePicker} transparent animationType="fade">
              <TouchableOpacity style={styles.pickerOverlay} onPress={() => setShowDebtTypePicker(false)}>
                <View style={styles.pickerContent}>
                  <Text style={styles.pickerTitle}>Seleccionar tipo de deuda</Text>
                  {DEBT_TYPES.map((type) => (
                    <TouchableOpacity key={type} style={styles.pickerOption} onPress={() => { setSelectedDebtType(type); setShowDebtTypePicker(false); }}>
                      <Text style={styles.pickerOptionText}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
            
            <TextInput style={styles.input} placeholder="Monto total (S/)" keyboardType="numeric" value={newAmount} onChangeText={setNewAmount} placeholderTextColor={colors.textMuted} />
            <TextInput style={styles.input} placeholder="Meses a pagar" keyboardType="numeric" value={debtMonths} onChangeText={setDebtMonths} placeholderTextColor={colors.textMuted} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowDebtModal(false); setSelectedDebtType(''); setNewAmount(''); setDebtMonths(''); }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleAddDebt}><Text style={styles.modalConfirmText}>Agregar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSavingsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💎 Registrar Ahorro</Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 }}>
              Tus ahorros actuales: {formatCurrency(totalSavings)}
            </Text>
            <TextInput style={styles.input} placeholder="Monto a ahorrar (S/)" keyboardType="numeric" value={newSavings} onChangeText={setNewSavings} placeholderTextColor={colors.textMuted} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowSavingsModal(false); setNewSavings(''); }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleSaveSavings}><Text style={styles.modalConfirmText}>Guardar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backBtnText: {
    color: colors.common.white,
    fontSize: 16,
    fontWeight: '600',
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
  summary: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
  },
  debtRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFE0B2',
  },
  debtLabel: {
    color: '#F57C00',
  },
  actionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  actionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  summaryTotal: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  actionBtnLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemText: {
    fontSize: 15,
    color: colors.text,
  },
  itemSubtext: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
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
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontWeight: '600',
    color: '#666',
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontWeight: '600',
    color: colors.common.white,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  selectButtonText: {
    fontSize: 16,
    color: '#333',
  },
  selectButtonPlaceholder: {
    color: colors.textMuted,
  },
  selectArrow: {
    fontSize: 12,
    color: '#666',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContent: {
    backgroundColor: colors.common.white,
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  pickerOptionText: {
    fontSize: 16,
    color: colors.text,
  },
});

export default FinanceDetailScreen;