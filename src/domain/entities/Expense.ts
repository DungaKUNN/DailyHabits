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

const DEFAULT_ELECTRICITY = {
  tariffPerKwh: 0,
  igvPercentage: 18,
  totalReceipt: 0,
  totalFromMeters: 0,
  surplus: 0,
  surplusToDistribute: 0,
};

const DEFAULT_WATER = {
  totalReceipt: 0,
};

export const normalizeExpensePeriod = (period: Partial<ExpensePeriod>): ExpensePeriod => {
  const now = new Date();
  const saved = period.savedSettings;
  const savedSettings: ExpenseSettings = {
    floors: Array.isArray(saved?.floors) ? saved.floors : [],
    electricityTariffPerKwh: saved?.electricityTariffPerKwh ?? ((period.electricity?.tariffPerKwh ?? 0.66) || 0.66),
    igvPercentage: saved?.igvPercentage ?? ((period.electricity?.igvPercentage ?? 18) || 18),
    waterTotalPercentage: saved?.waterTotalPercentage ?? 100,
    expenseCategories: Array.isArray(saved?.expenseCategories) ? saved.expenseCategories : DEFAULT_EXPENSE_CATEGORIES,
    incomeSources: Array.isArray(saved?.incomeSources) ? saved.incomeSources : DEFAULT_INCOME_SOURCES,
  };

  return {
    id: period.id || Date.now().toString(),
    month: period.month || '',
    year: period.year || new Date().getFullYear(),
    monthName: period.monthName || '',
    electricity: {
      ...DEFAULT_ELECTRICITY,
      ...((period.electricity || {}) as object),
      receiptPhoto: (period.electricity as any)?.receiptPhoto,
    },
    water: {
      ...DEFAULT_WATER,
      ...((period.water || {}) as object),
      receiptPhoto: (period.water as any)?.receiptPhoto,
    },
    floorsElectricity: period.floorsElectricity || [],
    floorsWater: period.floorsWater || [],
    otherExpenses: period.otherExpenses || [],
    income: period.income || [],
    savedSettings,
    createdAt: period.createdAt || now,
    updatedAt: period.updatedAt || now,
  };
};

export interface ExpenseSettings {
  floors: Floor[];
  electricityTariffPerKwh: number;
  igvPercentage: number;
  waterTotalPercentage: number;
  expenseCategories: string[];
  incomeSources: string[];
}

export const normalizeExpenseSettings = (settings: Partial<ExpenseSettings> | null | undefined): ExpenseSettings => ({
  floors: Array.isArray(settings?.floors) ? settings.floors : [],
  electricityTariffPerKwh: settings?.electricityTariffPerKwh ?? 0.66,
  igvPercentage: settings?.igvPercentage ?? 18,
  waterTotalPercentage: settings?.waterTotalPercentage ?? 100,
  expenseCategories: Array.isArray(settings?.expenseCategories) ? settings.expenseCategories : DEFAULT_EXPENSE_CATEGORIES,
  incomeSources: Array.isArray(settings?.incomeSources) ? settings.incomeSources : DEFAULT_INCOME_SOURCES,
});

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
