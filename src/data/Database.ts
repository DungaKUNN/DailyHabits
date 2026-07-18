import * as SQLite from 'expo-sqlite';

const LOG_PREFIX = '[Database]';

let db: SQLite.SQLiteDatabase;
let isInitialized = false;

export const initDatabase = async (): Promise<void> => {
  console.log(`${LOG_PREFIX} initDatabase - ini - isInitialized: ${isInitialized}`);
  if (isInitialized) {
    console.log(`${LOG_PREFIX} initDatabase - ya inicializado`);
    return;
  }
  
  db = await SQLite.openDatabaseAsync('dailyhabits.db');
  isInitialized = true;
  console.log(`${LOG_PREFIX} initDatabase - ok`);
};

export const getDatabase = (): SQLite.SQLiteDatabase => {
  console.log(`${LOG_PREFIX} getDatabase - ini`);
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  console.log(`${LOG_PREFIX} getDatabase - ok`);
  return db;
};
