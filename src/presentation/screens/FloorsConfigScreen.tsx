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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  House,
  Lightning,
  Drop,
  Plus,
  Trash,
  Check,
  GearSix,
  ToggleLeft,
  ToggleRight,
  PencilSimple,
} from 'phosphor-react-native';
import { ExpenseSettings, Floor, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_SOURCES } from '../../domain/entities/Expense';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { getDatabase } from '../../data/Database';
import { getSavedGroupCode, updateGroupSettings, getGroupSettings } from '../../services/SyncService';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { ConfirmDialog } from '../components/ConfirmDialog';

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
  globalIgv,
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
        <View style={styles.floorTitleRow}>
          <House size={20} color={colors.primary.main} weight="fill" />
          <Text style={styles.floorTitle} numberOfLines={1}>{name || 'Piso'}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteIconButton}
          onPress={() => onDelete(floor.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash size={18} color={colors.error} weight="regular" />
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
            placeholderTextColor={colors.input.placeholder}
          />
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Medidor de luz</Text>
            <View style={styles.switchContainer}>
              <TouchableOpacity
                style={[
                  styles.switchButton,
                  floor.hasElectricityMeter !== false && styles.switchButtonActive,
                ]}
                onPress={() => onUpdate(floor.id, 'hasElectricityMeter', true)}
              >
                <Lightning
                  size={14}
                  color={floor.hasElectricityMeter !== false ? colors.common.white : colors.textMuted}
                  weight={floor.hasElectricityMeter !== false ? 'fill' : 'regular'}
                />
                <Text
                  style={[
                    styles.switchText,
                    floor.hasElectricityMeter !== false && styles.switchTextActive,
                  ]}
                >
                  Sí
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.switchButton,
                  floor.hasElectricityMeter === false && styles.switchButtonActive,
                ]}
                onPress={() => onUpdate(floor.id, 'hasElectricityMeter', false)}
              >
                <ToggleLeft
                  size={14}
                  color={floor.hasElectricityMeter === false ? colors.common.white : colors.textMuted}
                  weight={floor.hasElectricityMeter === false ? 'fill' : 'regular'}
                />
                <Text
                  style={[
                    styles.switchText,
                    floor.hasElectricityMeter === false && styles.switchTextActive,
                  ]}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.sectionLabelRow}>
          <Lightning size={16} color={colors.accent.blue} weight="fill" />
          <Text style={styles.sectionSubtitle}>Luz</Text>
        </View>

        {showCustomIgv && (
          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>IGV % (dejar vacío = global)</Text>
              <TextInput
                style={[
                  styles.input,
                  floor.igvPercentage !== undefined && styles.inputHighlighted,
                ]}
                value={igvPercent}
                onChangeText={setIgvPercent}
                onBlur={onBlurIgvPercent}
                keyboardType="decimal-pad"
                placeholder={globalIgv.toString()}
                placeholderTextColor={colors.input.placeholder}
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
                placeholderTextColor={colors.input.placeholder}
              />
            </View>
          </View>
        )}

        {!showCustomIgv && (
          <View style={styles.defaultIgvRow}>
            <GearSix size={14} color={colors.textMuted} weight="regular" />
            <Text style={styles.defaultIgvText} numberOfLines={2}>
              IGV: {globalIgv}% (global) • Cargo fijo: S/ {fixedCharge || '0'}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.sectionLabelRow}>
          <Drop size={16} color={colors.accent.blue} weight="fill" />
          <Text style={styles.sectionSubtitle}>Agua</Text>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Monto fijo S/</Text>
            <TextInput
              style={styles.input}
              value={waterFixed}
              onChangeText={setWaterFixed}
              onBlur={onBlurWaterFixed}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.input.placeholder}
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
              placeholderTextColor={colors.input.placeholder}
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
  const [deleteFloorDialogVisible, setDeleteFloorDialogVisible] = useState(false);
  const [deleteFloorId, setDeleteFloorId] = useState<string | null>(null);
  const [feedbackDialogVisible, setFeedbackDialogVisible] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{ title: string; message: string; variant: 'success' | 'info' } | null>(null);

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
      setFeedbackData({ title: 'Guardado', message: 'Configuración guardada correctamente', variant: 'success' });
      setFeedbackDialogVisible(true);
    } catch (error) {
      console.error('Error saving settings:', error);
      setFeedbackData({ title: 'Error', message: 'No se pudo guardar la configuración', variant: 'info' });
      setFeedbackDialogVisible(true);
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
    setDeleteFloorId(id);
    setDeleteFloorDialogVisible(true);
  }, [settings.floors.length]);

  const confirmDeleteFloor = () => {
    if (!deleteFloorId) return;
    setSettings(prev => ({
      ...prev,
      floors: prev.floors.filter(f => f.id !== deleteFloorId),
    }));
    setHasChanges(true);
    setDeleteFloorDialogVisible(false);
    setDeleteFloorId(null);
  };

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
              },
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
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
        translucent={false}
      />
      <View style={[styles.statusBarSpacer, { height: insets.top }]} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.screenHeader}>
            <View style={styles.headerIconContainer}>
              <GearSix size={28} color={colors.primary.main} weight="regular" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.screenTitle}>Configurar Pisos</Text>
              <Text style={styles.screenSubtitle}>Gestiona la distribución de servicios</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLabelRow}>
                <Lightning size={18} color={colors.accent.blue} weight="fill" />
                <Text style={styles.sectionTitle}>Tarifas de Electricidad</Text>
              </View>
            </View>

            <View style={styles.ratesContainer}>
              <View style={styles.rateCard}>
                <Text style={styles.rateLabel}>Tarifa por kWh</Text>
                <Text style={styles.rateCurrency}>S/</Text>
                <TextInput
                  style={styles.rateInput}
                  value={tariff}
                  onChangeText={setTariff}
                  onBlur={onBlurTariff}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.input.placeholder}
                />
              </View>

              <View style={styles.rateCard}>
                <Text style={styles.rateLabel}>IGV Global</Text>
                <Text style={styles.rateCurrency}>%</Text>
                <TextInput
                  style={styles.rateInput}
                  value={igv}
                  onChangeText={setIgv}
                  onBlur={onBlurIgv}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.input.placeholder}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.customizeButton,
                showCustomIgv && styles.customizeButtonActive,
              ]}
              onPress={toggleCustomIgv}
              activeOpacity={0.7}
            >
              {showCustomIgv ? (
                <Check size={18} color={colors.primary.dark} weight="fill" />
              ) : (
                <GearSix size={18} color={colors.primary.main} weight="regular" />
              )}
              <Text style={styles.customizeButtonText} numberOfLines={1}>
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
              <View style={styles.sectionLabelRow}>
                <House size={18} color={colors.primary.main} weight="fill" />
                <Text style={styles.sectionTitle}>Pisos</Text>
              </View>
              <TouchableOpacity style={styles.addButton} onPress={addFloor} activeOpacity={0.7}>
                <Plus size={16} color={colors.common.white} weight="bold" />
                <Text style={styles.addButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.waterSummary}>
              <View style={styles.waterSummaryRow}>
                <View style={styles.waterSummaryLabelContainer}>
                  <Drop size={14} color={colors.accent.blue} weight="fill" />
                  <Text style={styles.waterSummaryLabel}>Total montos fijos</Text>
                </View>
                <Text style={styles.waterSummaryValue}>S/ {totalWaterFixed.toFixed(2)}</Text>
              </View>
              <View style={styles.waterSummaryDivider} />
              <View style={styles.waterSummaryRow}>
                <View style={styles.waterSummaryLabelContainer}>
                  <Drop size={14} color={colors.accent.blue} weight="regular" />
                  <Text style={styles.waterSummaryLabel}>Total porcentajes</Text>
                </View>
                <Text
                  style={[
                    styles.waterSummaryValue,
                    Math.abs(totalWaterPercentage - 100) > 0.1 && styles.waterSummaryError,
                  ]}
                >
                  {totalWaterPercentage}%
                </Text>
              </View>
              {Math.abs(totalWaterPercentage - 100) > 0.1 && (
                <View style={styles.waterErrorContainer}>
                  <Text style={styles.waterSummaryHint}>Los porcentajes deben sumar 100%</Text>
                </View>
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

          <View style={{ height: 80 }} />
        </ScrollView>

        {hasChanges && (
          <TouchableOpacity
            style={[styles.saveButton, { bottom: spacing[16] + insets.bottom }]}
            onPress={saveSettings}
            activeOpacity={0.8}
          >
            <View style={styles.saveButtonInner}>
              <Check size={20} color={colors.common.white} weight="bold" />
              <Text style={styles.saveButtonText}>Guardar cambios</Text>
            </View>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={deleteFloorDialogVisible}
        title="Eliminar piso"
        message="¿Estás seguro de eliminar este piso? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={confirmDeleteFloor}
        onCancel={() => { setDeleteFloorDialogVisible(false); setDeleteFloorId(null); }}
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
  flex: {
    flex: 1,
  },
  statusBarSpacer: {
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[20],
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    paddingBottom: spacing[20],
    gap: spacing[12],
  },
  headerIconContainer: {
    width: spacing[48],
    height: spacing[48],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  screenTitle: {
    ...typography.h2,
    color: colors.text,
  },
  screenSubtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  section: {
    paddingHorizontal: spacing[20],
    marginBottom: spacing[24],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
  },
  sectionSubtitle: {
    ...typography.label,
    color: colors.textSecondary,
  },
  ratesContainer: {
    flexDirection: 'row',
    gap: spacing[12],
  },
  rateCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateLabel: {
    ...typography.captionMedium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[4],
  },
  rateCurrency: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing[2],
  },
  rateInput: {
    ...typography.h2,
    color: colors.text,
    padding: 0,
  },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.light,
    borderRadius: borderRadius.md,
    padding: spacing[14],
    marginTop: spacing[12],
    gap: spacing[8],
  },
  customizeButtonActive: {
    backgroundColor: colors.primary[100],
  },
  customizeButtonText: {
    ...typography.buttonSmall,
    color: colors.primary.dark,
  },
  customizeHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[8],
    fontStyle: 'italic',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    borderRadius: borderRadius.full,
    gap: spacing[6],
    ...shadows.sm,
  },
  addButtonText: {
    ...typography.buttonSmall,
    color: colors.common.white,
  },
  waterSummary: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing[16],
    marginBottom: spacing[12],
    borderWidth: 1,
    borderColor: colors.border,
  },
  waterSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  waterSummaryLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  waterSummaryLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  waterSummaryValue: {
    ...typography.currencySmall,
    color: colors.success,
  },
  waterSummaryError: {
    color: colors.error,
  },
  waterSummaryDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing[8],
  },
  waterErrorContainer: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.sm,
    padding: spacing[8],
    marginTop: spacing[8],
  },
  waterSummaryHint: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
  },
  floorCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[12],
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  floorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[16],
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  floorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flex: 1,
  },
  floorTitle: {
    ...typography.label,
    color: colors.text,
  },
  deleteIconButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorLight,
  },
  floorInputs: {
    padding: spacing[16],
    gap: spacing[12],
  },
  inputGroup: {
    gap: spacing[4],
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing[12],
  },
  inputLabel: {
    ...typography.captionMedium,
    color: colors.textMuted,
  },
  input: {
    ...typography.bodyMedium,
    backgroundColor: colors.input.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.input.border,
  },
  inputHighlighted: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
  },
  inputHint: {
    ...typography.caption,
    color: colors.warning,
    marginTop: spacing[2],
  },
  defaultIgvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.input.background,
    borderRadius: borderRadius.sm,
    padding: spacing[10],
    gap: spacing[8],
  },
  defaultIgvText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  switchContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: colors.input.background,
    borderWidth: 1,
    borderColor: colors.input.border,
  },
  switchButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing[8],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
  switchButtonActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  switchText: {
    ...typography.buttonSmall,
    color: colors.textMuted,
  },
  switchTextActive: {
    color: colors.common.white,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing[4],
  },
  saveButton: {
    position: 'absolute',
    left: spacing[16],
    right: spacing[16],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.primary.main,
    ...shadows.primary,
  },
  saveButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
    gap: spacing[8],
  },
  saveButtonText: {
    ...typography.button,
    color: colors.common.white,
  },
});

export default FloorsConfigScreen;
