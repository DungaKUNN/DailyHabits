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

const LOG_PREFIX = '[SyncService]';

export const generateGroupCode = (): string => {
  console.log(`${LOG_PREFIX} generateGroupCode`);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  console.log(`${LOG_PREFIX} generateGroupCode - code: ${code}`);
  return code;
};

export const getSavedGroupCode = async (): Promise<string | null> => {
  try {
    console.log(`${LOG_PREFIX} getSavedGroupCode - ini`);
    const code = await AsyncStorage.getItem(GROUP_CODE_KEY);
    console.log(`${LOG_PREFIX} getSavedGroupCode - code: ${code}`);
    return code;
  } catch (error) {
    console.error(`${LOG_PREFIX} getSavedGroupCode - error:`, error);
    return null;
  }
};

export const getSavedGroupName = async (): Promise<string | null> => {
  try {
    console.log(`${LOG_PREFIX} getSavedGroupName - ini`);
    const name = await AsyncStorage.getItem(GROUP_NAME_KEY);
    console.log(`${LOG_PREFIX} getSavedGroupName - name: ${name}`);
    return name;
  } catch (error) {
    console.error(`${LOG_PREFIX} getSavedGroupName - error:`, error);
    return null;
  }
};

export const saveGroupCode = async (code: string, name: string): Promise<void> => {
  try {
    console.log(`${LOG_PREFIX} saveGroupCode - ini - code: ${code}, name: ${name}`);
    await AsyncStorage.setItem(GROUP_CODE_KEY, code);
    await AsyncStorage.setItem(GROUP_NAME_KEY, name);
    console.log(`${LOG_PREFIX} saveGroupCode - ok`);
  } catch (error) {
    console.error(`${LOG_PREFIX} saveGroupCode - error:`, error);
  }
};

export const clearGroupCode = async (): Promise<void> => {
  try {
    console.log(`${LOG_PREFIX} clearGroupCode - ini`);
    await AsyncStorage.removeItem(GROUP_CODE_KEY);
    await AsyncStorage.removeItem(GROUP_NAME_KEY);
    console.log(`${LOG_PREFIX} clearGroupCode - ok`);
  } catch (error) {
    console.error(`${LOG_PREFIX} clearGroupCode - error:`, error);
  }
};

export const createGroup = async (groupName: string, existingSettings?: ExpenseSettings): Promise<string> => {
  console.log(`${LOG_PREFIX} createGroup - ini - groupName: ${groupName}`);
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
  
  console.log(`${LOG_PREFIX} createGroup - firebase setDoc - code: ${code}`);
  await setDoc(groupRef, {
    name: groupName,
    createdAt: Timestamp.now(),
    settings: existingSettings || defaultSettings,
  });
  
  await saveGroupCode(code, groupName);
  console.log(`${LOG_PREFIX} createGroup - ok - code: ${code}`);
  return code;
};

export const joinGroup = async (code: string): Promise<{ success: boolean; name?: string; error?: string }> => {
  try {
    console.log(`${LOG_PREFIX} joinGroup - ini - code: ${code}`);
    const groupRef = doc(db, 'groups', code.toUpperCase());
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
      console.log(`${LOG_PREFIX} joinGroup - código no encontrado`);
      return { success: false, error: 'Código no encontrado' };
    }
    
    const groupData = groupSnap.data();
    console.log(`${LOG_PREFIX} joinGroup - grupo encontrado: ${groupData.name}`);
    await saveGroupCode(code.toUpperCase(), groupData.name);
    
    return { success: true, name: groupData.name };
  } catch (error) {
    console.error(`${LOG_PREFIX} joinGroup - error:`, error);
    return { success: false, error: 'Error al conectar' };
  }
};

export const getGroupSettings = async (code: string): Promise<ExpenseSettings | null> => {
  try {
    console.log(`${LOG_PREFIX} getGroupSettings - ini - code: ${code}`);
    const groupRef = doc(db, 'groups', code);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
      console.log(`${LOG_PREFIX} getGroupSettings - no existe`);
      return null;
    }
    
    const data = groupSnap.data();
    console.log(`${LOG_PREFIX} getGroupSettings - ok`);
    return data.settings as ExpenseSettings;
  } catch (error) {
    console.error(`${LOG_PREFIX} getGroupSettings - error:`, error);
    return null;
  }
};

export const updateGroupSettings = async (code: string, settings: ExpenseSettings): Promise<void> => {
  try {
    console.log(`${LOG_PREFIX} updateGroupSettings - ini - code: ${code}`);
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
    console.log(`${LOG_PREFIX} updateGroupSettings - ok`);
  } catch (error) {
    console.error(`${LOG_PREFIX} updateGroupSettings - error:`, error);
  }
};

export const savePeriodToCloud = async (groupCode: string, period: ExpensePeriod): Promise<void> => {
  console.log(`${LOG_PREFIX} savePeriodToCloud - ini - groupCode: ${groupCode}, period: ${period.id}`);
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
    console.log(`${LOG_PREFIX} savePeriodToCloud - ok`);
  } catch (error) {
    console.error(`${LOG_PREFIX} savePeriodToCloud - error:`, error);
  }
};

export const getPeriodsFromCloud = async (groupCode: string): Promise<ExpensePeriod[]> => {
  console.log(`${LOG_PREFIX} getPeriodsFromCloud - ini - groupCode: ${groupCode}`);
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
    
    console.log(`${LOG_PREFIX} getPeriodsFromCloud - found: ${periods.length}`);
    return periods.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return parseInt(b.month.split('-')[1]) - parseInt(a.month.split('-')[1]);
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} getPeriodsFromCloud - error:`, error);
    return [];
  }
};

export const deletePeriodFromCloud = async (groupCode: string, periodId: string): Promise<void> => {
  console.log(`${LOG_PREFIX} deletePeriodFromCloud - ini - groupCode: ${groupCode}, periodId: ${periodId}`);
  try {
    const periodRef = doc(db, 'groups', groupCode, 'periods', periodId);
    await deleteDoc(periodRef);
    console.log(`${LOG_PREFIX} deletePeriodFromCloud - ok`);
  } catch (error) {
    console.error(`${LOG_PREFIX} deletePeriodFromCloud - error:`, error);
  }
};

export const subscribeToPeriods = (
  groupCode: string, 
  callback: (periods: ExpensePeriod[]) => void
): (() => void) => {
  console.log(`${LOG_PREFIX} subscribeToPeriods - ini - groupCode: ${groupCode}`);
  const periodsRef = collection(db, 'groups', groupCode, 'periods');
  
  return onSnapshot(periodsRef, (snapshot) => {
    console.log(`${LOG_PREFIX} subscribeToPeriods - callback - docs: ${snapshot.size}`);
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
  console.log(`${LOG_PREFIX} subscribeToSettings - ini - groupCode: ${groupCode}`);
  const groupRef = doc(db, 'groups', groupCode);
  
return onSnapshot(groupRef, (snapshot) => {
      console.log(`${LOG_PREFIX} subscribeToSettings - callback - exists: ${snapshot.exists()}`);
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
  console.log(`${LOG_PREFIX} migrateLocalDataToCloud - ini - groupCode: ${groupCode}, periods: ${periods.length}`);
  try {
    await updateGroupSettings(groupCode, settings);
    console.log(`${LOG_PREFIX} migrateLocalDataToCloud - settings guardados`);
    
    for (const period of periods) {
      await savePeriodToCloud(groupCode, period);
    }
    console.log(`${LOG_PREFIX} migrateLocalDataToCloud - ok`);
  } catch (error) {
    console.error(`${LOG_PREFIX} migrateLocalDataToCloud - error:`, error);
    console.error('Error migrating data:', error);
  }
};
