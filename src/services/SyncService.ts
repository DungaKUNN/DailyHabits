import { db } from './firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpensePeriod, ExpenseSettings, FloorElectricityReading, FloorWaterCost, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_SOURCES } from '../domain/entities/Expense';

const GROUP_CODE_KEY = '@group_code';
const GROUP_NAME_KEY = '@group_name';

export const generateGroupCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const getSavedGroupCode = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(GROUP_CODE_KEY);
  } catch (error) {
    console.error('Error getting group code:', error);
    return null;
  }
};

export const getSavedGroupName = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(GROUP_NAME_KEY);
  } catch (error) {
    console.error('Error getting group name:', error);
    return null;
  }
};

export const saveGroupCode = async (code: string, name: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(GROUP_CODE_KEY, code);
    await AsyncStorage.setItem(GROUP_NAME_KEY, name);
  } catch (error) {
    console.error('Error saving group code:', error);
  }
};

export const clearGroupCode = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(GROUP_CODE_KEY);
    await AsyncStorage.removeItem(GROUP_NAME_KEY);
  } catch (error) {
    console.error('Error clearing group code:', error);
  }
};

export const createGroup = async (groupName: string, existingSettings?: ExpenseSettings): Promise<string> => {
  const code = generateGroupCode();
  const groupRef = doc(db, 'groups', code);
  
  const defaultSettings: ExpenseSettings = {
    floors: [
      { id: '1', name: 'Piso 1', hasElectricityMeter: true, waterPercentage: 20, waterFixedAmount: 0, igvPercentage: undefined as any, fixedCharge: 0 },
      { id: '2', name: 'Piso 2', hasElectricityMeter: true, waterPercentage: 20, waterFixedAmount: 0, igvPercentage: undefined as any, fixedCharge: 0 },
      { id: '3', name: 'Piso 3', hasElectricityMeter: true, waterPercentage: 20, waterFixedAmount: 0, igvPercentage: undefined as any, fixedCharge: 0 },
      { id: '4', name: 'Piso 4', hasElectricityMeter: true, waterPercentage: 20, waterFixedAmount: 0, igvPercentage: undefined as any, fixedCharge: 0 },
      { id: '5', name: 'Piso 5', hasElectricityMeter: true, waterPercentage: 20, waterFixedAmount: 0, igvPercentage: undefined as any, fixedCharge: 0 },
    ],
    electricityTariffPerKwh: 0.66,
    igvPercentage: 18,
    waterTotalPercentage: 100,
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    incomeSources: DEFAULT_INCOME_SOURCES,
  };
  
  await setDoc(groupRef, {
    name: groupName,
    createdAt: Timestamp.now(),
    settings: existingSettings || defaultSettings,
  });
  
  await saveGroupCode(code, groupName);
  return code;
};

export const joinGroup = async (code: string): Promise<{ success: boolean; name?: string; error?: string }> => {
  try {
    const groupRef = doc(db, 'groups', code.toUpperCase());
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
      return { success: false, error: 'Código no encontrado' };
    }
    
    const groupData = groupSnap.data();
    await saveGroupCode(code.toUpperCase(), groupData.name);
    
    return { success: true, name: groupData.name };
  } catch (error) {
    console.error('Error joining group:', error);
    return { success: false, error: 'Error al conectar' };
  }
};

export const getGroupSettings = async (code: string): Promise<ExpenseSettings | null> => {
  try {
    const groupRef = doc(db, 'groups', code);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) return null;
    
    const data = groupSnap.data();
    return data.settings as ExpenseSettings;
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
};

export const updateGroupSettings = async (code: string, settings: ExpenseSettings): Promise<void> => {
  try {
    const groupRef = doc(db, 'groups', code);
    
    const cleanValue = (value: any): any => {
      if (value === undefined) return undefined;
      if (value === null) return undefined;
      if (Array.isArray(value)) {
        const cleaned = value.map(cleanValue).filter(v => v !== undefined);
        return cleaned.length > 0 ? cleaned : undefined;
      }
      if (typeof value === 'object') {
        const cleaned = Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, cleanValue(v)]).filter(([_, v]) => v !== undefined)
        );
        return Object.keys(cleaned).length > 0 ? cleaned : undefined;
      }
      return value;
    };
    
    const cleanSettings = cleanValue(settings);
    if (cleanSettings) {
      await setDoc(groupRef, { settings: cleanSettings }, { merge: true });
    }
  } catch (error) {
    console.error('Error updating settings:', error);
  }
};

export const savePeriodToCloud = async (groupCode: string, period: ExpensePeriod): Promise<void> => {
  try {
    const periodRef = doc(db, 'groups', groupCode, 'periods', period.id);
    
    const cleanValue = (value: any): any => {
      if (value === undefined) return undefined;
      if (value === null) return undefined;
      if (Array.isArray(value)) {
        const cleaned = value.map(cleanValue).filter(v => v !== undefined);
        return cleaned.length > 0 ? cleaned : undefined;
      }
      if (typeof value === 'object') {
        const cleaned = Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, cleanValue(v)]).filter(([_, v]) => v !== undefined)
        );
        return Object.keys(cleaned).length > 0 ? cleaned : undefined;
      }
      return value;
    };
    
    const cleanPeriod = cleanValue(period);
    if (cleanPeriod) {
      await setDoc(periodRef, {
        ...cleanPeriod,
        createdAt: Timestamp.fromDate(period.createdAt),
        updatedAt: Timestamp.fromDate(period.updatedAt),
      });
    }
  } catch (error) {
    console.error('Error saving period:', error);
  }
};

export const getPeriodsFromCloud = async (groupCode: string): Promise<ExpensePeriod[]> => {
  try {
    const periodsRef = collection(db, 'groups', groupCode, 'periods');
    const querySnapshot = await getDocs(periodsRef);
    
    const periods: ExpensePeriod[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      periods.push({
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as ExpensePeriod);
    });
    
    return periods.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return parseInt(b.month.split('-')[1]) - parseInt(a.month.split('-')[1]);
    });
  } catch (error) {
    console.error('Error getting periods:', error);
    return [];
  }
};

export const deletePeriodFromCloud = async (groupCode: string, periodId: string): Promise<void> => {
  try {
    const periodRef = doc(db, 'groups', groupCode, 'periods', periodId);
    await deleteDoc(periodRef);
  } catch (error) {
    console.error('Error deleting period:', error);
  }
};

export const subscribeToPeriods = (
  groupCode: string, 
  callback: (periods: ExpensePeriod[]) => void
): (() => void) => {
  const periodsRef = collection(db, 'groups', groupCode, 'periods');
  
  return onSnapshot(periodsRef, (snapshot) => {
    const periods: ExpensePeriod[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      periods.push({
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as ExpensePeriod);
    });
    
    periods.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return parseInt(b.month.split('-')[1]) - parseInt(a.month.split('-')[1]);
    });
    
    callback(periods);
  });
};

export const subscribeToSettings = (
  groupCode: string,
  callback: (settings: ExpenseSettings) => void
): (() => void) => {
  const groupRef = doc(db, 'groups', groupCode);
  
  return onSnapshot(groupRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data.settings as ExpenseSettings);
    }
  });
};

export const migrateLocalDataToCloud = async (
  groupCode: string,
  periods: ExpensePeriod[],
  settings: ExpenseSettings
): Promise<void> => {
  try {
    await updateGroupSettings(groupCode, settings);
    
    for (const period of periods) {
      await savePeriodToCloud(groupCode, period);
    }
  } catch (error) {
    console.error('Error migrating data:', error);
  }
};
