import * as SQLite from 'expo-sqlite';
import { 
  FinancePeriod, 
  FinanceSettings, 
  FinanceIncome, 
  FinanceExpense,
  FinanceDebt,
  DEFAULT_FINANCE_SETTINGS 
} from '../../domain/entities/Finance';
import { IFinanceRepository } from '../../domain/repositories/IFinanceRepository';
import { generateId } from '../../utils/formatting';

const LOG_PREFIX = '[SQLiteFinanceRepo]';

export class SQLiteFinanceRepository implements IFinanceRepository {
  private db: SQLite.SQLiteDatabase;
  private ready: Promise<void>;

  constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
    this.ready = this.init();
  }

  private async init() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS finance_periods (
        id TEXT PRIMARY KEY,
        month TEXT NOT NULL,
        year INTEGER NOT NULL,
        monthName TEXT NOT NULL,
        income TEXT,
        expenses TEXT,
        debts TEXT,
        savings REAL DEFAULT 0,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS finance_settings (
        id TEXT PRIMARY KEY DEFAULT 'settings',
        incomeSources TEXT,
        expenseCategories TEXT,
        expenseSubcategories TEXT
      );
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_finance_periods_year_month ON finance_periods (year ASC, month ASC);
    `);
  }

  async getAllPeriods(): Promise<FinancePeriod[]> {
    await this.ready;
    const rows = await this.db.getAllAsync<any>('SELECT * FROM finance_periods ORDER BY year ASC, month ASC');
    return rows.map(row => this.mapRowToPeriod(row));
  }

  async getPeriodById(id: string): Promise<FinancePeriod | null> {
    await this.ready;
    const row = await this.db.getFirstAsync<any>('SELECT * FROM finance_periods WHERE id = ?', id);
    return row ? this.mapRowToPeriod(row) : null;
  }

  async getPeriodByMonth(month: string): Promise<FinancePeriod | null> {
    await this.ready;
    const row = await this.db.getFirstAsync<any>('SELECT * FROM finance_periods WHERE month = ?', month);
    return row ? this.mapRowToPeriod(row) : null;
  }

  async createPeriod(period: Omit<FinancePeriod, 'id' | 'createdAt' | 'updatedAt'>): Promise<FinancePeriod> {
    await this.ready;
    const id = generateId();
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO finance_periods (
        id, month, year, monthName, income, expenses, debts, savings, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      period.month,
      period.year,
      period.monthName,
      JSON.stringify(period.income || []),
      JSON.stringify(period.expenses || []),
      JSON.stringify(period.debts || []),
      period.savings || 0,
      period.notes || '',
      now,
      now
    );

    return {
      ...period,
      id,
      income: period.income || [],
      expenses: period.expenses || [],
      debts: period.debts || [],
      savings: period.savings || 0,
      notes: period.notes || '',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async updatePeriod(id: string, period: Partial<FinancePeriod>): Promise<FinancePeriod> {
    await this.ready;
    const existing = await this.getPeriodById(id);
    if (!existing) throw new Error('Period not found');

    const updates: string[] = [];
    const values: any[] = [];

    if (period.income !== undefined) {
      updates.push('income = ?');
      values.push(JSON.stringify(period.income));
    }

    if (period.expenses !== undefined) {
      updates.push('expenses = ?');
      values.push(JSON.stringify(period.expenses));
    }

    if (period.debts !== undefined) {
      updates.push('debts = ?');
      values.push(JSON.stringify(period.debts));
    }

    if (period.savings !== undefined) {
      updates.push('savings = ?');
      values.push(period.savings);
    }

    if (period.notes !== undefined) {
      updates.push('notes = ?');
      values.push(period.notes);
    }

    updates.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db.runAsync(
      `UPDATE finance_periods SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );

    return this.getPeriodById(id) as Promise<FinancePeriod>;
  }

  async deletePeriod(id: string): Promise<void> {
    await this.ready;
    await this.db.runAsync('DELETE FROM finance_periods WHERE id = ?', id);
  }

  async getSettings(): Promise<FinanceSettings> {
    await this.ready;
    const row = await this.db.getFirstAsync<any>('SELECT * FROM finance_settings WHERE id = "settings"');
    if (!row) {
      return DEFAULT_FINANCE_SETTINGS;
    }

    return {
      incomeSources: JSON.parse(row.incomeSources || '[]').length > 0 
        ? JSON.parse(row.incomeSources) 
        : DEFAULT_FINANCE_SETTINGS.incomeSources,
      expenseCategories: JSON.parse(row.expenseCategories || '[]').length > 0 
        ? JSON.parse(row.expenseCategories) 
        : DEFAULT_FINANCE_SETTINGS.expenseCategories,
      expenseSubcategories: JSON.parse(row.expenseSubcategories || '{}').length > 0 
        ? JSON.parse(row.expenseSubcategories) 
        : DEFAULT_FINANCE_SETTINGS.expenseSubcategories,
    };
  }

  async updateSettings(settings: FinanceSettings): Promise<void> {
    await this.ready;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO finance_settings (id, incomeSources, expenseCategories, expenseSubcategories)
       VALUES (?, ?, ?, ?)`,
      'settings',
      JSON.stringify(settings.incomeSources),
      JSON.stringify(settings.expenseCategories),
      JSON.stringify(settings.expenseSubcategories)
    );
  }

  private mapRowToPeriod(row: any): FinancePeriod {
    return {
      id: row.id,
      month: row.month,
      year: row.year,
      monthName: row.monthName,
      income: JSON.parse(row.income || '[]'),
      expenses: JSON.parse(row.expenses || '[]'),
      debts: JSON.parse(row.debts || '[]'),
      savings: row.savings || 0,
      notes: row.notes || '',
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
