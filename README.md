# CasaBalance

Aplicación móvil para gestión de gastos del hogar. Divide recibos de luz y agua por pisos, controla finanzas personales (ingresos, gastos, deudas, ahorros) y sincroniza todo en la nube con tu grupo familiar.

## Stack

- **Framework:** React Native (Expo SDK 54)
- **Lenguaje:** TypeScript
- **Navegación:** React Navigation (Stack + Bottom Tabs)
- **BD Local:** SQLite (expo-sqlite)
- **Cloud:** Firebase Firestore
- **Notificaciones:** expo-notifications
- **UI:** Componentes nativos + LinearGradient

## Arquitectura

```
src/
├── domain/           # Entidades e interfaces
│   ├── entities/     # Expense, Finance
│   └── repositories/ # Interfaces de repositorios
├── data/             # Datos
│   ├── Database.ts   # Inicialización SQLite
│   └── repositories/ # SQLiteExpenseRepository, SQLiteFinanceRepository
├── presentation/     # UI
│   ├── screens/      # 8 pantallas
│   ├── components/   # Componentes reutilizables
│   ├── navigation/   # AppNavigator (Stack + Tabs)
│   └── theme/        # Colores y estilos globales
└── services/         # Firebase, Sync, Notificaciones, Premium
```

## Funcionalidades

### 👨‍👩‍👧‍👦 Gestión de Grupos
- Crear grupo familiar con código único
- Unirse a un grupo existente con código
- Compartir código vía WhatsApp, etc.
- Migrar datos locales a la nube al crear grupo

### 💡 Gastos (Luz y Agua)
- Registro de recibos de luz y agua por período
- Configuración de pisos y tarifas (tarifa por kWh, IGV, porcentaje de agua)
- Cálculo automático de distribución entre pisos
- Lecturas de medidor por piso
- Gastos adicionales y otros ingresos

### 💰 Finanzas
- Ingresos por fuente (Salario, Freelance, Inversiones, etc.)
- Gastos por categoría (Vivienda, Alimentación, Transporte, etc.)
- Deudas con cálculo de cuotas mensuales
- Ahorros
- Balance mensual: `Ingresos - Gastos - Deudas`

### 📊 Estadísticas
- KPIs: ingresos totales, gastos totales, ahorros, deudas
- Gráfico de barras: Ingresos vs Gastos por mes
- Gráfico de pastel: Gastos por categoría
- Gráfico de tendencia de balance
- Seguimiento de deudas: progreso de pago, resumen por período

### 🔄 Sincronización Cloud
- Firebase Firestore como backend
- Sincronización en tiempo real entre dispositivos del grupo
- Suscripción a cambios de períodos y configuraciones

### ⭐ Premium
- Premium activo hasta 2026-06-14
- Sin anuncios
- Funciones extras

### 🔔 Recordatorios
- Recordatorios programables de pago de recibos
- Notificaciones push (día y hora configurables)
- Soporte para múltiples días del mes

### 🏦 Simulador de Deudas
- Calcula capacidad de pago mensual
- Proyección de pago de deudas vs ingresos y gastos

## Pantallas

| Pantalla | Ruta | Descripción |
|----------|------|-------------|
| Welcome | Stack | Crear o unirse a un grupo |
| Gastos | Tab | Lista de períodos de Luz/Agua |
| ExpenseDetail | Stack | Detalle de período: lecturas, recibos, distribución |
| Finanzas | Tab | Lista de períodos financieros |
| FinanceDetail | Stack | Ingresos, gastos, deudas, ahorros |
| Estadísticas | Tab | Gráficos, KPIs, simulador |
| Perfil | Tab | Configuración, premium, notificaciones, grupo |
| FloorsConfig | Stack | Configurar pisos y tarifas |

## Instalación

```bash
npm install
npx expo start
```

Escanea el QR con Expo Go en tu teléfono.

## Estructura de Datos

### ExpensePeriod
- Mes/año, recibos de luz y agua, lecturas por piso, distribución, gastos adicionales, ingresos

### FinancePeriod
- Mes/año, ingresos (fuente + monto), gastos (categoría + monto), deudas (cuotas), ahorros

## Licencia

MIT
