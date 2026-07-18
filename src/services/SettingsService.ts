const LOG_PREFIX = '[SettingsService]';

export interface NotificationSettings {
  enabled: boolean;
  reminderMinutes: number;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  reminderMinutes: 30,
  soundEnabled: true,
  vibrateEnabled: true,
};

export { DEFAULT_SETTINGS };
