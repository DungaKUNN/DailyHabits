import * as SQLite from 'expo-sqlite';
import { SQLiteExpenseRepository } from './repositories/SQLiteExpenseRepository';

let db: SQLite.SQLiteDatabase;
let isInitialized = false;

export const initDatabase = async (): Promise<void> => {
  if (isInitialized) return;
  
  db = await SQLite.openDatabaseAsync('dailyhabits.db');
  isInitialized = true;
};

export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
};

export const getExpenseRepository = (): SQLiteExpenseRepository => {
  return new SQLiteExpenseRepository(getDatabase());
};
