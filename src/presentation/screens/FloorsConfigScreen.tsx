import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpenseSettings, Floor, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_SOURCES } from '../../domain/entities/Expense';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { getDatabase } from '../../data/Database';
import { getSavedGroupCode, updateGroupSettings, getGroupSettings } from '../../services/SyncService';
import { colors } from '../theme/colors';

interface FloorInputProps {
  floor: Floor;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  showCustomIgv: boolean;
  globalIgv: number;
}

const FloorInputCard: React.FC<FloorInputProps> = React.memo(({ 
  floor, 
  onUpdate, 
  onDelete,
  showCustomIgv,
  globalIgv 
}) => {
  const [name, setName] = useState(floor.name);
  const [waterFixed, setWaterFixed] = useState(floor.waterFixedAmount?.toString() || '0');
  const [waterPercent, setWaterPercent] = useState(floor.waterPercentage?.toString() || '0');
  const [igvPercent, setIgvPercent] = useState(
    floor.igvPercentage != null ? String(floor.igvPercentage) : ''
  );
  const [fixedCharge, setFixedCharge] = useState(floor.fixedCharge?.toString() || '0');

  useEffect(() => {
    setName(floor.name);
    setWaterFixed(floor.waterFixedAmount?.toString() || '0');
    setWaterPercent(floor.waterPercentage?.toString() || '0');
    setIgvPercent(floor.igvPercentage != null ? String(floor.igvPercentage) : '');
    setFixedCharge(floor.fixedCharge?.toString() || '0');
  }, [floor.id, globalIgv]);

  const onBlurName = () => {
    if (name !== floor.name) {
      onUpdate(floor.id, 'name', name);
    }
  };

  const onBlurWaterFixed = () => {
    const value = parseFloat(waterFixed) || 0;
    if (value !== floor.waterFixedAmount) {
      onUpdate(floor.id, 'waterFixedAmount', value);
    }
  };

  const onBlurWaterPercent = () => {
    const value = parseInt(waterPercent) || 0;
    if (value !== floor.waterPercentage) {
      onUpdate(floor.id, 'waterPercentage', value);
    }
  };

  const onBlurIgvPercent = () => {
    if (igvPercent === '' || igvPercent === globalIgv.toString()) {
      onUpdate(floor.id, 'igvPercentage', undefined);
    } else {
      const value = parseFloat(igvPercent) || globalIgv;
      onUpdate(floor.id, 'igvPercentage', value);
    }
  };

  const onBlurFixedCharge = () => {
    const value = parseFloat(fixedCharge) || 0;
    if (value !== floor.fixedCharge) {
      onUpdate(floor.id, 'fixedCharge', value);
    }
  };

  return (
    <View style={styles.floorCard}>
      <View style={styles.floorHeader}>
        <Text style={styles.floorTitle}>🏠 {name || 'Piso'}</Text>
        <TouchableOpacity onPress={() => onDelete(floor.id)}>
          <Text style={styles.deleteButton}>🗑️</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.floorInputs}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nombre del piso</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            onBlur={onBlurName}
            placeholder="Nombre"
          />
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Medidor de luz</Text>
            <View style={styles.switchContainer}>
              <TouchableOpacity
                style={[styles.switchButton, floor.hasElectricityMeter !== false && styles.switchButtonActive]}
                onPress={() => onUpdate(floor.id, 'hasElectricityMeter', true)}
              >
                <Text style={[styles.switchText, floor.hasElectricityMeter !== false && styles.switchTextActive]}>Sí</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.switchButton, floor.hasElectricityMeter === false && styles.switchButtonActive]}
                onPress={() => onUpdate(floor.id, 'hasElectricityMeter', false)}
              >
                <Text style={[styles.switchText, floor.hasElectricityMeter === false && styles.switchTextActive]}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionSubtitle}>⚡ Luz</Text>
        
        {showCustomIgv && (
          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>IGV % (dejar vacío = global)</Text>
              <TextInput
                style={[
                  styles.input,
                  floor.igvPercentage !== undefined && styles.inputHighlighted
                ]}
                value={igvPercent}
                onChangeText={setIgvPercent}
                onBlur={onBlurIgvPercent}
                keyboardType="decimal-pad"
                placeholder={globalIgv.toString()}
              />
              {floor.igvPercentage !== undefined && (
                <Text style={styles.inputHint}>Personalizado (global: {globalIgv}%)</Text>
              )}
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Cargo fijo S/</Text>
              <TextInput
                style={styles.input}
                value={fixedCharge}
                onChangeText={setFixedCharge}
                onBlur={onBlurFixedCharge}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        )}

        {!showCustomIgv && (
          <View style={styles.defaultIgvRow}>
            <Text style={styles.defaultIgvText}>
              IGV: {globalIgv}% (global) • Cargo fijo: S/ {fixedCharge || '0'}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionSubtitle}>💧 Agua</Text>
        
        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Monto fijo S/</Text>
            <TextInput
              style={styles.input}
              value={waterFixed}
              onChangeText={setWaterFixed}
              onBlur={onBlurWaterFixed}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Porcentaje %</Text>
            <TextInput
              style={styles.input}
              value={waterPercent}
              onChangeText={setWaterPercent}
              onBlur={onBlurWaterPercent}
              keyboardType="number-pad"
            />
          </View>
        </View>
      </View>
    </View>
  );
});

const LOG_PREFIX = '[FloorsConfigScreen]';

const FloorsConfigScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<ExpenseSettings>({
    floors: [],
    electricityTariffPerKwh: 0.66,
    igvPercentage: 18,
    waterTotalPercentage: 100,
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    incomeSources: DEFAULT_INCOME_SOURCES,
  });
  const [tariff, setTariff] = useState('0.66');
  const [igv, setIgv] = useState('18');
  const [hasChanges, setHasChanges] = useState(false);
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [showCustomIgv, setShowCustomIgv] = useState(false);

  useEffect(() => {
    console.log(`${LOG_PREFIX} useEffect - ini`);
    loadSettings();
    console.log(`${LOG_PREFIX} useEffect - fin`);
  }, []);

  const loadSettings = async () => {
    console.log(`${LOG_PREFIX} loadSettings - ini`);
    try {
      const code = await getSavedGroupCode();
      console.log(`${LOG_PREFIX} loadSettings - code: ${code}`);
      setGroupCode(code);
      
      if (code) {
        console.log(`${LOG_PREFIX} loadSettings - cargando desde cloud`);
        const cloudSettings = await getGroupSettings(code);
        console.log(`${LOG_PREFIX} loadSettings - cloudSettings: ${!!cloudSettings}`);
        if (cloudSettings && cloudSettings.floors) {
          setSettings(cloudSettings);
          setTariff((cloudSettings.electricityTariffPerKwh ?? 0.66).toString());
          setIgv((cloudSettings.igvPercentage ?? 18).toString());
          
          const hasCustomIgv = (cloudSettings.floors ?? []).some(
            f => f && f.igvPercentage != null
          );
          setShowCustomIgv(hasCustomIgv);
        }
      } else {
        console.log(`${LOG_PREFIX} loadSettings - cargando desde local`);
        const repo = new SQLiteExpenseRepository(getDatabase());
        const settingsData = await repo.getSettings();
        setSettings(settingsData);
        setTariff((settingsData.electricityTariffPerKwh ?? 0.66).toString());
        setIgv((settingsData.igvPercentage ?? 18).toString());
        
        const hasCustomIgv = settingsData.floors?.some(
          f => f && f.igvPercentage !== undefined
        ) ?? false;
        setShowCustomIgv(hasCustomIgv);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const finalSettings = {
        ...settings,
        electricityTariffPerKwh: parseFloat(tariff) || 0.66,
        igvPercentage: parseFloat(igv) || 18,
      };
      
      if (groupCode) {
        await updateGroupSettings(groupCode, finalSettings);
      } else {
        const repo = new SQLiteExpenseRepository(getDatabase());
        await repo.updateSettings(finalSettings);
      }
      setHasChanges(false);
      Alert.alert('Guardado', 'Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración');
    }
  };

  const addFloor = () => {
    const newFloor: Floor = {
      id: Date.now().toString(),
      name: `Piso ${settings.floors.length + 1}`,
      hasElectricityMeter: true,
      waterPercentage: 0,
      waterFixedAmount: 0,
      igvPercentage: undefined as any,
      fixedCharge: 0,
    };
    setSettings(prev => ({ ...prev, floors: [...prev.floors, newFloor] }));
    setHasChanges(true);
  };

  const updateFloor = useCallback((id: string, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      floors: prev.floors.map(f => 
        f.id === id ? { ...f, [field]: value } : f
      ),
    }));
    setHasChanges(true);
  }, []);

  const deleteFloor = useCallback((id: string) => {
    if (settings.floors.length <= 1) {
      Alert.alert('Error', 'Debe haber al menos un piso');
      return;
    }
    Alert.alert(
      'Eliminar piso',
      '¿Estás seguro de eliminar este piso?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setSettings(prev => ({
              ...prev,
              floors: prev.floors.filter(f => f.id !== id),
            }));
            setHasChanges(true);
          },
        },
      ]
    );
  }, [settings.floors.length]);

  const totalWaterPercentage = settings.floors.reduce((sum, f) => sum + (f.waterPercentage || 0), 0);
  const totalWaterFixed = settings.floors.reduce((sum, f) => sum + (f.waterFixedAmount || 0), 0);

  const onBlurTariff = () => {
    setHasChanges(true);
  };

  const onBlurIgv = () => {
    setHasChanges(true);
  };

  const toggleCustomIgv = () => {
    if (!showCustomIgv) {
      setShowCustomIgv(true);
    } else {
      const hasCustomValues = settings.floors.some(
        f => f.igvPercentage !== undefined
      );
      
      if (hasCustomValues) {
        Alert.alert(
          'Valores personalizados',
          'Algunos pisos tienen IGV personalizado. ¿Deseas restablecer todos al valor global?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Restablecer', 
              onPress: () => {
                setSettings(prev => ({
                  ...prev,
                  floors: prev.floors.map(f => ({
                    ...f,
                    igvPercentage: undefined,
                  })),
                }));
                setShowCustomIgv(false);
                setHasChanges(true);
              }
            },
          ]
        );
      } else {
        setShowCustomIgv(false);
      }
    }
  };

  const globalIgv = settings.igvPercentage || 18;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" translucent={true} />
      <View style={styles.statusBarSpacer} />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Tarifas de Electricidad</Text>
          
          <View style={styles.ratesContainer}>
            <View style={styles.rateCard}>
              <Text style={styles.rateLabel}>Tarifa por kWh (S/)</Text>
              <TextInput
                style={styles.rateInput}
                value={tariff}
                onChangeText={setTariff}
                onBlur={onBlurTariff}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.rateCard}>
              <Text style={styles.rateLabel}>IGV Global (%)</Text>
              <TextInput
                style={styles.rateInput}
                value={igv}
                onChangeText={setIgv}
                onBlur={onBlurIgv}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.customizeButton, showCustomIgv && styles.customizeButtonActive]}
            onPress={toggleCustomIgv}
          >
            <Text style={styles.customizeButtonIcon}>{showCustomIgv ? '✓' : '⚙️'}</Text>
            <Text style={styles.customizeButtonText}>
              {showCustomIgv ? 'Usando IGV personalizado' : 'Personalizar IGV por piso'}
            </Text>
          </TouchableOpacity>
          
          {showCustomIgv && (
            <Text style={styles.customizeHint}>
              Cada piso puede tener un IGV diferente al global ({globalIgv}%)
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏠 Pisos</Text>
            <TouchableOpacity style={styles.addButton} onPress={addFloor}>
              <Text style={styles.addButtonText}>+ Agregar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.waterSummary}>
            <View style={styles.waterSummaryRow}>
              <Text style={styles.waterSummaryLabel}>Total montos fijos:</Text>
              <Text style={styles.waterSummaryValue}>S/ {totalWaterFixed.toFixed(2)}</Text>
            </View>
            <View style={styles.waterSummaryRow}>
              <Text style={styles.waterSummaryLabel}>Total porcentajes:</Text>
              <Text style={[
                styles.waterSummaryValue,
                Math.abs(totalWaterPercentage - 100) > 0.1 && styles.waterSummaryError
              ]}>
                {totalWaterPercentage}%
              </Text>
            </View>
            {Math.abs(totalWaterPercentage - 100) > 0.1 && (
              <Text style={styles.waterSummaryHint}>Los porcentajes deben sumar 100%</Text>
            )}
          </View>

          {settings.floors.map((floor) => (
            <FloorInputCard
              key={floor.id}
              floor={floor}
              onUpdate={updateFloor}
              onDelete={deleteFloor}
              showCustomIgv={showCustomIgv}
              globalIgv={globalIgv}
            />
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {hasChanges && (
        <TouchableOpacity style={[styles.saveButton, { bottom: 16 + insets.bottom }]} onPress={saveSettings}>
          <LinearGradient
            colors={['#4CAF50', '#388E3C']}
            style={styles.saveButtonGradient}
          >
            <Text style={styles.saveButtonText}>💾 Guardar cambios</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  statusBarSpacer: {
    height: StatusBar.currentHeight || 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.main,
    marginTop: 8,
    marginBottom: 8,
  },
  ratesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  rateCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rateLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  rateInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    padding: 0,
  },
  addButton: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: colors.common.white,
    fontWeight: '600',
    fontSize: 14,
  },
  waterSummary: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  waterSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  waterSummaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  waterSummaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  waterSummaryError: {
    color: '#f44336',
  },
  waterSummaryHint: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
    textAlign: 'center',
  },
  floorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  floorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  floorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  deleteButton: {
    fontSize: 20,
  },
  floorInputs: {
    padding: 16,
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  inputHighlighted: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  inputHint: {
    fontSize: 10,
    color: '#FF9800',
    marginTop: 2,
  },
  defaultIgvRow: {
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    padding: 10,
  },
  defaultIgvText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  customizeButtonActive: {
    backgroundColor: '#e8f5e9',
  },
  customizeButtonIcon: {
    fontSize: 16,
  },
  customizeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
  },
  customizeHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  switchContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  switchButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  switchButtonActive: {
    backgroundColor: '#2196F3',
  },
  switchText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  switchTextActive: {
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  bottomSpacer: {
    height: 200,
  },
  saveButton: {
    position: 'absolute',
    left: 0,
    right: 0,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  saveButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default FloorsConfigScreen;
