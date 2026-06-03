import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getNotificationSettings } from './SettingsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_PREFIX = '[NotificationService]';

let isInitialized = false;

const PAYMENT_REMINDER_KEY = '@payment_reminders_enabled';
const PAYMENT_REMINDER_HOUR = '@payment_reminder_hour';
const PAYMENT_REMINDER_MINUTE = '@payment_reminder_minute';
const PAYMENT_REMINDER_DAYS = '@payment_reminder_days';

const initNotifications = async () => {
  console.log(`${LOG_PREFIX} initNotifications - ini - isInitialized: ${isInitialized}`);
  if (isInitialized) {
    console.log(`${LOG_PREFIX} initNotifications - ya inicializado`);
    return;
  }
  
  try {
    console.log(`${LOG_PREFIX} initNotifications - configurando handler`);
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize notification handler:', error);
  }
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    await initNotifications();
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
};

export const cancelAllReminders = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error:', error);
  }
};

export const getScheduledReminders = async () => {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};

export interface PaymentReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  days: number[];
}

export const getDefaultPaymentReminderSettings = (): PaymentReminderSettings => ({
  enabled: false,
  hour: 9,
  minute: 0,
  days: [1, 2, 3, 4, 5],
});

export const getPaymentReminderSettings = async (): Promise<PaymentReminderSettings> => {
  try {
    const [enabledStr, hourStr, minuteStr, daysStr] = await Promise.all([
      AsyncStorage.getItem(PAYMENT_REMINDER_KEY),
      AsyncStorage.getItem(PAYMENT_REMINDER_HOUR),
      AsyncStorage.getItem(PAYMENT_REMINDER_MINUTE),
      AsyncStorage.getItem(PAYMENT_REMINDER_DAYS),
    ]);
    
    return {
      enabled: enabledStr === 'true',
      hour: hourStr ? parseInt(hourStr) : 9,
      minute: minuteStr ? parseInt(minuteStr) : 0,
      days: daysStr ? JSON.parse(daysStr) : [1, 2, 3, 4, 5],
    };
  } catch (error) {
    console.error('Error getting payment reminder settings:', error);
    return getDefaultPaymentReminderSettings();
  }
};

export const savePaymentReminderSettings = async (settings: PaymentReminderSettings): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.setItem(PAYMENT_REMINDER_KEY, settings.enabled.toString()),
      AsyncStorage.setItem(PAYMENT_REMINDER_HOUR, settings.hour.toString()),
      AsyncStorage.setItem(PAYMENT_REMINDER_MINUTE, settings.minute.toString()),
      AsyncStorage.setItem(PAYMENT_REMINDER_DAYS, JSON.stringify(settings.days)),
    ]);
  } catch (error) {
    console.error('Error saving payment reminder settings:', error);
  }
};

export const schedulePaymentReminders = async (): Promise<void> => {
  try {
    await initNotifications();
    
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('No notification permissions for payment reminders');
      return;
    }

    const settings = await getPaymentReminderSettings();
    
    if (!settings.enabled) {
      console.log('Payment reminders disabled');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('payment-reminders', {
        name: 'Recordatorios de Pago',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF9800',
        sound: 'default',
      });
    }

    await cancelPaymentReminders();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();

    for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
      const targetMonth = (currentMonth + monthOffset) % 12;
      const targetYear = currentYear + Math.floor((currentMonth + monthOffset) / 12);

      for (const day of settings.days) {
        const reminderDate = new Date(targetYear, targetMonth, day, settings.hour, settings.minute, 0);
        
        if (monthOffset === 0 && day <= currentDay) {
          continue;
        }

        const secondsFromNow = Math.floor((reminderDate.getTime() - now.getTime()) / 1000);
        
        if (secondsFromNow <= 0) {
          continue;
        }

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        await Notifications.scheduleNotificationAsync({
          content: {
            title: '💡 Recordatorio de Pago',
            body: `¡No olvides registrar los recibos de Luz y Agua de ${monthNames[targetMonth]}!`,
            data: { 
              type: 'payment-reminder',
              month: targetMonth,
              year: targetYear,
            },
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            seconds: secondsFromNow,
            channelId: 'payment-reminders',
          },
        });
      }
    }

    console.log('✅ Payment reminders scheduled');
  } catch (error) {
    console.error('Error scheduling payment reminders:', error);
  }
};

export const cancelPaymentReminders = async (): Promise<void> => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduled) {
      if (notification.content.data?.type === 'payment-reminder') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
    console.log('Payment reminders cancelled');
  } catch (error) {
    console.error('Error cancelling payment reminders:', error);
  }
};
