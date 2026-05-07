import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@notification_settings';
const PREMIUM_KEY = '@premium_status';

export interface NotificationSettings {
  enabled: boolean;
  reminderMinutes: number; // minutos antes de la comida
  soundEnabled: boolean;
  vibrateEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  reminderMinutes: 30,
  soundEnabled: true,
  vibrateEnabled: true,
};

export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  try {
    const settings = await AsyncStorage.getItem(SETTINGS_KEY);
    if (settings) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(settings) };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveNotificationSettings = async (settings: NotificationSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving notification settings:', error);
  }
};

export const toggleNotifications = async (enabled: boolean): Promise<void> => {
  const settings = await getNotificationSettings();
  settings.enabled = enabled;
  await saveNotificationSettings(settings);
};

export const setReminderMinutes = async (minutes: number): Promise<void> => {
  const settings = await getNotificationSettings();
  settings.reminderMinutes = minutes;
  await saveNotificationSettings(settings);
};

// Premium functions
export const getPremiumStatus = async (): Promise<boolean> => {
  try {
    const premium = await AsyncStorage.getItem(PREMIUM_KEY);
    return premium === 'true';
  } catch (error) {
    console.error('Error getting premium status:', error);
    return false;
  }
};

export const setPremiumStatus = async (isPremium: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(PREMIUM_KEY, isPremium ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting premium status:', error);
  }
};
