# MíComida - Tu Compañero de Nutrición

Aplicación móvil para planificar y seguir hábitos alimenticios diarios (desayuno, almuerzo, cena).

## Arquitectura Clean

```
src/
├── domain/           # Lógica de negocio pura
│   ├── entities/     # Modelos (Meal, DailyPlan, Habit)
│   ├── repositories/ # Interfaces de repositorios
│   └── usecases/     # Casos de uso
├── data/             # Implementación de datos
│   ├── repositories/ # Implementaciones SQLite
│   └── Database.ts   # Configuración de BD
└── presentation/     # UI
    ├── screens/      # Pantallas
    ├── components/   # Componentes reutilizables
    └── navigation/   # Configuración de navegación
```

## Características

✅ Planificación de comidas (desayuno, almuerzo, cena)
✅ Calendario semanal con navegación
✅ Marcar comidas como completadas
✅ Seguimiento de calorías
✅ Funciona 100% offline (SQLite local)
✅ Notificaciones (próximamente)
✅ Estadísticas de progreso

## Instalación y Uso

### Opción 1: Prueba en tu teléfono con Expo Go (GRATIS)

1. **En tu computadora:**
```bash
cd MíComida
npm install
npx expo start
```

2. **En tu iPhone:**
   - Descarga la app **"Expo Go"** desde App Store
   - Escanea el código QR que aparece en tu terminal

3. **En tu Android:**
   - Descarga **"Expo Go"** desde Play Store
   - Escanea el código QR o ingresa la URL manualmente

### Opción 2: Generar APK para Android

```bash
# Instala EAS CLI
npm install -g eas-cli

# Configura tu cuenta (gratis)
eas login

# Genera APK
eas build --platform android --profile preview

# Descarga el APK y instálalo en tu teléfono
```

### Opción 3: Subir a App Store (requiere Mac)

1. Necesitas una Mac para compilar para iOS
2. Cuenta de Apple Developer: $99/año
3. O usa EAS Build: ~$29/mes para builds en la nube

## Desarrollo

### Primeros pasos

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npx expo start
```

### Estructura de datos

**Meal (Comida):**
- id: string
- type: 'breakfast' | 'lunch' | 'dinner'
- name: string
- description?: string
- calories?: number
- completed: boolean
- scheduledTime: string

**DailyPlan (Plan Diario):**
- id: string (fecha YYYY-MM-DD)
- date: string
- meals: Meal[]
- notes?: string

## Costos

| Servicio | Costo |
|----------|-------|
| Desarrollo local | $0 |
| Expo Go (pruebas) | $0 |
| Play Store (publicar) | $25 único |
| App Store (publicar) | $99/año |
| Firebase (opcional) | $0 hasta 10k usuarios |

## Próximas funcionalidades (Monetización)

- [ ] Planes nutricionales premium
- [ ] Recetas ilimitadas
- [ ] Exportar a PDF
- [ ] Sincronización en la nube
- [ ] Estadísticas avanzadas
- [ ] Recordatorios personalizados

## Tecnologías

- **Frontend:** React Native + TypeScript
- **Navegación:** React Navigation
- **Base de datos:** SQLite (expo-sqlite)
- **UI:** Componentes nativos + StyleSheet
- **Fechas:** date-fns

## Licencia

MIT - Libre para usar y modificar

---

**Desarrollado con ❤️ para mejorar hábitos alimenticios**
