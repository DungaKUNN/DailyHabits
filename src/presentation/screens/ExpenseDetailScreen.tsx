import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Lightning, Drop, House, Camera, FileText, Calculator, Export, Check, X, Trash, CaretRight } from 'phosphor-react-native';
import { ExpensePeriod, ExpenseSettings, FloorElectricityReading, FloorWaterCost, ReceiptPhoto } from '../../domain/entities/Expense';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { getDatabase } from '../../data/Database';
import { getSavedGroupCode, savePeriodToCloud, getPeriodsFromCloud, getGroupSettings } from '../../services/SyncService';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { storage } from '../../services/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DecimalInput } from '../components/DecimalInput';
import { formatCurrency } from '../../utils/formatting';
import { ConfirmDialog } from '../components/ConfirmDialog';

type ExpenseDetailRouteParams = {
  ExpenseDetail: {
    periodId: string;
  };
};

const LOG_PREFIX = '[ExpenseDetailScreen]';

const ExpenseDetailScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<ExpenseDetailRouteParams, 'ExpenseDetail'>>();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<ExpensePeriod | null>(null);
  const [settings, setSettings] = useState<ExpenseSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [totalReceiptElectricity, setTotalReceiptElectricity] = useState('0');
  const [totalReceiptWater, setTotalReceiptWater] = useState('0');
  const [floorReadings, setFloorReadings] = useState<Record<string, { previous: string; current: string }>>({});
  const [floorsPayingSurplus, setFloorsPayingSurplus] = useState<Set<string>>(new Set());
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [noData, setNoData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageModal, setImageModal] = useState<{ visible: boolean; uri: string; type: 'image' | 'pdf' }>({
    visible: false,
    uri: '',
    type: 'image',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteReceiptDialogVisible, setDeleteReceiptDialogVisible] = useState(false);
  const [deleteReceiptType, setDeleteReceiptType] = useState<'electricity' | 'water'>('electricity');
  const [feedbackDialogVisible, setFeedbackDialogVisible] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{ title: string; message: string; variant: 'success' | 'info' } | null>(null);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log(`${LOG_PREFIX} useEffect - ini`);
    loadGroupCode();
    loadData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    console.log(`${LOG_PREFIX} useEffect - fin`);
  }, []);

  const loadGroupCode = async () => {
    console.log(`${LOG_PREFIX} loadGroupCode - ini`);
    const code = await getSavedGroupCode();
    console.log(`${LOG_PREFIX} loadGroupCode - code: ${code}`);
    setGroupCode(code);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let periodId = route.params.periodId;
      const code = await getSavedGroupCode();

      if (periodId === 'latest' || periodId === 'current') {
        if (code) {
          const periods = await getPeriodsFromCloud(code);
          if (periods.length > 0) {
            periodId = periods[0].id;
          } else {
            setNoData(true);
            setLoading(false);
            return;
          }
        } else {
          const repo = new SQLiteExpenseRepository(getDatabase());
          const latest = await repo.getLatestPeriod();
          if (latest) {
            periodId = latest.id;
          } else {
            setNoData(true);
            setLoading(false);
            return;
          }
        }
      }

      if (code) {
        const periods = await getPeriodsFromCloud(code);
        const periodData = periods.find(p => p.id === periodId);
        if (periodData) {
          setPeriod(periodData);
          setTotalReceiptElectricity(periodData.electricity.totalReceipt.toString());
          setTotalReceiptWater(periodData.water.totalReceipt.toString());

          const readings: Record<string, { previous: string; current: string }> = {};
          periodData.floorsElectricity.forEach(f => {
            readings[f.floorId] = {
              previous: f.previousReading.toString(),
              current: f.currentReading.toString(),
            };
          });
          setFloorReadings(readings);

          const floorsPaying = new Set<string>();
          periodData.floorsElectricity.forEach(f => {
            if (f.paysSurplus) floorsPaying.add(f.floorId);
          });
          setFloorsPayingSurplus(floorsPaying);

          if (periodData.savedSettings) {
            setSettings(periodData.savedSettings);
          } else {
            const cloudSettings = await getGroupSettings(code);
            if (cloudSettings) {
              setSettings(cloudSettings);
            }
          }
        }
      } else {
        const repo = new SQLiteExpenseRepository(getDatabase());
        const periodData = await repo.getPeriodById(periodId);

        if (periodData) {
          setPeriod(periodData);
          setTotalReceiptElectricity(periodData.electricity.totalReceipt.toString());
          setTotalReceiptWater(periodData.water.totalReceipt.toString());

          const readings: Record<string, { previous: string; current: string }> = {};
          periodData.floorsElectricity.forEach(f => {
            readings[f.floorId] = {
              previous: f.previousReading.toString(),
              current: f.currentReading.toString(),
            };
          });
          setFloorReadings(readings);

          if (periodData.savedSettings) {
            setSettings(periodData.savedSettings);
          } else {
            const settingsData = await repo.getSettings();
            setSettings(settingsData);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const updateFloorReading = (floorId: string, field: 'previousReading' | 'currentReading', value: string) => {
    if (!period || !settings) return;

    setFloorReadings(prev => ({
      ...prev,
      [floorId]: {
        ...prev[floorId],
        [field === 'previousReading' ? 'previous' : 'current']: value,
      },
    }));

    const numValue = parseFloat(value) || 0;
    const floor = settings.floors.find(f => f.id === floorId);
    if (!floor) return;

    const existingFloorIndex = period.floorsElectricity.findIndex(f => f.floorId === floorId);
    const existingFloor = existingFloorIndex >= 0 ? period.floorsElectricity[existingFloorIndex] : null;

    const previousReading = field === 'previousReading' ? numValue : (existingFloor?.previousReading || 0);
    const currentReading = field === 'currentReading' ? numValue : (existingFloor?.currentReading || 0);
    const currentSurplus = existingFloor?.surplus || 0;
    const paysSurplus = existingFloor?.paysSurplus || false;
    const floorIgvPercentage = floor.igvPercentage ?? settings.igvPercentage ?? 18;
    const floorFixedCharge = floor.fixedCharge ?? 0;

    const consumptionPrice = Math.max(0, currentReading - previousReading) * settings.electricityTariffPerKwh;
    const igv = consumptionPrice * (floorIgvPercentage / 100);
    const fixedCharge = floorFixedCharge;

    const calculated = {
      floorId,
      floorName: floor.name,
      previousReading,
      currentReading,
      realReading: Math.max(0, currentReading - previousReading),
      consumptionPrice,
      igv,
      fixedCharge,
      surplus: currentSurplus,
      paysSurplus,
      totalToPay: 0,
    };
    calculated.totalToPay = calculated.consumptionPrice + calculated.igv + calculated.fixedCharge + calculated.surplus;

    const newFloorsElectricity = [...period.floorsElectricity];
    if (existingFloorIndex >= 0) {
      newFloorsElectricity[existingFloorIndex] = calculated;
    } else {
      newFloorsElectricity.push(calculated);
    }

    setPeriod({ ...period, floorsElectricity: newFloorsElectricity });
    setHasChanges(true);
  };

  const calculateAll = () => {
    if (!period || !settings) {
      Alert.alert('Error', 'No hay datos cargados');
      return;
    }

    if (!settings.floors || settings.floors.length === 0) {
      Alert.alert('Error', 'No hay pisos configurados. Ve a Configurar Pisos primero.');
      return;
    }

    const recalculatedFloors = period.floorsElectricity.map(f => {
      const floorConfig = settings.floors.find(fl => fl.id === f.floorId);
      const floorIgvPercentage = floorConfig?.igvPercentage ?? settings.igvPercentage ?? 18;
      const floorFixedCharge = floorConfig?.fixedCharge ?? 0;

      const igv = f.consumptionPrice * (floorIgvPercentage / 100);

      return {
        ...f,
        igv,
        fixedCharge: floorFixedCharge,
        totalToPay: f.consumptionPrice + igv + floorFixedCharge + f.surplus,
      };
    });

    const totalFromMeters = recalculatedFloors.reduce(
      (sum, f) => sum + f.consumptionPrice + f.igv + f.fixedCharge,
      0
    );
    const receiptTotal = parseFloat(totalReceiptElectricity) || 0;
    const surplus = receiptTotal - totalFromMeters;

    const payingFloors = Array.from(floorsPayingSurplus);
    const payingCount = payingFloors.length;
    let distributedSum = 0;
    const updatedFloorsElectricity = recalculatedFloors.map(f => {
      const paysSurplus = floorsPayingSurplus.has(f.floorId);
      let perFloor = 0;
      if (paysSurplus && payingCount > 0) {
        const index = payingFloors.indexOf(f.floorId);
        const isLast = index === payingCount - 1;
        if (isLast) {
          perFloor = parseFloat((surplus - distributedSum).toFixed(2));
        } else {
          perFloor = parseFloat((surplus / payingCount).toFixed(2));
          distributedSum += perFloor;
        }
      }
      return {
        ...f,
        surplus: perFloor,
        paysSurplus,
        totalToPay: f.consumptionPrice + f.igv + f.fixedCharge + (paysSurplus ? perFloor : 0),
      };
    });

    const waterReceiptTotal = parseFloat(totalReceiptWater) || 0;
    const totalFixedAmount = settings.floors.reduce((sum, f) => sum + (f.waterFixedAmount || 0), 0);
    const remainingAfterFixed = Math.max(0, waterReceiptTotal - totalFixedAmount);

    const floorsWithPercentage = settings.floors.filter(f => (f.waterPercentage || 0) > 0);
    const totalPercentage = floorsWithPercentage.reduce((sum, f) => sum + (f.waterPercentage || 0), 0);

    const floorsWater: FloorWaterCost[] = settings.floors.map(floor => {
      const fixedAmount = floor.waterFixedAmount || 0;
      let amountFromPercentage = 0;

      if (floor.waterPercentage && floor.waterPercentage > 0 && totalPercentage > 0) {
        amountFromPercentage = remainingAfterFixed * (floor.waterPercentage / totalPercentage);
      } else if (totalPercentage === 0 && fixedAmount === 0) {
        const floorsWithoutPercentage = settings.floors.filter(f => (f.waterPercentage || 0) === 0 && (f.waterFixedAmount || 0) === 0);
        if (floorsWithoutPercentage.length > 0) {
          amountFromPercentage = remainingAfterFixed / floorsWithoutPercentage.length;
        }
      }

      return {
        floorId: floor.id,
        floorName: floor.name,
        percentage: floor.waterPercentage || 0,
        fixedAmount: fixedAmount,
        amount: fixedAmount + amountFromPercentage,
      };
    });

    setPeriod({
      ...period,
      electricity: {
        ...period.electricity,
        totalReceipt: receiptTotal,
        totalFromMeters,
        surplus,
        surplusToDistribute: surplus,
      },
      water: {
        totalReceipt: waterReceiptTotal,
      },
      floorsElectricity: updatedFloorsElectricity,
      floorsWater,
    });
    setHasChanges(true);

    const totalToPayFinal = updatedFloorsElectricity.reduce((sum, f) => sum + f.totalToPay, 0);
    const totalWaterToPay = floorsWater.reduce((sum, f) => sum + f.amount, 0);

    setFeedbackData({
      title: 'Cálculo completado',
      message: `ELECTRICIDAD:\nTotal medidores: ${formatCurrency(totalFromMeters)}\nTotal recibo: ${formatCurrency(receiptTotal)}\nExcedente: ${formatCurrency(surplus)}\n\nAGUA:\nTotal recibo: ${formatCurrency(waterReceiptTotal)}\nDistribuido: ${formatCurrency(totalWaterToPay)}`,
      variant: 'success',
    });
    setFeedbackDialogVisible(true);
  };

  const toggleFloorSurplusPayment = (floorId: string) => {
    setFloorsPayingSurplus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(floorId)) {
        newSet.delete(floorId);
      } else {
        newSet.add(floorId);
      }
      return newSet;
    });
  };

  const savePeriod = async () => {
    console.log(`${LOG_PREFIX} savePeriod - ini - period: ${period?.id}, groupCode: ${groupCode}`);
    if (!period || saving) return;
    setSaving(true);
    setHasChanges(false);

    try {
      if (groupCode) {
        console.log(`${LOG_PREFIX} savePeriod - guardando en cloud`);
        await savePeriodToCloud(groupCode, period);
        console.log(`${LOG_PREFIX} savePeriod - cloud ok`);
      } else {
        console.log(`${LOG_PREFIX} savePeriod - guardando en local`);
        const repo = new SQLiteExpenseRepository(getDatabase());
        await repo.updatePeriod(period.id, period);
        console.log(`${LOG_PREFIX} savePeriod - local ok`);
      }
      console.log(`${LOG_PREFIX} savePeriod - éxito`);
      setFeedbackData({ title: 'Guardado', message: 'Datos actualizados correctamente', variant: 'success' });
      setFeedbackDialogVisible(true);
    } catch (error) {
      console.error(`${LOG_PREFIX} savePeriod - error:`, error);
      setHasChanges(true);
      setFeedbackData({ title: 'Error', message: 'No se pudieron guardar los datos', variant: 'info' });
      setFeedbackDialogVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const exportPeriod = async () => {
    console.log(`${LOG_PREFIX} exportPeriod - ini`);
    if (!period || !settings) return;
    try {
      const totalElectricity = period.floorsElectricity.reduce((sum, f) => sum + f.totalToPay, 0);
      const totalWater = period.floorsWater.reduce((sum, f) => sum + f.amount, 0);
      const grandTotal = totalElectricity + totalWater;

      const csvLines: string[] = [];

      csvLines.push('═══════════════════════════════════════════════════════════════');
      csvLines.push(`              CASA BALANCE - REPORTE DE GASTOS`);
      csvLines.push('═══════════════════════════════════════════════════════════════');
      csvLines.push('');
      csvLines.push(`Período: ${period.monthName.toUpperCase()} ${period.year}`);
      csvLines.push(`Generado: ${new Date().toLocaleDateString('es-PE')}`);
      csvLines.push('');

      csvLines.push('───────────────────────────────────────────────────────────────');
      csvLines.push('                    ELECTRICIDAD');
      csvLines.push('───────────────────────────────────────────────────────────────');
      csvLines.push('');
      csvLines.push('Piso,Lect. Anterior,Lect. Actual,kWh,Consumo,IGV,Cargo Fijo,Excedente,TOTAL');

      period.floorsElectricity.forEach(floor => {
        csvLines.push([
          floor.floorName,
          floor.previousReading.toFixed(1),
          floor.currentReading.toFixed(1),
          floor.realReading.toFixed(1),
          `S/ ${floor.consumptionPrice.toFixed(2)}`,
          `S/ ${floor.igv.toFixed(2)}`,
          `S/ ${(floor.fixedCharge || 0).toFixed(2)}`,
          `S/ ${floor.surplus.toFixed(2)}`,
          `S/ ${floor.totalToPay.toFixed(2)}`
        ].join(','));
      });

      csvLines.push('');
      csvLines.push(`Total Recibo Luz:,,,S/ ${period.electricity.totalReceipt.toFixed(2)}`);
      csvLines.push(`Total Medidores:,,,S/ ${period.electricity.totalFromMeters.toFixed(2)}`);
      csvLines.push(`Excedente:,,,S/ ${period.electricity.surplus.toFixed(2)}`);
      csvLines.push(`TOTAL ELECTRICIDAD:,,,S/ ${totalElectricity.toFixed(2)}`);
      csvLines.push('');

      csvLines.push('───────────────────────────────────────────────────────────────');
      csvLines.push('                       AGUA');
      csvLines.push('───────────────────────────────────────────────────────────────');
      csvLines.push('');
      csvLines.push('Piso,Monto Fijo,Porcentaje,TOTAL');

      period.floorsWater.forEach(floor => {
        csvLines.push([
          floor.floorName,
          `S/ ${floor.fixedAmount.toFixed(2)}`,
          `${floor.percentage}%`,
          `S/ ${floor.amount.toFixed(2)}`
        ].join(','));
      });

      csvLines.push('');
      csvLines.push(`Total Recibo Agua:,,,S/ ${period.water.totalReceipt.toFixed(2)}`);
      csvLines.push(`TOTAL AGUA:,,,S/ ${totalWater.toFixed(2)}`);
      csvLines.push('');

      csvLines.push('═══════════════════════════════════════════════════════════════');
      csvLines.push('                    RESUMEN POR PISO');
      csvLines.push('═══════════════════════════════════════════════════════════════');
      csvLines.push('');
      csvLines.push('Piso,Luz,Agua,TOTAL A PAGAR');

      settings.floors.forEach(floor => {
        const elecFloor = period.floorsElectricity.find(f => f.floorId === floor.id);
        const waterFloor = period.floorsWater.find(f => f.floorId === floor.id);
        const elec = elecFloor?.totalToPay || 0;
        const water = waterFloor?.amount || 0;
        csvLines.push([
          floor.name,
          `S/ ${elec.toFixed(2)}`,
          `S/ ${water.toFixed(2)}`,
          `S/ ${(elec + water).toFixed(2)}`
        ].join(','));
      });

      csvLines.push('');
      csvLines.push('═══════════════════════════════════════════════════════════════');
      csvLines.push(`TOTAL GENERAL A PAGAR:,,,S/ ${grandTotal.toFixed(2)}`);
      csvLines.push('═══════════════════════════════════════════════════════════════');

      const csv = csvLines.join('\n');
      const fileName = `Gastos_${period.monthName}_${period.year}.csv`;
      const filePath = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(filePath, '\uFEFF' + csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar gastos',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Éxito', `Archivo guardado en: ${filePath}`);
      }
    } catch (error) {
      console.error('Error exporting:', error);
      Alert.alert('Error', 'No se pudo exportar');
    }
  };

  const pickReceiptImage = async (type: 'electricity' | 'water') => {
    if (!period) return;

    Alert.alert(
      'Seleccionar recibo',
      '¿Desde dónde quieres obtener el recibo?',
      [
        {
          text: 'Cámara',
          onPress: () => takePhoto(type),
        },
        {
          text: 'Galería',
          onPress: () => pickFromGallery(type),
        },
        {
          text: 'PDF',
          onPress: () => pickPDF(type),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  const takePhoto = async (type: 'electricity' | 'water') => {
    if (!period) return;

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permiso necesario', 'Se necesita acceso a la cámara para tomar fotos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await saveReceiptPhoto(type, {
        uri: result.assets[0].uri,
        type: 'image',
        name: `recibo_${type}_${period.month}.jpg`,
        uploadedAt: new Date(),
      });
    }
  };

  const pickFromGallery = async (type: 'electricity' | 'water') => {
    if (!period) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permiso necesario', 'Se necesita acceso a la galería para seleccionar fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await saveReceiptPhoto(type, {
        uri: result.assets[0].uri,
        type: 'image',
        name: `recibo_${type}_${period.month}.jpg`,
        uploadedAt: new Date(),
      });
    }
  };

  const pickPDF = async (type: 'electricity' | 'water') => {
    if (!period) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      await saveReceiptPhoto(type, {
        uri: result.assets[0].uri,
        type: 'pdf',
        name: result.assets[0].name,
        uploadedAt: new Date(),
      });
    }
  };

  const saveReceiptPhoto = async (type: 'electricity' | 'water', photo: ReceiptPhoto) => {
    if (!period) return;

    try {
      let photoUrl = photo.uri;

      if (groupCode && photo.type === 'image') {
        setUploadingImage(true);

        const storageRef = ref(storage, `families/${groupCode}/expenses/${period.id}/${type}/receipt_${Date.now()}.jpg`);

        const response = await fetch(photo.uri);
        const blob = await response.blob();

        const metadata = {
          contentType: 'image/jpeg',
        };

        await uploadBytes(storageRef, blob, metadata);
        photoUrl = await getDownloadURL(storageRef);
      }

      const updatedPeriod = {
        ...period,
        [type === 'electricity' ? 'electricity' : 'water']: {
          ...period[type === 'electricity' ? 'electricity' : 'water'],
          receiptPhoto: {
            ...photo,
            uri: photoUrl,
          },
        },
        updatedAt: new Date(),
      };

      setPeriod(updatedPeriod);
      setHasChanges(true);
    } catch (error) {
      console.error('Error saving receipt photo:', error);
      const updatedPeriod = {
        ...period,
        [type === 'electricity' ? 'electricity' : 'water']: {
          ...period[type === 'electricity' ? 'electricity' : 'water'],
          receiptPhoto: photo,
        },
        updatedAt: new Date(),
      };
      setPeriod(updatedPeriod);
      setHasChanges(true);
    } finally {
      setUploadingImage(false);
    }
  };

  const removeReceiptPhoto = (type: 'electricity' | 'water') => {
    if (!period) return;
    setDeleteReceiptType(type);
    setDeleteReceiptDialogVisible(true);
  };

  const confirmDeleteReceipt = () => {
    if (!period) return;
    const updatedPeriod = {
      ...period,
      [deleteReceiptType === 'electricity' ? 'electricity' : 'water']: {
        ...period[deleteReceiptType === 'electricity' ? 'electricity' : 'water'],
        receiptPhoto: undefined,
      },
      updatedAt: new Date(),
    };
    setPeriod(updatedPeriod);
    setHasChanges(true);
    setDeleteReceiptDialogVisible(false);
  };

  const viewReceipt = (photo: ReceiptPhoto) => {
    if (photo.type === 'image') {
      setImageModal({ visible: true, uri: photo.uri, type: 'image' });
    } else {
      Sharing.shareAsync(photo.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Ver recibo',
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Cargando datos...</Text>
      </View>
    );
  }

  if (noData) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Lightning size={48} color={colors.textMuted} weight="thin" />
          </View>
          <Text style={styles.emptyTitle}>Sin datos</Text>
          <Text style={styles.emptyText}>
            No hay registros de luz y agua aún.{'\n'}
            Ve a la pestaña "Más" y luego a "Luz/Agua" para crear un período.
          </Text>
        </View>
      </View>
    );
  }

  if (!period || !settings) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Cargando datos...</Text>
      </View>
    );
  }

  const totalElectricityToPay = period.floorsElectricity.reduce((sum, f) => sum + f.totalToPay, 0);
  const totalWaterToPay = period.floorsWater.reduce((sum, f) => sum + f.amount, 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : spacing[20]}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.primary.dark} />
      <LinearGradient colors={[colors.primary.dark, colors.primary.main]} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <CaretRight size={18} color={colors.common.white} weight="bold" style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
            <Lightning size={22} color={colors.common.white} weight="fill" />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>{period.monthName} {period.year}</Text>
              <Text style={styles.headerSubtitle}>Detalle de gastos</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Lightning size={20} color={colors.accent.orange} weight="fill" />
              <Text style={styles.sectionTitle} numberOfLines={1}>Electricidad - Lecturas por Piso</Text>
            </View>
            <TouchableOpacity style={styles.calculateButtonSmall} onPress={calculateAll}>
              <Calculator size={16} color={colors.primary.main} weight="bold" />
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSubtitle} numberOfLines={2}>
            Tarifa: S/ {settings.electricityTariffPerKwh}/kWh  ·  IGV: {settings.igvPercentage}%
          </Text>

          {settings.floors.filter(f => f.hasElectricityMeter).map(floor => {
            const floorData = period.floorsElectricity.find(f => f.floorId === floor.id) || {
              floorId: floor.id,
              floorName: floor.name,
              previousReading: 0,
              currentReading: 0,
              realReading: 0,
              consumptionPrice: 0,
              igv: 0,
              fixedCharge: 0,
              surplus: 0,
              paysSurplus: false,
              totalToPay: 0,
            };

            const savedReadings = floorReadings[floor.id] || { previous: '', current: '' };
            const displayPrevious = savedReadings.previous !== '' ? savedReadings.previous : (floorData.previousReading !== 0 ? floorData.previousReading.toString() : '');
            const displayCurrent = savedReadings.current !== '' ? savedReadings.current : (floorData.currentReading !== 0 ? floorData.currentReading.toString() : '');

            return (
              <View key={floor.id} style={styles.floorCard}>
                <View style={styles.floorCardHeader}>
                  <House size={16} color={colors.textSecondary} weight="duotone" />
                  <Text style={styles.floorName} numberOfLines={1}>{floor.name}</Text>
                </View>

                <View style={styles.readingRow}>
                  <View style={styles.readingInput}>
                    <Text style={styles.readingLabel}>Lect. Anterior</Text>
                    <DecimalInput
                      style={styles.input}
                      value={displayPrevious}
                      onChangeText={(v) => updateFloorReading(floor.id, 'previousReading', v)}
                      placeholder="0"
                    />
                  </View>
                  <View style={styles.readingInput}>
                    <Text style={styles.readingLabel}>Lect. Actual</Text>
                    <DecimalInput
                      style={styles.input}
                      value={displayCurrent}
                      onChangeText={(v) => updateFloorReading(floor.id, 'currentReading', v)}
                      placeholder="0"
                    />
                  </View>
                </View>

                <View style={styles.resultGrid}>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Consumo</Text>
                    <Text style={styles.resultValue}>{floorData.realReading.toFixed(1)} kWh</Text>
                  </View>
                  <View style={styles.resultDivider} />
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Costo</Text>
                    <Text style={styles.resultValue}>{formatCurrency(floorData.consumptionPrice)}</Text>
                  </View>
                  <View style={styles.resultDivider} />
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>IGV</Text>
                    <Text style={styles.resultValue}>{formatCurrency(floorData.igv)}</Text>
                  </View>
                </View>

                {(floorData.fixedCharge > 0) && (
                  <View style={styles.fixedChargeRow}>
                    <Text style={styles.fixedChargeLabel}>Cargo fijo</Text>
                    <Text style={styles.fixedChargeValue}>{formatCurrency(floorData.fixedCharge)}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.surplusToggle,
                    floorsPayingSurplus.has(floor.id) && styles.surplusToggleActive
                  ]}
                  onPress={() => toggleFloorSurplusPayment(floor.id)}
                  activeOpacity={0.7}
                >
                  {floorsPayingSurplus.has(floor.id) ? (
                    <Check size={14} color={colors.primary.main} weight="bold" />
                  ) : (
                    <View style={styles.surplusCheckEmpty} />
                  )}
                  <Text style={[
                    styles.surplusToggleText,
                    floorsPayingSurplus.has(floor.id) && styles.surplusToggleTextActive
                  ]}>
                    {floorsPayingSurplus.has(floor.id) ? 'Paga excedente' : 'No paga excedente'}
                  </Text>
                </TouchableOpacity>

                {floorData.surplus > 0 && (
                  <View style={styles.surplusRow}>
                    <Text style={styles.surplusLabel}>Excedente</Text>
                    <Text style={styles.surplusValue}>{formatCurrency(floorData.surplus)}</Text>
                  </View>
                )}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
                  <Text style={styles.totalValue}>{formatCurrency(floorData.totalToPay)}</Text>
                </View>
              </View>
            );
          })}
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Lightning size={20} color={colors.accent.orange} weight="fill" />
              <Text style={styles.sectionTitle} numberOfLines={1}>Luz</Text>
            </View>
            <TouchableOpacity
              style={[styles.receiptButton, uploadingImage && styles.receiptButtonDisabled]}
              onPress={() => pickReceiptImage('electricity')}
              disabled={uploadingImage}
              activeOpacity={0.7}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <>
                  <Camera size={14} color={colors.textInverse} weight="fill" />
                  <Text style={styles.receiptButtonText}>
                    {period.electricity.receiptPhoto ? 'Cambiar' : 'Recibo'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {period.electricity.receiptPhoto && (
            <TouchableOpacity
              style={styles.receiptPreview}
              onPress={() => viewReceipt(period.electricity.receiptPhoto!)}
              onLongPress={() => removeReceiptPhoto('electricity')}
              activeOpacity={0.8}
            >
              {period.electricity.receiptPhoto.type === 'image' ? (
                <Image
                  source={{ uri: period.electricity.receiptPhoto.uri }}
                  style={styles.receiptImage}
                />
              ) : (
                <View style={styles.pdfPreview}>
                  <FileText size={32} color={colors.accent.red} weight="duotone" />
                  <Text style={styles.pdfName} numberOfLines={1}>
                    {period.electricity.receiptPhoto.name}
                  </Text>
                </View>
              )}
              <Text style={styles.receiptHint}>Toca para ver · Mantén para eliminar</Text>
            </TouchableOpacity>
          )}

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Recibo Luz</Text>
              <DecimalInput
                style={styles.summaryInput}
                value={totalReceiptElectricity}
                onChangeText={setTotalReceiptElectricity}
                placeholder="0"
                showDotButton={true}
              />
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Medidores</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(period.floorsElectricity.reduce((sum, f) => sum + f.consumptionPrice + f.igv, 0))}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Excedente</Text>
              <Text style={[styles.summaryValue, period.electricity.surplus > 0 && styles.surplusPositive]}>
                {formatCurrency(period.electricity.surplus)}
              </Text>
            </View>
            {floorsPayingSurplus.size > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelSmall}>
                  Pagan excedente: {floorsPayingSurplus.size}
                </Text>
                <Text style={styles.summaryLabelSmall}>
                  S/ {(period.electricity.surplus / floorsPayingSurplus.size).toFixed(2)} c/u
                </Text>
              </View>
            )}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Total a Cobrar</Text>
              <Text style={styles.summaryValueBold}>{formatCurrency(totalElectricityToPay)}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Drop size={20} color={colors.accent.blue} weight="fill" />
              <View>
                <Text style={styles.sectionTitle}>Agua</Text>
                <Text style={styles.sectionSubtitle} numberOfLines={2}>Montos fijos + porcentajes del resto</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.receiptButton, uploadingImage && styles.receiptButtonDisabled]}
              onPress={() => pickReceiptImage('water')}
              disabled={uploadingImage}
              activeOpacity={0.7}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <>
                  <Camera size={14} color={colors.textInverse} weight="fill" />
                  <Text style={styles.receiptButtonText}>
                    {period.water.receiptPhoto ? 'Cambiar' : 'Recibo'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {period.water.receiptPhoto && (
            <TouchableOpacity
              style={styles.receiptPreview}
              onPress={() => viewReceipt(period.water.receiptPhoto!)}
              onLongPress={() => removeReceiptPhoto('water')}
              activeOpacity={0.8}
            >
              {period.water.receiptPhoto.type === 'image' ? (
                <Image
                  source={{ uri: period.water.receiptPhoto.uri }}
                  style={styles.receiptImage}
                />
              ) : (
                <View style={styles.pdfPreview}>
                  <FileText size={32} color={colors.accent.red} weight="duotone" />
                  <Text style={styles.pdfName} numberOfLines={1}>
                    {period.water.receiptPhoto.name}
                  </Text>
                </View>
              )}
              <Text style={styles.receiptHint}>Toca para ver · Mantén para eliminar</Text>
            </TouchableOpacity>
          )}

          <View style={styles.waterCard}>
            <View style={styles.waterTotalRow}>
              <Text style={styles.waterTotalLabel}>Total Recibo Agua</Text>
              <DecimalInput
                style={styles.waterTotalInput}
                value={totalReceiptWater}
                onChangeText={setTotalReceiptWater}
                placeholder="0"
                showDotButton={true}
              />
            </View>

            {period.floorsWater.length > 0 ? (
              period.floorsWater.map(floor => (
                <View key={floor.floorId} style={styles.waterFloorRow}>
                  <View style={styles.waterFloorLeft}>
                    <House size={14} color={colors.textMuted} weight="duotone" />
                    <Text style={styles.waterFloorName}>{floor.floorName}</Text>
                  </View>
                  <View style={styles.waterFloorRight}>
                    {floor.fixedAmount > 0 ? (
                      <Text style={styles.waterFloorFixed}>Fijo: S/ {floor.fixedAmount.toFixed(0)}</Text>
                    ) : null}
                    {floor.percentage > 0 ? (
                      <Text style={styles.waterFloorPercent}>{floor.percentage}%</Text>
                    ) : null}
                    <Text style={styles.waterFloorAmount}>{formatCurrency(floor.amount)}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.waterHintContainer}>
                <Drop size={20} color={colors.textMuted} weight="thin" />
                <Text style={styles.waterHint}>Presiona "Calcular" para distribuir</Text>
              </View>
            )}

            {period.floorsWater.length > 0 && (
              <View style={styles.waterTotalSummary}>
                <Text style={styles.waterTotalSummaryLabel}>TOTAL</Text>
                <Text style={styles.waterTotalSummaryValue}>{formatCurrency(totalWaterToPay)}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.sectionTitleRow}>
            <Lightning size={20} color={colors.primary.main} weight="duotone" />
            <Text style={styles.sectionTitle} numberOfLines={1}>Total por Piso</Text>
          </View>
          <Text style={styles.sectionSubtitle} numberOfLines={2}>Resumen de Luz + Agua</Text>

          <View style={styles.totalByFloorCard}>
            {settings?.floors.map(floor => {
              const electricityFloor = period.floorsElectricity.find(f => f.floorId === floor.id);
              const waterFloor = period.floorsWater.find(f => f.floorId === floor.id);
              const electricityAmount = electricityFloor?.totalToPay || 0;
              const waterAmount = waterFloor?.amount || 0;
              const totalAmount = electricityAmount + waterAmount;

              return (
                <View key={floor.id} style={styles.totalByFloorRow}>
                  <View style={styles.totalByFloorLeft}>
                    <House size={14} color={colors.textMuted} weight="duotone" />
                    <Text style={styles.totalByFloorName}>{floor.name}</Text>
                  </View>
                  <View style={styles.totalByFloorDetails}>
                    <View style={styles.totalByFloorTag}>
                      <Lightning size={10} color={colors.accent.orange} weight="fill" />
                      <Text style={styles.totalByFloorDetail}>{formatCurrency(electricityAmount)}</Text>
                    </View>
                    <View style={styles.totalByFloorTag}>
                      <Drop size={10} color={colors.accent.blue} weight="fill" />
                      <Text style={styles.totalByFloorDetail}>{formatCurrency(waterAmount)}</Text>
                    </View>
                  </View>
                  <Text style={styles.totalByFloorTotal}>{formatCurrency(totalAmount)}</Text>
                </View>
              );
            })}

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL GENERAL</Text>
              <Text style={styles.grandTotalValue}>
                {formatCurrency(
                  period.floorsElectricity.reduce((sum, f) => sum + f.totalToPay, 0) +
                  period.floorsWater.reduce((sum, f) => sum + f.amount, 0)
                )}
              </Text>
            </View>
          </View>
        </Animated.View>

        <TouchableOpacity style={styles.calculateButton} onPress={calculateAll} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.accent.orange, '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.calculateButtonGradient}
          >
            <Calculator size={20} color={colors.textInverse} weight="bold" />
            <Text style={styles.calculateButtonText}>Calcular Todo</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.exportButton} onPress={exportPeriod} activeOpacity={0.7}>
          <Export size={18} color={colors.textSecondary} weight="bold" />
          <Text style={styles.exportButtonText}>Exportar a CSV</Text>
        </TouchableOpacity>

        <View style={{ height: 200 }} />
      </ScrollView>

      {hasChanges && (
        <TouchableOpacity
          style={[styles.saveButton, { bottom: spacing[16] + insets.bottom }, saving && styles.saveButtonDisabled]}
          onPress={savePeriod}
          disabled={saving}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={saving ? [colors.textMuted, colors.textSecondary] : [colors.primary.main, colors.primary.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButtonGradient}
          >
            {saving ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <>
                <Check size={20} color={colors.textInverse} weight="bold" />
                <Text style={styles.saveButtonText}>Guardar</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      <Modal
        visible={imageModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModal({ visible: false, uri: '', type: 'image' })}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setImageModal({ visible: false, uri: '', type: 'image' })}
        >
          <View style={styles.modalContent}>
            <Image source={{ uri: imageModal.uri }} style={styles.modalImage} resizeMode="contain" />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setImageModal({ visible: false, uri: '', type: 'image' })}
              activeOpacity={0.7}
            >
              <X size={20} color={colors.textInverse} weight="bold" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={deleteReceiptDialogVisible}
        title="Eliminar recibo"
        message="¿Estás seguro de eliminar este recibo?"
        confirmText="Eliminar"
        onConfirm={confirmDeleteReceipt}
        onCancel={() => setDeleteReceiptDialogVisible(false)}
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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
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
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[16],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
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
    lineHeight: 20,
  },
  section: {
    padding: spacing[16],
    paddingTop: spacing[48],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing[12],
    marginLeft: spacing[6],
  },
  calculateButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floorCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing[16],
    marginBottom: spacing[12],
    ...shadows.md,
  },
  floorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: spacing[12],
  },
  floorName: {
    ...typography.label,
    color: colors.text,
  },
  readingRow: {
    flexDirection: 'row',
    gap: spacing[8],
    marginBottom: spacing[12],
  },
  readingInput: {
    flex: 1,
  },
  readingLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing[4],
  },
  input: {
    backgroundColor: colors.input.background,
    borderRadius: borderRadius.sm,
    padding: spacing[10],
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'center',
  },
  resultGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
    padding: spacing[12],
    marginBottom: spacing[12],
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
  },
  resultDivider: {
    width: 1,
    height: spacing[24],
    backgroundColor: colors.border,
  },
  resultLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  resultValue: {
    ...typography.captionMedium,
    color: colors.text,
    marginTop: spacing[2],
  },
  fixedChargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[12],
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.sm,
    padding: spacing[12],
  },
  fixedChargeLabel: {
    ...typography.bodySmall,
    color: colors.warning,
    fontWeight: '500',
  },
  fixedChargeValue: {
    ...typography.currencySmall,
    color: colors.warning,
  },
  surplusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
    padding: spacing[12],
    marginBottom: spacing[12],
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  surplusToggleActive: {
    backgroundColor: colors.primary.light,
    borderColor: colors.primary.main,
  },
  surplusCheckEmpty: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  surplusToggleText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textMuted,
  },
  surplusToggleTextActive: {
    color: colors.primary.dark,
  },
  surplusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[12],
    paddingHorizontal: spacing[4],
  },
  surplusLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  surplusValue: {
    ...typography.currencySmall,
    color: colors.warning,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.sm,
    padding: spacing[12],
  },
  totalLabel: {
    ...typography.captionMedium,
    color: colors.success,
  },
  totalValue: {
    ...typography.currency,
    fontSize: 16,
    color: colors.success,
    flexShrink: 1,
  },
  receiptButton: {
    backgroundColor: colors.accent.blue,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: borderRadius.full,
    gap: spacing[4],
  },
  receiptButtonDisabled: {
    opacity: 0.6,
  },
  receiptButtonText: {
    ...typography.captionMedium,
    color: colors.textInverse,
  },
  receiptPreview: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing[12],
    marginBottom: spacing[12],
    alignItems: 'center',
    ...shadows.sm,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.backgroundSecondary,
  },
  pdfPreview: {
    width: '100%',
    height: 60,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
  },
  pdfName: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  receiptHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[8],
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing[16],
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  summaryLabelSmall: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '500',
  },
  summaryLabelBold: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  summaryValue: {
    ...typography.currencySmall,
    color: colors.text,
  },
  summaryValueBold: {
    ...typography.currency,
    color: colors.accent.blue,
  },
  summaryInput: {
    backgroundColor: colors.input.background,
    borderRadius: borderRadius.sm,
    padding: spacing[2],
    ...typography.currencySmall,
    color: colors.text,
    textAlign: 'right',
    minWidth: 100,
  },
  surplusPositive: {
    color: colors.warning,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing[4],
  },
  waterCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing[16],
    ...shadows.sm,
  },
  waterTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[12],
    paddingBottom: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  waterTotalLabel: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  waterTotalInput: {
    backgroundColor: colors.infoLight,
    borderRadius: borderRadius.sm,
    padding: spacing[2],
    ...typography.currencySmall,
    color: colors.accent.blueDark,
    textAlign: 'right',
    minWidth: 120,
  },
  waterFloorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[10],
  },
  waterFloorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flex: 1,
  },
  waterFloorName: {
    ...typography.bodySmall,
    color: colors.text,
  },
  waterFloorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  waterFloorFixed: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  waterFloorPercent: {
    ...typography.caption,
    color: colors.textMuted,
    width: 40,
    textAlign: 'center',
  },
  waterFloorAmount: {
    ...typography.currencySmall,
    color: colors.accent.blueDark,
    width: 80,
    textAlign: 'right',
  },
  waterHintContainer: {
    alignItems: 'center',
    paddingVertical: spacing[20],
    gap: spacing[8],
  },
  waterHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  waterTotalSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[12],
    paddingTop: spacing[12],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  waterTotalSummaryLabel: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  waterTotalSummaryValue: {
    ...typography.currency,
    color: colors.accent.blue,
  },
  totalByFloorCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing[16],
    ...shadows.sm,
  },
  totalByFloorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  totalByFloorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  totalByFloorName: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  totalByFloorDetails: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[8],
  },
  totalByFloorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  totalByFloorDetail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  totalByFloorTotal: {
    ...typography.currencySmall,
    color: colors.success,
    minWidth: 80,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[12],
    paddingTop: spacing[12],
    borderTopWidth: 2,
    borderTopColor: colors.primary.main,
  },
  grandTotalLabel: {
    ...typography.label,
    color: colors.text,
  },
  grandTotalValue: {
    ...typography.currency,
    fontSize: 18,
    color: colors.primary.main,
    flexShrink: 1,
  },
  calculateButton: {
    marginHorizontal: spacing[16],
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.primary,
  },
  calculateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
    gap: spacing[8],
  },
  calculateButtonText: {
    ...typography.button,
    color: colors.textInverse,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    margin: spacing[16],
    marginTop: spacing[8],
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
    padding: spacing[14],
  },
  exportButtonText: {
    ...typography.buttonSmall,
    color: colors.textSecondary,
  },
  saveButton: {
    position: 'absolute',
    left: spacing[16],
    right: spacing[16],
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.lg,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[18],
    gap: spacing[8],
  },
  saveButtonText: {
    ...typography.button,
    color: colors.textInverse,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalCloseButton: {
    position: 'absolute',
    top: -spacing[20],
    right: -spacing[10],
    backgroundColor: colors.overlay,
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ExpenseDetailScreen;
