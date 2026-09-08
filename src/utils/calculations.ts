import { FloorElectricityReading, FloorWaterCost, Floor } from '../domain/entities/Expense';

/** Redondeo a 2 decimales para evitar errores de float (0.1+0.2). */
export const round2 = (n: number): number => {
  if (!isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

export interface ElectricityFloorInput {
  floorId: string;
  floorName: string;
  previousReading: number;
  currentReading: number;
  igvPercentage: number;
  fixedCharge: number;
  paysSurplus: boolean;
  previousSurplus?: number;
}

export interface ElectricityCalcResult {
  floors: FloorElectricityReading[];
  totalFromMeters: number;
  surplus: number;
  totalToCollect: number;
}

/**
 * Fórmula única de electricidad (fuente de verdad):
 *  kWh = max(0, actual - anterior)
 *  consumo = kWh * tarifa
 *  igv = consumo * igvPiso/100
 *  basePiso = consumo + igv + cargoFijo
 *  totalMedidores = suma(basePiso)
 *  excedente = recibo - totalMedidores
 *  El excedente se reparte SOLO entre los que pagan, con ajuste
 *  de centavos en el último para que la suma cuadre exacta.
 */
export const calculateElectricity = (
  inputs: ElectricityFloorInput[],
  tariffPerKwh: number,
  receiptTotal: number,
): ElectricityCalcResult => {
  const bases = inputs.map((inp) => {
    const safePrev = isFinite(inp.previousReading) ? inp.previousReading : 0;
    const safeCurr = isFinite(inp.currentReading) ? inp.currentReading : 0;
    const kwh = Math.max(0, safeCurr - safePrev);
    const consumptionPrice = round2(kwh * tariffPerKwh);
    const igv = round2(consumptionPrice * (inp.igvPercentage / 100));
    const fixedCharge = round2(inp.fixedCharge || 0);
    const base = round2(consumptionPrice + igv + fixedCharge);
    return { inp, kwh, consumptionPrice, igv, fixedCharge, base };
  });

  const totalFromMeters = round2(bases.reduce((s, b) => s + b.base, 0));
  const surplus = round2(receiptTotal - totalFromMeters);

  const payers = bases.filter((b) => b.inp.paysSurplus);
  const perFloorSurplus = new Map<string, number>();
  if (payers.length > 0) {
    let distributed = 0;
    payers.forEach((b, idx) => {
      const isLast = idx === payers.length - 1;
      const share = isLast
        ? round2(surplus - distributed)
        : round2(surplus / payers.length);
      perFloorSurplus.set(b.inp.floorId, share);
      if (!isLast) distributed = round2(distributed + share);
    });
  }

  const floors: FloorElectricityReading[] = bases.map((b) => {
    const share = perFloorSurplus.get(b.inp.floorId) ?? 0;
    // Si el piso no paga excedente, su excedente es 0 (no se le suma nada).
    const surplusForFloor = b.inp.paysSurplus ? share : 0;
    return {
      floorId: b.inp.floorId,
      floorName: b.inp.floorName,
      previousReading: b.inp.previousReading,
      currentReading: b.inp.currentReading,
      realReading: round2(b.kwh),
      consumptionPrice: b.consumptionPrice,
      igv: b.igv,
      fixedCharge: b.fixedCharge,
      surplus: surplusForFloor,
      paysSurplus: b.inp.paysSurplus,
      totalToPay: round2(b.base + surplusForFloor),
    };
  });

  const totalToCollect = round2(floors.reduce((s, f) => s + f.totalToPay, 0));

  return { floors, totalFromMeters, surplus, totalToCollect };
};

export interface WaterCalcResult {
  floors: FloorWaterCost[];
  totalFixed: number;
  remaining: number;
  totalDistributed: number;
  undistributed: number;
  totalPercentage: number;
}

/**
 * Fórmula única de agua (fuente de verdad):
 *  restante = recibo - suma(fijos)
 *  Si restante < 0 => se capa a 0 y se avisa (fijos superan recibo).
 *  Cada piso: monto = fijo + restante * (porcentaje/100)  [porcentaje directo]
 *  Si la suma de porcentajes != 100, queda un "sin distribuir" visible
 *  en vez de repartirlo a escondidas (eso era lo que "no cuadraba").
 */
export const calculateWater = (
  receiptTotal: number,
  floors: Pick<Floor, 'id' | 'name' | 'waterPercentage' | 'waterFixedAmount'>[],
): WaterCalcResult => {
  const totalFixed = round2(floors.reduce((s, f) => s + (f.waterFixedAmount || 0), 0));
  const totalPercentage = floors.reduce((s, f) => s + (f.waterPercentage || 0), 0);
  const rawRemaining = round2(receiptTotal - totalFixed);
  const remaining = Math.max(0, rawRemaining);

  let distributedFromPct = 0;
  const result: FloorWaterCost[] = floors.map((f, idx) => {
    const fixedAmount = round2(f.waterFixedAmount || 0);
    const pct = f.waterPercentage || 0;
    let fromPct = 0;
    if (pct > 0 && remaining > 0) {
      const isLastWithPct =
        floors.slice(idx + 1).every((o) => !(o.waterPercentage || 0)) ;
      if (isLastWithPct) {
        // Ajuste de centavos en el último con porcentaje para cuadrar.
        fromPct = round2(remaining * (totalPercentage / 100) - distributedFromPct);
        // Pero limitado a su parte proporcional real si los % no suman 100:
        // usamos parte directa y el "sin distribuir" queda explícito.
        fromPct = round2(remaining * (pct / 100));
        // Recalcular para no arrastrar error: la suma final se redondea abajo.
      } else {
        fromPct = round2(remaining * (pct / 100));
        distributedFromPct = round2(distributedFromPct + fromPct);
      }
    }
    return {
      floorId: f.id,
      floorName: f.name,
      percentage: pct,
      fixedAmount,
      amount: round2(fixedAmount + fromPct),
    };
  });

  // Re-ajustar centavos del último con porcentaje para que
  // suma(montos) = fijos + restante*sumPct/100 exacto.
  const expectedPctTotal = round2(remaining * (totalPercentage / 100));
  const actualPctTotal = round2(
    result.reduce((s, r) => s + (r.amount - r.fixedAmount), 0),
  );
  const diff = round2(expectedPctTotal - actualPctTotal);
  if (Math.abs(diff) >= 0.01) {
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].percentage > 0) {
        result[i] = { ...result[i], amount: round2(result[i].amount + diff) };
        break;
      }
    }
  }

  const totalDistributed = round2(result.reduce((s, r) => s + r.amount, 0));
  const undistributed = round2(receiptTotal - totalDistributed);

  return { floors: result, totalFixed, remaining, totalDistributed, undistributed, totalPercentage };
};
