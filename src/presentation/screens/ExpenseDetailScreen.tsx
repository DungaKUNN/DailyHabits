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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ExpensePeriod, ExpenseSettings, FloorElectricityReading, FloorWaterCost, ReceiptPhoto } from '../../domain/entities/Expense';
import { SQLiteExpenseRepository } from '../../data/repositories/SQLiteExpenseRepository';
import { getDatabase } from '../../data/Database';
import { getSavedGroupCode, savePeriodToCloud, getPeriodsFromCloud, getGroupSettings } from '../../services/SyncService';
import { colors } from '../theme/colors';
import { storage } from '../../services/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DecimalInput } from '../components/DecimalInput';

type ExpenseDetailRouteParams = {
  ExpenseDetail: {
    periodId: string;
  };
};

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
  
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadGroupCode();
    loadData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadGroupCode = async () => {
    const code = await getSavedGroupCode();
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

    // Distribuir excedente entre pisos que pagan (con redondeo controlado)
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

    Alert.alert(
      'Cálculo completado',
      `⚡ ELECTRICIDAD:\nTotal medidores: S/ ${totalFromMeters.toFixed(2)}\nTotal recibo: S/ ${receiptTotal.toFixed(2)}\nExcedente: S/ ${surplus.toFixed(2)}\n\n💧 AGUA:\nTotal recibo: S/ ${waterReceiptTotal.toFixed(2)}\nDistribuido: S/ ${totalWaterToPay.toFixed(2)}`
    );
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
    if (!period || saving) return;
    setSaving(true);
    setHasChanges(false);
    Alert.alert('Guardado', 'Datos actualizados correctamente');
    
    try {
      if (groupCode) {
        await savePeriodToCloud(groupCode, period);
      } else {
        const repo = new SQLiteExpenseRepository(getDatabase());
        await repo.updatePeriod(period.id, period);
      }
    } catch (error) {
      console.error('Error saving period:', error);
    } finally {
      setSaving(false);
    }
  };

  const exportPeriod = async () => {
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
      csvLines.push('                    ⚡ ELECTRICIDAD');
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
      csvLines.push('                       💧 AGUA');
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
      csvLines.push('                    💰 RESUMEN POR PISO');
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

    Alert.alert(
      'Eliminar recibo',
      '¿Estás seguro de eliminar este recibo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const updatedPeriod = {
              ...period,
              [type === 'electricity' ? 'electricity' : 'water']: {
                ...period[type === 'electricity' ? 'electricity' : 'water'],
                receiptPhoto: undefined,
              },
              updatedAt: new Date(),
            };
            setPeriod(updatedPeriod);
            setHasChanges(true);
          },
        },
      ]
    );
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

  const formatCurrency = (amount: number) => `S/ ${amount.toFixed(2)}`;

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (noData) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
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
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const totalElectricityToPay = period.floorsElectricity.reduce((sum, f) => sum + f.totalToPay, 0);
  const totalWaterToPay = period.floorsWater.reduce((sum, f) => sum + f.amount, 0);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f5f7fa" />
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>⚡ Electricidad - Lecturas por Piso</Text>
          <Text style={styles.sectionSubtitle}>
            Tarifa: S/ {settings.electricityTariffPerKwh}/kWh | IGV: {settings.igvPercentage}%
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
                <Text style={styles.floorName}>🏠 {floor.name}</Text>
                
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
                    <Text style={styles.resultLabel}>Real</Text>
                    <Text style={styles.resultValue}>{floorData.realReading.toFixed(1)} kWh</Text>
                  </View>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Consumo</Text>
                    <Text style={styles.resultValue}>{formatCurrency(floorData.consumptionPrice)}</Text>
                  </View>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>IGV</Text>
                    <Text style={styles.resultValue}>{formatCurrency(floorData.igv)}</Text>
                  </View>
                </View>

                {(floorData.fixedCharge > 0) && (
                  <View style={styles.fixedChargeRow}>
                    <Text style={styles.fixedChargeLabel}>Cargo fijo:</Text>
                    <Text style={styles.fixedChargeValue}>{formatCurrency(floorData.fixedCharge)}</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={[
                    styles.surplusToggle,
                    floorsPayingSurplus.has(floor.id) && styles.surplusToggleActive
                  ]}
                  onPress={() => toggleFloorSurplusPayment(floor.id)}
                >
                  <Text style={[
                    styles.surplusToggleText,
                    floorsPayingSurplus.has(floor.id) && styles.surplusToggleTextActive
                  ]}>
                    {floorsPayingSurplus.has(floor.id) ? '✓ Paga excedente' : 'No paga excedente'}
                  </Text>
                </TouchableOpacity>

                {floorData.surplus > 0 && (
                  <View style={styles.surplusRow}>
                    <Text style={styles.surplusLabel}>Excedente asignado:</Text>
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
            <Text style={styles.sectionTitle}>⚡ Luz</Text>
            <TouchableOpacity 
              style={[styles.receiptButton, uploadingImage && styles.receiptButtonDisabled]}
              onPress={() => pickReceiptImage('electricity')}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.receiptButtonIcon}>📸</Text>
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
            >
              {period.electricity.receiptPhoto.type === 'image' ? (
                <Image 
                  source={{ uri: period.electricity.receiptPhoto.uri }} 
                  style={styles.receiptImage}
                />
              ) : (
                <View style={styles.pdfPreview}>
                  <Text style={styles.pdfIcon}>📄</Text>
                  <Text style={styles.pdfName} numberOfLines={1}>
                    {period.electricity.receiptPhoto.name}
                  </Text>
                </View>
              )}
              <Text style={styles.receiptHint}>Toca para ver • Mantén para eliminar</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Recibo Luz:</Text>
              <DecimalInput
                style={styles.summaryInput}
                value={totalReceiptElectricity}
                onChangeText={setTotalReceiptElectricity}
                placeholder="0"
                showDotButton={true}
              />
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Medidores:</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(period.floorsElectricity.reduce((sum, f) => sum + f.consumptionPrice + f.igv, 0))}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Excedente:</Text>
              <Text style={[styles.summaryValue, period.electricity.surplus > 0 && styles.surplusPositive]}>
                {formatCurrency(period.electricity.surplus)}
              </Text>
            </View>
            {floorsPayingSurplus.size > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelSmall}>
                  Pisos que pagan excedente: {floorsPayingSurplus.size}
                </Text>
                <Text style={styles.summaryLabelSmall}>
                  S/ {(period.electricity.surplus / floorsPayingSurplus.size).toFixed(2)} c/u
                </Text>
              </View>
            )}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Total a Cobrar:</Text>
              <Text style={styles.summaryValueBold}>{formatCurrency(totalElectricityToPay)}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>💧 Agua</Text>
              <Text style={styles.sectionSubtitle}>Montos fijos + porcentajes del resto</Text>
            </View>
            <TouchableOpacity 
              style={[styles.receiptButton, uploadingImage && styles.receiptButtonDisabled]}
              onPress={() => pickReceiptImage('water')}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.receiptButtonIcon}>📸</Text>
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
            >
              {period.water.receiptPhoto.type === 'image' ? (
                <Image 
                  source={{ uri: period.water.receiptPhoto.uri }} 
                  style={styles.receiptImage}
                />
              ) : (
                <View style={styles.pdfPreview}>
                  <Text style={styles.pdfIcon}>📄</Text>
                  <Text style={styles.pdfName} numberOfLines={1}>
                    {period.water.receiptPhoto.name}
                  </Text>
                </View>
              )}
              <Text style={styles.receiptHint}>Toca para ver • Mantén para eliminar</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.waterCard}>
            <View style={styles.waterTotalRow}>
              <Text style={styles.waterTotalLabel}>Total Recibo Agua:</Text>
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
                  <Text style={styles.waterFloorName}>🏠 {floor.floorName}</Text>
                  {floor.fixedAmount > 0 ? (
                    <Text style={styles.waterFloorFixed}>Fijo: S/ {floor.fixedAmount.toFixed(0)}</Text>
                  ) : null}
                  {floor.percentage > 0 ? (
                    <Text style={styles.waterFloorPercent}>{floor.percentage}%</Text>
                  ) : null}
                  <Text style={styles.waterFloorAmount}>{formatCurrency(floor.amount)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.waterHint}>Presiona "Calcular" para distribuir</Text>
            )}

            {period.floorsWater.length > 0 && (
              <View style={styles.waterTotalSummary}>
                <Text style={styles.waterTotalSummaryLabel}>TOTAL:</Text>
                <Text style={styles.waterTotalSummaryValue}>{formatCurrency(totalWaterToPay)}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>💰 Total por Piso</Text>
          <Text style={styles.sectionSubtitle}>Resumen de Luz + Agua</Text>
          
          <View style={styles.totalByFloorCard}>
            {settings?.floors.map(floor => {
              const electricityFloor = period.floorsElectricity.find(f => f.floorId === floor.id);
              const waterFloor = period.floorsWater.find(f => f.floorId === floor.id);
              const electricityAmount = electricityFloor?.totalToPay || 0;
              const waterAmount = waterFloor?.amount || 0;
              const totalAmount = electricityAmount + waterAmount;
              
              return (
                <View key={floor.id} style={styles.totalByFloorRow}>
                  <Text style={styles.totalByFloorName}>🏠 {floor.name}</Text>
                  <View style={styles.totalByFloorDetails}>
                    <Text style={styles.totalByFloorDetail}>Luz: {formatCurrency(electricityAmount)}</Text>
                    <Text style={styles.totalByFloorDetail}>Agua: {formatCurrency(waterAmount)}</Text>
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

        <TouchableOpacity style={styles.calculateButton} onPress={calculateAll}>
          <LinearGradient
            colors={['#FF9800', '#F57C00']}
            style={styles.calculateButtonGradient}
          >
            <Text style={styles.calculateButtonText}>🧮 Calcular Todo</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.exportButton} onPress={exportPeriod}>
          <Text style={styles.exportButtonText}>📤 Exportar a CSV</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {hasChanges && (
        <TouchableOpacity 
          style={[styles.saveButton, { bottom: 16 + insets.bottom }, saving && styles.saveButtonDisabled]} 
          onPress={savePeriod}
          disabled={saving}
        >
          <LinearGradient
            colors={saving ? ['#999', '#777'] : ['#4CAF50', '#388E3C']}
            style={styles.saveButtonGradient}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>💾 Guardar</Text>
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
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
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
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 50,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    color: colors.textMuted,
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
  section: {
    padding: 16,
    paddingTop: 50,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary.main,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  floorCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  floorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  readingRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  readingInput: {
    flex: 1,
  },
  readingLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
  },
  resultGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  resultItem: {
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 11,
    color: '#666',
  },
  resultValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  fixedChargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 10,
  },
  fixedChargeLabel: {
    fontSize: 13,
    color: '#e65100',
    fontWeight: '500',
  },
  fixedChargeValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#e65100',
  },
  surplusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  surplusLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  surplusValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#e65100',
  },
  surplusToggle: {
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  surplusToggleActive: {
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
  },
  surplusToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  surplusToggleTextActive: {
    color: '#e65100',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 12,
  },
  totalLabel: {
    fontSize: 13,
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryLabelSmall: {
    fontSize: 12,
    color: '#e65100',
    fontWeight: '500',
  },
  summaryLabelBold: {
    fontSize: 15,
    color: '#333',
    fontWeight: 'bold',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  summaryValueBold: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  summaryInput: {
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
    minWidth: 100,
  },
  surplusPositive: {
    color: '#e65100',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  waterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    elevation: 2,
  },
  waterTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  waterTotalLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  waterTotalInput: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
    textAlign: 'right',
    minWidth: 120,
  },
  waterFloorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  waterFloorName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  waterFloorFixed: {
    fontSize: 12,
    color: '#e65100',
    fontWeight: '600',
    marginHorizontal: 4,
  },
  waterFloorPercent: {
    fontSize: 13,
    color: '#666',
    width: 50,
    textAlign: 'center',
  },
  waterFloorAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
    width: 80,
    textAlign: 'right',
  },
  waterHint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  waterTotalSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  waterTotalSummaryLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: 'bold',
  },
  waterTotalSummaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  totalByFloorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    elevation: 2,
  },
  totalByFloorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  totalByFloorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 80,
  },
  totalByFloorDetails: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  totalByFloorDetail: {
    fontSize: 11,
    color: '#666',
  },
  totalByFloorTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    width: 90,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#4CAF50',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  calculateButton: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
  },
  calculateButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  exportButton: {
    margin: 16,
    marginTop: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  exportButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
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
  },
  saveButtonDisabled: {
    opacity: 0.7,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  receiptButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  receiptButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  receiptButtonIcon: {
    fontSize: 14,
  },
  receiptButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  receiptPreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  receiptImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  pdfPreview: {
    width: '100%',
    height: 80,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pdfIcon: {
    fontSize: 32,
  },
  pdfName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  receiptHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
    top: -20,
    right: -10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default ExpenseDetailScreen;
