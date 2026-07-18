export const formatCurrency = (amount: number): string =>
  `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const generateId = (): string =>
  Math.random().toString(36).substring(2, 15);

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
