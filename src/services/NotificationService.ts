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

const MOTIVATIONAL_MESSAGES = {
  breakfast: [
    '¡Un buen desayuno es el mejor comienzo!',
    '¡Energía para empezar el día!',
    '¡El desayuno es la comida más importante!',
    '¡Dale a tu cuerpo el combustible que necesita!',
    '¡Día nuevo, desayuno nuevo!',
  ],
  lunch: [
    '¡Recarga energías para la tarde!',
    '¡Un buen almuerzo te mantiene productivo!',
    '¡Tu cuerpo te lo agradecerá!',
    '¡Momento de nutrirse bien!',
    '¡No saltes el almuerzo, te mereces comer bien!',
  ],
  dinner: [
    '¡Termina el día comiendo rico!',
    '¡Una cena ligera para descansar mejor!',
    '¡Disfruta tu última comida del día!',
    '¡Buen provecho para cerrar el día!',
    '¡Cena tranquilo, mañana será otro gran día!',
  ],
};

const getRandomMessage = (type: string): string => {
  const messages = MOTIVATIONAL_MESSAGES[type as keyof typeof MOTIVATIONAL_MESSAGES] || MOTIVATIONAL_MESSAGES.breakfast;
  return messages[Math.floor(Math.random() * messages.length)];
};

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
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('meal-reminders', {
        name: 'Recordatorios de Comidas',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4CAF50',
        sound: 'default',
      });
    }
    
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

// Meal reminder functions removed - meals feature was disabled
// export const scheduleMealReminder = async (meal: Meal, customMinutes?: number): Promise<string | null> => { ... }
// export const cancelMealReminder = async (mealId: string): Promise<void> => { ... }

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

export const QUICK_REMINDER_OPTIONS = [
  { label: 'Ahora', value: 0, icon: '⏰' },
  { label: '5 min', value: 5, icon: '⚡' },
  { label: '10 min', value: 10, icon: '⏱️' },
  { label: '15 min', value: 15, icon: '🕐' },
  { label: '30 min', value: 30, icon: '🕕' },
  { label: '1 hr', value: 60, icon: '🕐' },
  { label: '2 hrs', value: 120, icon: '🕑' },
];

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
