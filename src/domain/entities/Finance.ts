export interface FinanceIncome {
  id: string;
  source: string;
  amount: number;
}

export interface FinanceExpense {
  id: string;
  category: string;
  subcategory: string;
  amount: number;
  isFixed: boolean;
}

export interface FinanceDebt {
  id: string;
  name: string;
  totalAmount: number;
  monthlyPayment: number;
  remainingAmount: number;
  isPaid: boolean;
  paidThisMonth: boolean;
  createdAt?: Date;
}

export interface FinancePeriod {
  id: string;
  month: string;
  year: number;
  monthName: string;
  income: FinanceIncome[];
  expenses: FinanceExpense[];
  debts: FinanceDebt[];
  savings: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinanceSettings {
  incomeSources: string[];
  expenseCategories: string[];
  expenseSubcategories: Record<string, string[]>;
}

export const DEFAULT_INCOME_SOURCES = [
  'Salario',
  'Segundo empleo',
  'Freelance',
  'Alquiler',
  'Negocio',
  'Inversiones',
  'Otros',
];

export const DEFAULT_EXPENSE_CATEGORIES = {
  'Vivienda': ['Alquiler', 'Luz', 'Agua', 'Internet', 'Teléfono', 'Mantenimiento'],
  'Alimentación': ['Mercado', 'Restaurantes', 'Delivery'],
  'Transporte': ['Combustible', 'Transporte público', 'Mantenimiento auto', 'Uber/Taxi'],
  'Servicios': ['Netflix', 'Spotify', 'Cloud', 'Otros'],
  'Salud': ['Farmacia', 'Doctor', 'Seguro'],
  'Educación': ['Cursos', 'Libros', 'Colegiatura'],
  'Otros': ['Otros'],
};

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  incomeSources: DEFAULT_INCOME_SOURCES,
  expenseCategories: Object.keys(DEFAULT_EXPENSE_CATEGORIES),
  expenseSubcategories: DEFAULT_EXPENSE_CATEGORIES,
};
