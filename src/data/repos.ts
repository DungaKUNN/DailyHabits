import { getDatabase } from './Database';
import { SQLiteExpenseRepository } from './repositories/SQLiteExpenseRepository';
import { SQLiteFinanceRepository } from './repositories/SQLiteFinanceRepository';

let expenseRepo: SQLiteExpenseRepository | null = null;
let financeRepo: SQLiteFinanceRepository | null = null;

/**
 * Singleton de repositorios.
 * Antes se hacía `new SQLiteXRepository(getDatabase())` en cada
 * operación, lo que ejecutaba CREATE TABLE dos veces por llamada
 * y disparaba decenas de console.log. Reutilizar la instancia
 * elimina ese costo en cada navegación / tecla / guardado.
 */
export const getExpenseRepo = (): SQLiteExpenseRepository => {
  if (!expenseRepo) expenseRepo = new SQLiteExpenseRepository(getDatabase());
  return expenseRepo;
};

export const getFinanceRepo = (): SQLiteFinanceRepository => {
  if (!financeRepo) financeRepo = new SQLiteFinanceRepository(getDatabase());
  return financeRepo;
};

export const resetRepos = (): void => {
  expenseRepo = null;
  financeRepo = null;
};
