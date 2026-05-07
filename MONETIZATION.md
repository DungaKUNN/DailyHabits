# Monetización - Pasos para Play Store

## Estado Actual
✅ Código preparado para monetización
⚠️ Necesitas crear cuentas y obtener IDs

---

## 1. Google AdMob (Publicidad)

### Pasos:
1. Ve a https://apps.admob.com
2. Inicia sesión con tu cuenta Google
3. Click en "Comenzar"
4. Crea tu primera cuenta de editor
5. Click en "Agregar aplicación" → Selecciona Android
6. Sigue los pasos para crear la app

### Obtener IDs de anuncios:
1. En AdMob, ve a "Anuncios" → "Unidades de anuncios"
2. Crea un anuncio de tipo "Banner"
3. Copia el ID (ejemplo: ca-app-pub-xxx/xxx)
4. Copia el ID en `MonetizationConfig.ts`

---

## 2. Google Play Console (Suscripciones)

### Pasos:
1. Ve a https://play.google.com/console
2. Crea tu app (nombre, etc.)
3. Ve a "Monetización" → "Productos de suscripción"
4. Crea un producto:
   - ID: premium_monthly
   - Título: Premium Mensual
   - Precio: S/9.90
   - Período: Mensual
5. Activa el producto

### Configurar pagos:
1. Ve a "Configuración de la cuenta" → "Pagos"
2. Agrega tu cuenta bancaria
3. Completa la verificación

---

## 3. RevenueCat (Opcional - Recomendado)

### Pasos:
1. Ve a https://app.revenuecat.com
2. Crea una cuenta
3. Crea un nuevo proyecto
4. Conecta Google Play:
   - Ve a "Project Settings" → "Apps"
   - Agrega Google Play
   - Configura el service account JSON
5. Crea productos en RevenueCat
6. Copia tu API Key

---

## 4. Actualizar el código

### En `MonetizationConfig.ts`:
```typescript
export const MONETIZATION_CONFIG = {
  ADMOB: {
    BANNER_AD_UNIT_ID: 'ca-app-pub-TU_ID_AQUI/TU_ID_AQUI',
    INTERSTITIAL_AD_UNIT_ID: 'ca-app-pub-TU_ID_AQUI/TU_ID_AQUI',
  },
  REVENUECAT: {
    API_KEY: 'TU_API_KEY_DE_REVENUECAT',
    PREMIUM_ENTITLEMENT_ID: 'premium_monthly',
  },
  SUBSCRIPTION: {
    MONTHLY_PRODUCT_ID: 'premium_monthly',
  },
};
```

---

## 5. Generar Build de Desarrollo

### En Expo:
```bash
npx expo prebuild --platform android
cd android
./gradlew assembleDebug
```

### Para Play Store:
```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

---

## Costos Estimados

| Servicio | Costo |
|----------|-------|
| Google Play Console | $25 (una vez) |
| AdMob | Gratis |
| RevenueCat | Gratis hasta 1000 suscriptores |
| Firebase Storage | 5GB gratis/mes |

---

## Recordatorio

El código actual funciona en modo prueba. Para producción:
1. Reemplaza los IDs en MonetizationConfig.ts
2. Genera build de desarrollo
3. Sube a Play Store

---

## Notas

- Los precios en el código están en soles peruanos (S/)
- El sistema actual es de prueba (compra simulada)
- Para pagos reales, usa RevenueCat o Google Play Billing
