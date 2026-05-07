import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = '@user_profile';

export interface UserProfile {
  name: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  currency: string;
}

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  email: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  preferences: {
    theme: 'light',
    language: 'es',
    currency: 'PEN',
  },
};

export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const profile = await AsyncStorage.getItem(PROFILE_KEY);
    if (profile) {
      return { ...DEFAULT_PROFILE, ...JSON.parse(profile) };
    }
    return DEFAULT_PROFILE;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return DEFAULT_PROFILE;
  }
};

export const saveUserProfile = async (profile: Partial<UserProfile>): Promise<void> => {
  try {
    const currentProfile = await getUserProfile();
    const updatedProfile = {
      ...currentProfile,
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
  } catch (error) {
    console.error('Error saving user profile:', error);
  }
};

export const updateUserName = async (name: string): Promise<void> => {
  await saveUserProfile({ name });
};

export const updateUserPreferences = async (
  preferences: Partial<UserPreferences>
): Promise<void> => {
  const currentProfile = await getUserProfile();
  await saveUserProfile({
    preferences: { ...currentProfile.preferences, ...preferences },
  });
};

export const initializeProfile = async (): Promise<void> => {
  const existingProfile = await AsyncStorage.getItem(PROFILE_KEY);
  if (!existingProfile) {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(DEFAULT_PROFILE));
  }
};
