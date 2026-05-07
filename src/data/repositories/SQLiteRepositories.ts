import { Meal, DailyPlan } from '../../domain/entities/Meal';
import { IMealRepository, IDailyPlanRepository } from '../../domain/repositories/IMealRepository';
import * as SQLite from 'expo-sqlite';

const generateId = () => Math.random().toString(36).substring(2, 15);

export class SQLiteMealRepository implements IMealRepository {
  private db: SQLite.SQLiteDatabase;

  constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
    this.init();
  }

  private async init() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS meals (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        calories INTEGER,
        completed INTEGER DEFAULT 0,
        scheduledTime TEXT,
        date TEXT NOT NULL,
        reminderMinutes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  }

  async getAll(): Promise<Meal[]> {
    const rows = await this.db.getAllAsync<any>('SELECT * FROM meals ORDER BY scheduledTime');
    return rows.map(row => this.mapRowToMeal(row));
  }

  async getById(id: string): Promise<Meal | null> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM meals WHERE id = ?', id);
    return row ? this.mapRowToMeal(row) : null;
  }

  async getByDate(date: string): Promise<Meal[]> {
    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM meals WHERE date = ? ORDER BY scheduledTime',
      date
    );
    return rows.map(row => this.mapRowToMeal(row));
  }

  async create(meal: Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Meal> {
    const id = generateId();
    const now = new Date().toISOString();
    
    await this.db.runAsync(
      `INSERT INTO meals (id, type, name, description, calories, completed, scheduledTime, date, reminderMinutes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      meal.type,
      meal.name,
      meal.description || null,
      meal.calories || null,
      meal.completed ? 1 : 0,
      meal.scheduledTime,
      meal.scheduledTime.split('T')[0],
      meal.reminderMinutes ? JSON.stringify(meal.reminderMinutes) : null,
      now,
      now
    );

    return {
      ...meal,
      id,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async update(id: string, meal: Partial<Meal>): Promise<Meal> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Meal not found');

    const updates: string[] = [];
    const values: any[] = [];

    if (meal.name !== undefined) { updates.push('name = ?'); values.push(meal.name); }
    if (meal.description !== undefined) { updates.push('description = ?'); values.push(meal.description); }
    if (meal.calories !== undefined) { updates.push('calories = ?'); values.push(meal.calories); }
    if (meal.completed !== undefined) { updates.push('completed = ?'); values.push(meal.completed ? 1 : 0); }
    if (meal.scheduledTime !== undefined) { updates.push('scheduledTime = ?'); values.push(meal.scheduledTime); }
    if (meal.reminderMinutes !== undefined) { updates.push('reminderMinutes = ?'); values.push(meal.reminderMinutes ? JSON.stringify(meal.reminderMinutes) : null); }
    
    updates.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db.runAsync(
      `UPDATE meals SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );

    return this.getById(id) as Promise<Meal>;
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM meals WHERE id = ?', id);
  }

  async toggleComplete(id: string): Promise<Meal> {
    const meal = await this.getById(id);
    if (!meal) throw new Error('Meal not found');
    return this.update(id, { completed: !meal.completed });
  }

  private mapRowToMeal(row: any): Meal {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      description: row.description,
      calories: row.calories,
      completed: row.completed === 1,
      scheduledTime: row.scheduledTime,
      reminderMinutes: row.reminderMinutes ? JSON.parse(row.reminderMinutes) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

export class SQLiteDailyPlanRepository implements IDailyPlanRepository {
  private db: SQLite.SQLiteDatabase;
  private mealRepo: SQLiteMealRepository;

  constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
    this.mealRepo = new SQLiteMealRepository(db);
  }

  async getByDate(date: string): Promise<DailyPlan | null> {
    const meals = await this.mealRepo.getByDate(date);
    if (meals.length === 0) return null;

    return {
      id: date,
      date,
      meals,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getByDateRange(startDate: string, endDate: string): Promise<DailyPlan[]> {
    const rows = await this.db.getAllAsync<any>(
      `SELECT DISTINCT date FROM meals WHERE date >= ? AND date <= ? ORDER BY date`,
      startDate,
      endDate
    );

    const plans: DailyPlan[] = [];
    for (const row of rows) {
      const plan = await this.getByDate(row.date);
      if (plan) plans.push(plan);
    }
    return plans;
  }

  async create(plan: Omit<DailyPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<DailyPlan> {
    return {
      ...plan,
      id: plan.date,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async update(date: string, plan: Partial<DailyPlan>): Promise<DailyPlan> {
    const existing = await this.getByDate(date);
    if (!existing) throw new Error('Plan not found');
    return { ...existing, ...plan, updatedAt: new Date() };
  }

  async delete(date: string): Promise<void> {
    await this.db.runAsync('DELETE FROM meals WHERE date = ?', date);
  }

  async addMealToPlan(date: string, meal: Meal): Promise<DailyPlan> {
    const existing = await this.getByDate(date);
    if (!existing) {
      return this.create({ date, meals: [meal] });
    }
    return this.update(date, { meals: [...existing.meals, meal] });
  }

  async removeMealFromPlan(date: string, mealId: string): Promise<DailyPlan> {
    const existing = await this.getByDate(date);
    if (!existing) throw new Error('Plan not found');
    return this.update(date, { meals: existing.meals.filter(m => m.id !== mealId) });
  }
}
