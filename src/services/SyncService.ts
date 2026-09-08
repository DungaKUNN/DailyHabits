import { db } from './firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpensePeriod, ExpenseSettings, FloorElectricityReading, FloorWaterCost, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_SOURCES, normalizeExpensePeriod, normalizeExpenseSettings } from '../domain/entities/Expense';

const GROUP_CODE_KEY = '@group_code';
const GROUP_NAME_KEY = '@group_name';

const LOG_PREFIX = '[SyncService]';

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
    const code = await AsyncStorage.getItem(GROUP_CODE_KEY);
    return code;
  } catch (error) {
    console.error(`${LOG_PREFIX} getSavedGroupCode - error:`, error);
    return null;
  }
};

export const getSavedGroupName = async (): Promise<string | null> => {
  try {
    const name = await AsyncStorage.getItem(GROUP_NAME_KEY);
    return name;
  } catch (error) {
    console.error(`${LOG_PREFIX} getSavedGroupName - error:`, error);
    return null;
  }
};

export const saveGroupCode = async (code: string, name: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(GROUP_CODE_KEY, code);
    await AsyncStorage.setItem(GROUP_NAME_KEY, name);
  } catch (error) {
    console.error(`${LOG_PREFIX} saveGroupCode - error:`, error);
  }
};

export const clearGroupCode = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(GROUP_CODE_KEY);
    await AsyncStorage.removeItem(GROUP_NAME_KEY);
  } catch (error) {
    console.error(`${LOG_PREFIX} clearGroupCode - error:`, error);
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
    console.error(`${LOG_PREFIX} joinGroup - error:`, error);
    return { success: false, error: 'Error al conectar' };
  }
};

export const getGroupSettings = async (code: string): Promise<ExpenseSettings | null> => {
  try {
    const groupRef = doc(db, 'groups', code);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
      return null;
    }
    
    const data = groupSnap.data();
    return normalizeExpenseSettings(data.settings as ExpenseSettings | undefined);
  } catch (error) {
    console.error(`${LOG_PREFIX} getGroupSettings - error:`, error);
    return null;
  }
};

export const updateGroupSettings = async (code: string, settings: ExpenseSettings): Promise<void> => {
  const groupRef = doc(db, 'groups', code);

  const cleanSettings = cleanValue(settings);
  if (cleanSettings) {
    await setDoc(groupRef, { settings: cleanSettings }, { merge: true });
  }
};

export const savePeriodToCloud = async (groupCode: string, period: ExpensePeriod): Promise<void> => {
  const periodRef = doc(db, 'groups', groupCode, 'periods', period.id);

  const cleanPeriod = cleanValue(period);
  if (cleanPeriod) {
    await setDoc(periodRef, {
      ...cleanPeriod,
      createdAt: Timestamp.fromDate(period.createdAt),
      updatedAt: Timestamp.fromDate(period.updatedAt),
    });
  }
};

export const getPeriodsFromCloud = async (groupCode: string): Promise<ExpensePeriod[]> => {
  const periodsRef = collection(db, 'groups', groupCode, 'periods');
  const querySnapshot = await getDocs(periodsRef);

  const periods: ExpensePeriod[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const rawPeriod = {
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
    };
    const normalized = normalizeExpensePeriod(rawPeriod);
    if (normalized.month) {
      periods.push(normalized);
    }
  });

  return periods.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return parseInt(b.month.split('-')[1]) - parseInt(a.month.split('-')[1]);
  });
};

export const getPeriodFromCloud = async (groupCode: string, periodId: string): Promise<ExpensePeriod | null> => {
  try {
    const periodRef = doc(db, 'groups', groupCode, 'periods', periodId);
    const snap = await getDoc(periodRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    const rawPeriod = {
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
    };
    return normalizeExpensePeriod(rawPeriod);
  } catch (error) {
    return null;
  }
};

export const deletePeriodFromCloud = async (groupCode: string, periodId: string): Promise<void> => {
  const periodRef = doc(db, 'groups', groupCode, 'periods', periodId);
  await deleteDoc(periodRef);
};

export const migrateLocalDataToCloud = async (
  groupCode: string,
  periods: ExpensePeriod[],
  settings: ExpenseSettings
): Promise<void> => {
  try {
    await updateGroupSettings(groupCode, settings);
  } catch (error) {
    console.error(`${LOG_PREFIX} migrateLocalDataToCloud - error guardando settings:`, error);
  }

  let savedCount = 0;
  for (const period of periods) {
    try {
      await savePeriodToCloud(groupCode, period);
      savedCount++;
    } catch (error) {
      console.error(`${LOG_PREFIX} migrateLocalDataToCloud - error período ${period.id}:`, error);
    }
  }
};
