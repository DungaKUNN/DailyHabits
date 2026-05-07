import AsyncStorage from '@react-native-async-storage/async-storage';
import { MONETIZATION_CONFIG } from './MonetizationConfig';

const PREMIUM_KEY = '@premium_status';
const EXPIRY_DATE_KEY = '@premium_expiry_date';

// 获取 Premium 状态
export const getPremiumStatus = async (): Promise<boolean> => {
  try {
    const premium = await AsyncStorage.getItem(PREMIUM_KEY);
    if (premium !== 'true') return false;
    
    // 检查是否过期
    const expiryDateStr = await AsyncStorage.getItem(EXPIRY_DATE_KEY);
    if (expiryDateStr) {
      const expiryDate = new Date(expiryDateStr);
      if (expiryDate < new Date()) {
        // 已过期，设置非Premium
        await setPremiumStatus(false);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error getting premium status:', error);
    return false;
  }
};

// 设置 Premium 状态（模拟购买）
export const setPremiumStatus = async (isPremium: boolean, expiryDate?: Date): Promise<void> => {
  try {
    await AsyncStorage.setItem(PREMIUM_KEY, isPremium ? 'true' : 'false');
    if (expiryDate) {
      await AsyncStorage.setItem(EXPIRY_DATE_KEY, expiryDate.toISOString());
    } else if (!isPremium) {
      await AsyncStorage.removeItem(EXPIRY_DATE_KEY);
    }
  } catch (error) {
    console.error('Error setting premium status:', error);
  }
};

// 检查是否显示广告（如果不是Premium则显示）
export const shouldShowAds = async (): Promise<boolean> => {
  const isPremium = await getPremiumStatus();
  return !isPremium;
};

// 模拟购买Premium（用于测试）
export const purchasePremium = async (): Promise<boolean> => {
  try {
    // 计算下个月到期日
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    
    await setPremiumStatus(true, expiryDate);
    return true;
  } catch (error) {
    console.error('Error purchasing premium:', error);
    return false;
  }
};

// 恢复购买
export const restorePurchases = async (): Promise<boolean> => {
  try {
    // 在真实应用中，这里会调用RevenueCat或Google Play的API来验证购买
    // 目前只是返回当前状态
    const isPremium = await getPremiumStatus();
    return isPremium;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return false;
  }
};

// 获取广告ID
export const getBannerAdUnitId = (): string => {
  return MONETIZATION_CONFIG.ADMOB.BANNER_AD_UNIT_ID;
};

export const getInterstitialAdUnitId = (): string => {
  return MONETIZATION_CONFIG.ADMOB.INTERSTITIAL_AD_UNIT_ID;
};

// 显示插页式广告
export const showInterstitialAd = async (): Promise<void> => {
  // TODO: 实现插页式广告
  console.log('Interstitial ad would show here');
};

// 初始化广告
export const initializeAds = async (): Promise<void> => {
  // TODO: 初始化AdMob
  console.log('Ads initialized');
};
