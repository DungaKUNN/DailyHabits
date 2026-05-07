import { ExpensePeriod, ExpenseSettings, FloorElectricityReading, FloorWaterCost } from '../entities/Expense';

export interface IExpenseRepository {
  getAllPeriods(): Promise<ExpensePeriod[]>;
  getPeriodById(id: string): Promise<ExpensePeriod | null>;
  getPeriodByMonth(month: string): Promise<ExpensePeriod | null>;
  createPeriod(period: Omit<ExpensePeriod, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpensePeriod>;
  updatePeriod(id: string, period: Partial<ExpensePeriod>): Promise<ExpensePeriod>;
  deletePeriod(id: string): Promise<void>;
  
  getSettings(): Promise<ExpenseSettings>;
  updateSettings(settings: ExpenseSettings): Promise<void>;
  
  calculateElectricityForFloor(
    previousReading: number,
    currentReading: number,
    tariffPerKwh: number,
    igvPercentage: number,
    surplus?: number
  ): Omit<FloorElectricityReading, 'floorId' | 'floorName'>;
  
  calculateWaterForFloors(
    totalReceipt: number,
    floors: { floorId: string; floorName: string; percentage: number }[]
  ): FloorWaterCost[];
  
  exportToCSV(periodId: string): Promise<string>;
}
