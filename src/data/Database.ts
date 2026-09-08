import * as SQLite from 'expo-sqlite';

const LOG_PREFIX = '[Database]';

let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

export const initDatabase = async (): Promise<void> => {
  if (isInitialized && db) {
    return;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      db = await SQLite.openDatabaseAsync('dailyhabits.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
      `);
      isInitialized = true;
    } catch (error) {
      console.error(`${LOG_PREFIX} initDatabase - error:`, error);
      db = null;
      isInitialized = false;
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
};

export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!db || !isInitialized) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
};

export const resetDatabase = (): void => {
  db = null;
  isInitialized = false;
  initPromise = null;
};
