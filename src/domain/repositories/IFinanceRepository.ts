import { FinancePeriod, FinanceSettings } from '../entities/Finance';

export interface IFinanceRepository {
  getAllPeriods(): Promise<FinancePeriod[]>;
  getPeriodById(id: string): Promise<FinancePeriod | null>;
  getPeriodByMonth(month: string): Promise<FinancePeriod | null>;
  createPeriod(period: Omit<FinancePeriod, 'id' | 'createdAt' | 'updatedAt'>): Promise<FinancePeriod>;
  updatePeriod(id: string, period: Partial<FinancePeriod>): Promise<FinancePeriod>;
  deletePeriod(id: string): Promise<void>;
  getSettings(): Promise<FinanceSettings>;
  updateSettings(settings: FinanceSettings): Promise<void>;
}
