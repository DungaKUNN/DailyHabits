import { ExpensePeriod, ExpenseSettings, Floor, FloorElectricityReading, FloorWaterCost, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_SOURCES } from '../../domain/entities/Expense';
import { IExpenseRepository } from '../../domain/repositories/IExpenseRepository';
import * as SQLite from 'expo-sqlite';

const generateId = () => Math.random().toString(36).substring(2, 15);

export class SQLiteExpenseRepository implements IExpenseRepository {
  private db: SQLite.SQLiteDatabase;

  constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
    this.init();
  }

  private async init() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS expense_periods (
        id TEXT PRIMARY KEY,
        month TEXT NOT NULL,
        year INTEGER NOT NULL,
        monthName TEXT NOT NULL,
        electricityTariffPerKwh REAL,
        electricityIgvPercentage REAL,
        electricityTotalReceipt REAL,
        electricityTotalFromMeters REAL,
        electricitySurplus REAL,
        electricitySurplusToDistribute REAL,
        waterTotalReceipt REAL,
        floorsElectricity TEXT,
        floorsWater TEXT,
        otherExpenses TEXT,
        income TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS expense_settings (
        id TEXT PRIMARY KEY DEFAULT 'settings',
        floors TEXT,
        electricityTariffPerKwh REAL,
        igvPercentage REAL,
        waterTotalPercentage REAL,
        expenseCategories TEXT,
        incomeSources TEXT
      );
    `);
  }

  async getAllPeriods(): Promise<ExpensePeriod[]> {
    const rows = await this.db.getAllAsync<any>('SELECT * FROM expense_periods ORDER BY year DESC, month DESC');
    return rows.map(row => this.mapRowToPeriod(row));
  }

  async getPeriodById(id: string): Promise<ExpensePeriod | null> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM expense_periods WHERE id = ?', id);
    return row ? this.mapRowToPeriod(row) : null;
  }

  async getPeriodByMonth(month: string): Promise<ExpensePeriod | null> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM expense_periods WHERE month = ?', month);
    return row ? this.mapRowToPeriod(row) : null;
  }

  async getLatestPeriod(): Promise<ExpensePeriod | null> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM expense_periods ORDER BY year DESC, month DESC LIMIT 1');
    return row ? this.mapRowToPeriod(row) : null;
  }

  getLatestReadingsFromPeriod(period: ExpensePeriod): Map<string, number> {
    const readings = new Map<string, number>();
    period.floorsElectricity.forEach(floor => {
      readings.set(floor.floorId, floor.currentReading);
    });
    return readings;
  }

  async createPeriod(period: Omit<ExpensePeriod, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpensePeriod> {
    const id = generateId();
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO expense_periods (
        id, month, year, monthName,
        electricityTariffPerKwh, electricityIgvPercentage, electricityTotalReceipt,
        electricityTotalFromMeters, electricitySurplus, electricitySurplusToDistribute,
        waterTotalReceipt, floorsElectricity, floorsWater, otherExpenses, income, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      period.month,
      period.year,
      period.monthName,
      period.electricity.tariffPerKwh,
      period.electricity.igvPercentage,
      period.electricity.totalReceipt,
      period.electricity.totalFromMeters,
      period.electricity.surplus,
      period.electricity.surplusToDistribute,
      period.water.totalReceipt,
      JSON.stringify(period.floorsElectricity),
      JSON.stringify(period.floorsWater),
      JSON.stringify(period.otherExpenses || []),
      JSON.stringify(period.income || []),
      now,
      now
    );

    return {
      ...period,
      id,
      otherExpenses: period.otherExpenses || [],
      income: period.income || [],
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  async updatePeriod(id: string, period: Partial<ExpensePeriod>): Promise<ExpensePeriod> {
    const existing = await this.getPeriodById(id);
    if (!existing) throw new Error('Period not found');

    const updates: string[] = [];
    const values: any[] = [];

    if (period.electricity) {
      updates.push('electricityTariffPerKwh = ?');
      values.push(period.electricity.tariffPerKwh);
      updates.push('electricityIgvPercentage = ?');
      values.push(period.electricity.igvPercentage);
      updates.push('electricityTotalReceipt = ?');
      values.push(period.electricity.totalReceipt);
      updates.push('electricityTotalFromMeters = ?');
      values.push(period.electricity.totalFromMeters);
      updates.push('electricitySurplus = ?');
      values.push(period.electricity.surplus);
      updates.push('electricitySurplusToDistribute = ?');
      values.push(period.electricity.surplusToDistribute);
    }

    if (period.water) {
      updates.push('waterTotalReceipt = ?');
      values.push(period.water.totalReceipt);
    }

    if (period.floorsElectricity) {
      updates.push('floorsElectricity = ?');
      values.push(JSON.stringify(period.floorsElectricity));
    }

    if (period.floorsWater) {
      updates.push('floorsWater = ?');
      values.push(JSON.stringify(period.floorsWater));
    }

    if (period.otherExpenses) {
      updates.push('otherExpenses = ?');
      values.push(JSON.stringify(period.otherExpenses));
    }

    if (period.income) {
      updates.push('income = ?');
      values.push(JSON.stringify(period.income));
    }

    updates.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db.runAsync(
      `UPDATE expense_periods SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );

    return this.getPeriodById(id) as Promise<ExpensePeriod>;
  }

  async deletePeriod(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM expense_periods WHERE id = ?', id);
  }

  async getSettings(): Promise<ExpenseSettings> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM expense_settings WHERE id = "settings"');
    if (!row) {
      return {
        floors: [
          { id: '1', name: 'Piso 1', hasElectricityMeter: true, waterPercentage: 20, waterFixedAmount: 0, fixedCharge: 0 },
          { id: '2', name: 'Piso 2', hasElectricityMeter: true, waterPercentage: 20, waterFixedAmount: 0, fixedCharge: 0 },
          { id: '3', name: 'Piso 3', hasElectricityMeter: true, waterPercentage: 20, waterFixedAmount: 0, fixedCharge: 0 },
          { id: '4', name: 'Piso 4', hasElectricityMeter: true, waterPercentage: 20, waterFixedAmount: 0, fixedCharge: 0 },
          { id: '5', name: 'Piso 5', hasElectricityMeter: true, waterPercentage: 20, waterFixedAmount: 0, fixedCharge: 0 },
        ],
        electricityTariffPerKwh: 0.66,
        igvPercentage: 18,
        waterTotalPercentage: 100,
        expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
        incomeSources: DEFAULT_INCOME_SOURCES,
      };
    }

    return {
      floors: JSON.parse(row.floors || '[]').map((f: any) => ({
        id: f.id,
        name: f.name || 'Piso',
        hasElectricityMeter: f.hasElectricityMeter !== false,
        waterPercentage: f.waterPercentage ?? 0,
        waterFixedAmount: f.waterFixedAmount ?? 0,
        fixedCharge: f.fixedCharge ?? 0,
      })),
      electricityTariffPerKwh: row.electricityTariffPerKwh || 0.66,
      igvPercentage: row.igvPercentage || 18,
      waterTotalPercentage: row.waterTotalPercentage || 100,
      expenseCategories: JSON.parse(row.expenseCategories || '[]').length > 0 
        ? JSON.parse(row.expenseCategories) 
        : DEFAULT_EXPENSE_CATEGORIES,
      incomeSources: JSON.parse(row.incomeSources || '[]').length > 0 
        ? JSON.parse(row.incomeSources) 
        : DEFAULT_INCOME_SOURCES,
    };
  }

  async updateSettings(settings: ExpenseSettings): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO expense_settings (id, floors, electricityTariffPerKwh, igvPercentage, waterTotalPercentage, expenseCategories, incomeSources)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'settings',
      JSON.stringify(settings.floors),
      settings.electricityTariffPerKwh,
      settings.igvPercentage,
      settings.waterTotalPercentage,
      JSON.stringify(settings.expenseCategories || DEFAULT_EXPENSE_CATEGORIES),
      JSON.stringify(settings.incomeSources || DEFAULT_INCOME_SOURCES)
    );
  }

  async exportToCSV(periodId: string): Promise<string> {
    const period = await this.getPeriodById(periodId);
    if (!period) throw new Error('Period not found');

    const lines: string[] = [];
    
    lines.push(['Período:', period.monthName, period.year].join(' '));
    lines.push('');
    lines.push(['ELECTRICIDAD'].join(','));
    lines.push(['Tarifa por kWh:', `S/ ${period.electricity.tariffPerKwh}`].join(','));
    lines.push(['IGV:', `${period.electricity.igvPercentage}%`].join(','));
    lines.push(['Total Recibo:', `S/ ${period.electricity.totalReceipt.toFixed(2)}`].join(','));
    lines.push('');
    lines.push(['Piso', 'Lect. Anterior', 'Lect. Actual', 'Lect. Real', 'Consumo S/', 'IGV S/', 'Excedente S/', 'Total S/'].join(','));
    
    period.floorsElectricity.forEach(f => {
      lines.push([
        f.floorName,
        f.previousReading.toFixed(1),
        f.currentReading.toFixed(1),
        f.realReading.toFixed(1),
        f.consumptionPrice.toFixed(2),
        f.igv.toFixed(2),
        f.surplus.toFixed(2),
        f.totalToPay.toFixed(2)
      ].join(','));
    });
    
    lines.push('');
    lines.push(['AGUA'].join(','));
    lines.push(['Total Recibo:', `S/ ${period.water.totalReceipt.toFixed(2)}`].join(','));
    lines.push('');
    lines.push(['Piso', 'Monto Fijo S/', 'Porcentaje %', 'Total S/'].join(','));
    
    period.floorsWater.forEach(f => {
      lines.push([f.floorName, f.fixedAmount.toFixed(2), f.percentage.toFixed(1), f.amount.toFixed(2)].join(','));
    });

    return lines.join('\n');
  }

  calculateElectricityForFloor(
    previousReading: number,
    currentReading: number,
    tariffPerKwh: number,
    igvPercentage: number,
    fixedCharge: number = 0,
    surplus: number = 0
  ): Omit<FloorElectricityReading, 'floorId' | 'floorName'> {
    const realReading = currentReading - previousReading;
    const consumptionPrice = realReading * tariffPerKwh;
    const igv = consumptionPrice * (igvPercentage / 100);
    const totalToPay = consumptionPrice + igv + fixedCharge + surplus;

    return {
      previousReading,
      currentReading,
      realReading,
      consumptionPrice,
      igv,
      fixedCharge,
      surplus,
      paysSurplus: false,
      totalToPay,
    };
  }

  calculateWaterForFloors(
    totalReceipt: number,
    floors: { floorId: string; floorName: string; percentage: number; fixedAmount: number }[]
  ): FloorWaterCost[] {
    const totalFixed = floors.reduce((sum, f) => sum + (f.fixedAmount || 0), 0);
    const remaining = totalReceipt - totalFixed;
    const totalPercentage = floors.reduce((sum, f) => sum + (f.percentage || 0), 0);
    
    return floors.map(f => {
      const amountFromPercentage = totalPercentage > 0 
        ? remaining * ((f.percentage || 0) / totalPercentage) 
        : 0;
      return {
        floorId: f.floorId,
        floorName: f.floorName,
        percentage: f.percentage || 0,
        fixedAmount: f.fixedAmount || 0,
        amount: (f.fixedAmount || 0) + amountFromPercentage,
      };
    });
  }

  private mapRowToPeriod(row: any): ExpensePeriod {
    return {
      id: row.id,
      month: row.month,
      year: row.year,
      monthName: row.monthName,
      electricity: {
        tariffPerKwh: row.electricityTariffPerKwh,
        igvPercentage: row.electricityIgvPercentage,
        totalReceipt: row.electricityTotalReceipt || 0,
        totalFromMeters: row.electricityTotalFromMeters || 0,
        surplus: row.electricitySurplus || 0,
        surplusToDistribute: row.electricitySurplusToDistribute || 0,
      },
      water: {
        totalReceipt: row.waterTotalReceipt || 0,
      },
      floorsElectricity: JSON.parse(row.floorsElectricity || '[]'),
      floorsWater: JSON.parse(row.floorsWater || '[]'),
      otherExpenses: JSON.parse(row.otherExpenses || '[]'),
      income: JSON.parse(row.income || '[]'),
      savedSettings: {
        floors: [],
        electricityTariffPerKwh: row.electricityTariffPerKwh || 0.66,
        igvPercentage: row.electricityIgvPercentage || 18,
        waterTotalPercentage: 100,
        expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
        incomeSources: DEFAULT_INCOME_SOURCES,
      },
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
