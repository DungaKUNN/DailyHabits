export interface Floor {
  id: string;
  name: string;
  hasElectricityMeter: boolean;
  waterPercentage: number;
  waterFixedAmount: number;
  igvPercentage?: number;
  fixedCharge: number;
}

export interface FloorElectricityReading {
  floorId: string;
  floorName: string;
  previousReading: number;
  currentReading: number;
  realReading: number;
  consumptionPrice: number;
  igv: number;
  fixedCharge: number;
  surplus: number;
  paysSurplus: boolean;
  totalToPay: number;
}

export interface FloorWaterCost {
  floorId: string;
  floorName: string;
  percentage: number;
  fixedAmount: number;
  amount: number;
}

export interface ReceiptPhoto {
  uri: string;
  type: 'image' | 'pdf';
  name: string;
  uploadedAt: Date;
}

export interface OtherExpense {
  id: string;
  category: string;
  description: string;
  amount: number;
}

export interface MonthlyIncome {
  id: string;
  source: string;
  amount: number;
}

export interface ExpensePeriod {
  id: string;
  month: string;
  year: number;
  monthName: string;
  electricity: {
    tariffPerKwh: number;
    igvPercentage: number;
    totalReceipt: number;
    totalFromMeters: number;
    surplus: number;
    surplusToDistribute: number;
    receiptPhoto?: ReceiptPhoto;
  };
  water: {
    totalReceipt: number;
    receiptPhoto?: ReceiptPhoto;
  };
  floorsElectricity: FloorElectricityReading[];
  floorsWater: FloorWaterCost[];
  otherExpenses: OtherExpense[];
  income: MonthlyIncome[];
  savedSettings: ExpenseSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseSettings {
  floors: Floor[];
  electricityTariffPerKwh: number;
  igvPercentage: number;
  waterTotalPercentage: number;
  expenseCategories: string[];
  incomeSources: string[];
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Comida',
  'Transporte',
  'Internet',
  'Teléfono',
  'Netflix/Spotify',
  'Mantenimiento',
  'Otros',
];

export const DEFAULT_INCOME_SOURCES = [
  'Salario',
  'Alquiler',
  'Negocio',
  'Otros',
];
