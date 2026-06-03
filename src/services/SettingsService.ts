import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_PREFIX = '[SettingsService]';
const SETTINGS_KEY = '@notification_settings';

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
  console.log(`${LOG_PREFIX} getNotificationSettings - ini`);
  try {
    const settings = await AsyncStorage.getItem(SETTINGS_KEY);
    console.log(`${LOG_PREFIX} getNotificationSettings - found: ${!!settings}`);
    if (settings) {
      console.log(`${LOG_PREFIX} getNotificationSettings - ok`);
      return { ...DEFAULT_SETTINGS, ...JSON.parse(settings) };
    }
    console.log(`${LOG_PREFIX} getNotificationSettings - default`);
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error(`${LOG_PREFIX} getNotificationSettings - error:`, error);
    return DEFAULT_SETTINGS;
  }
};

export const saveNotificationSettings = async (settings: NotificationSettings): Promise<void> => {
  console.log(`${LOG_PREFIX} saveNotificationSettings - ini`);
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    console.log(`${LOG_PREFIX} saveNotificationSettings - ok`);
  } catch (error) {
    console.error(`${LOG_PREFIX} saveNotificationSettings - error:`, error);
  }
};

export const toggleNotifications = async (enabled: boolean): Promise<void> => {
  console.log(`${LOG_PREFIX} toggleNotifications - ini - enabled: ${enabled}`);
  const settings = await getNotificationSettings();
  settings.enabled = enabled;
  await saveNotificationSettings(settings);
  console.log(`${LOG_PREFIX} toggleNotifications - fin`);
};

export const setReminderMinutes = async (minutes: number): Promise<void> => {
  console.log(`${LOG_PREFIX} setReminderMinutes - ini - minutes: ${minutes}`);
  const settings = await getNotificationSettings();
  settings.reminderMinutes = minutes;
  await saveNotificationSettings(settings);
  console.log(`${LOG_PREFIX} setReminderMinutes - fin`);
};

