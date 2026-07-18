# CasaBalance

Aplicacion movil para gestion de gastos del hogar. Divide recibos de luz y agua por pisos, controla finanzas personales (ingresos, gastos, deudas, ahorros) y sincroniza todo en la nube con tu grupo familiar.

## Stack

- **Framework:** React Native (Expo SDK 54)
- **Lenguaje:** TypeScript (strict mode)
- **Navegacion:** React Navigation v7 (Stack + Bottom Tabs)
- **BD Local:** SQLite (expo-sqlite)
- **Cloud:** Firebase Firestore + Firebase Storage
- **Notificaciones:** expo-notifications
- **Estado:** React useState/useEffect (sin libreria externa)
- **UI:** Componentes nativos + LinearGradient + SVG

## Arquitectura

El proyecto sigue una arquitectura por capas (Clean Architecture simplificada):

```
src/
├── domain/                    # Capa de dominio (logica de negocio pura)
│   ├── entities/              # Interfaces y tipos de datos
│   │   ├── Expense.ts         # ExpensePeriod, Floor, ExpenseSettings, etc.
│   │   └── Finance.ts         # FinancePeriod, FinanceDebt, FinanceSettings, etc.
│   └── repositories/          # Contratos de interfaces
│       ├── IExpenseRepository.ts
│       └── IFinanceRepository.ts
├── data/                      # Capa de acceso a datos
│   ├── Database.ts            # Inicializacion SQLite (singleton)
│   └── repositories/          # Implementaciones concretas
│       ├── SQLiteExpenseRepository.ts
│       └── SQLiteFinanceRepository.ts
├── presentation/              # Capa de presentacion (UI)
│   ├── screens/               # 8 pantallas principales
│   ├── components/            # Componentes reutilizables (DecimalInput)
│   ├── navigation/            # AppNavigator (Stack + Tabs)
│   └── theme/                 # Design tokens (colores, espaciado, tipografia)
├── services/                  # Servicios transversales
│   ├── firebaseConfig.ts      # Inicializacion Firebase
│   ├── SyncService.ts         # CRUD Firestore + suscripciones en tiempo real
│   ├── NotificationService.ts # Programacion de recordatorios de pago
│   ├── SettingsService.ts     # Configuracion de notificaciones
│   ├── MonetizationService.ts # Estado premium (simulado)
│   └── MonetizationConfig.ts  # IDs de AdMob, RevenueCat, precios
└── utils/                     # Utilidades compartidas
    └── formatting.ts          # formatCurrency, generateId, MONTHS
```

### Principios de Arquitectura

1. **Direccion de dependencias:** `presentation -> services, data -> domain` (el dominio no depende de nada)
2. **Repository Pattern:** Interfaces en `domain/repositories/`, implementaciones en `data/repositories/`
3. **Separacion de concerns:** Cada capa tiene una responsabilidad clara
4. **Dual data source:** SQLite para modo local, Firebase Firestore para modo grupo/nube
5. **Design tokens:** Colores, espaciado y tipografia centralizados en `theme/colors.ts`

### Modo de datos

- **Sin grupo (local):** SQLite como unica fuente de datos
- **Con grupo (cloud):** Firebase Firestore con suscripciones en tiempo real (`onSnapshot`)
- **Migracion:** Al crear grupo, los datos locales se sincronizan a la nube

## Funcionalidades

### Gestion de Grupos
- Crear grupo familiar con codigo unico (8 caracteres)
- Unirse a un grupo existente con codigo
- Compartir codigo via WhatsApp, etc.
- Migrar datos locales a la nube al crear grupo

### Gastos (Luz y Agua)
- Registro de recibos de luz y agua por periodo
- Configuracion de pisos y tarifas (tarifa por kWh, IGV, porcentaje de agua)
- Calculo automatico de distribucion entre pisos
- Lecturas de medidor por piso
- Gastos adicionales y otros ingresos
- Exportacion a CSV

### Finanzas
- Ingresos por fuente (Salario, Freelance, Inversiones, etc.)
- Gastos por categoria con subcategorias (Vivienda, Alimentacion, Transporte, etc.)
- Deudas con calculo de cuotas mensuales y seguimiento de pagos
- Ahorros
- Balance mensual: `Ingresos - Gastos - Deudas`

### Estadisticas
- KPIs: ingresos totales, gastos totales, ahorros, deudas
- Grafico de barras: Ingresos vs Gastos por mes
- Grafico de pastel: Gastos por categoria
- Grafico de tendencia de balance
- Seguimiento de deudas: progreso de pago, resumen por periodo

### Sincronizacion Cloud
- Firebase Firestore como backend
- Sincronizacion en tiempo real entre dispositivos del grupo
- Suscripcion a cambios de periodos y configuraciones

### Recordatorios
- Recordatorios programables de pago de recibos
- Notificaciones push (dia y hora configurables)
- Soporte para multiples dias del mes

### Simulador de Deudas
- Calcula capacidad de pago mensual
- Proyeccion de pago de deudas vs ingresos y gastos

## Pantallas

| Pantalla | Ruta | Descripcion |
|----------|------|-------------|
| Welcome | Stack | Crear o unirse a un grupo |
| Gastos | Tab | Lista de periodos de Luz/Agua |
| ExpenseDetail | Stack | Detalle de periodo: lecturas, recibos, distribucion |
| Finanzas | Tab | Lista de periodos financieros |
| FinanceDetail | Stack | Ingresos, gastos, deudas, ahorros |
| Estadisticas | Tab | Graficos, KPIs, simulador |
| Perfil | Tab | Configuracion, premium, notificaciones, grupo |
| FloorsConfig | Stack | Configurar pisos y tarifas |

## Estructura de Datos

### ExpensePeriod
Periodo mensual de gastos compartidos (luz y agua).
- Mes/año, recibos de luz y agua
- Lecturas por piso (medidor anterior, actual, consumo, IGV, excedente)
- Distribucion de agua por porcentaje o monto fijo
- Gastos adicionales y otros ingresos
- Configuracion guardada al momento de crear el periodo

### FinancePeriod
Periodo mensual de finanzas personales.
- Mes/año
- Ingresos (fuente + monto)
- Gastos (categoria + subcategoria + monto + es fijo)
- Deudas (nombre, total, cuota mensual, restante, estado de pago)
- Ahorros y notas

## Instalacion

```bash
npm install
npx expo start
```

Escanea el QR con Expo Go en tu telefono.

## Desarrollo

### Scripts disponibles
```bash
npx expo start          # Iniciar servidor de desarrollo
npx expo run:android    # Build para Android
npx expo run:ios        # Build para iOS
npx expo start --web    # Abrir en navegador
```

### Variables de entorno
No se utilizan archivos `.env`. La configuracion de Firebase esta en:
- `src/services/firebaseConfig.ts` (config web)
- `google-services.json` (config Android)

### Monetizacion
El sistema de monetizacion esta en modo simulacion (test). Ver `MONETIZATION.md` para configuracion de AdMob, Google Play Console y RevenueCat.

## Notas tecnicas

- **Sin libreria de estado:** El estado se maneja con `useState`/`useEffect` en cada pantalla. Para escalabilidad futura, se recomienda migrar a Zustand o Jotai.
- **Init async en constructores:** Los repositorios SQLite ejecutan `init()` en el constructor sin await. Esto es intencional para no bloquear la inicializacion de la app, pero implica que la primera consulta podria ejecutarse antes de que las tablas existan si no se llama `initDatabase()` primero.
- **Firebase credentials:** Las credenciales de Firebase estan en el codigo fuente. Para produccion, se recomienda moverlas a variables de entorno o usar Firebase App Check.
