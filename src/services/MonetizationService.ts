import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_PREFIX = '[MonetizationService]';
const PREMIUM_KEY = '@premium_status';
const EXPIRY_DATE_KEY = '@premium_expiry_date';

export const getPremiumStatus = async (): Promise<boolean> => {
  console.log(`${LOG_PREFIX} getPremiumStatus - ini`);
  try {
    const premium = await AsyncStorage.getItem(PREMIUM_KEY);
    if (premium !== 'true') {
      return false;
    }
    
    const expiryDateStr = await AsyncStorage.getItem(EXPIRY_DATE_KEY);
    if (expiryDateStr) {
      const expiryDate = new Date(expiryDateStr);
      if (expiryDate < new Date()) {
        await setPremiumStatus(false);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} getPremiumStatus - error:`, error);
    return false;
  }
};

const setPremiumStatus = async (isPremium: boolean, expiryDate?: Date): Promise<void> => {
  console.log(`${LOG_PREFIX} setPremiumStatus - ini - isPremium: ${isPremium}`);
  try {
    await AsyncStorage.setItem(PREMIUM_KEY, isPremium ? 'true' : 'false');
    if (expiryDate) {
      await AsyncStorage.setItem(EXPIRY_DATE_KEY, expiryDate.toISOString());
    } else if (!isPremium) {
      await AsyncStorage.removeItem(EXPIRY_DATE_KEY);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} setPremiumStatus - error:`, error);
  }
};

export const purchasePremium = async (): Promise<boolean> => {
  console.log(`${LOG_PREFIX} purchasePremium - ini`);
  try {
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    
    await setPremiumStatus(true, expiryDate);
    return true;
  } catch (error) {
    console.error('Error purchasing premium:', error);
    return false;
  }
};

export const restorePurchases = async (): Promise<boolean> => {
  try {
    const isPremium = await getPremiumStatus();
    return isPremium;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return false;
  }
};
