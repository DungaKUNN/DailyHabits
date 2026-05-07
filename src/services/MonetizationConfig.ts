// Configuración de Monetización
// Reemplaza estos valores cuando tengas tus cuentas creadas

export const MONETIZATION_CONFIG = {
  // AdMob - Obtén tus IDs en https://apps.admob.com
  ADMOB: {
    BANNER_AD_UNIT_ID: 'ca-app-pub-7048217633128036/4157773097', // Reemplaza con tu ID
    INTERSTITIAL_AD_UNIT_ID: 'ca-app-pub-3940256099942544/1033173712', // Reemplaza con tu ID
  },
  
  // RevenueCat - Obtén tu API Key en https://app.revenuecat.com
  REVENUECAT: {
    API_KEY: 'test_SXXaNxLndPVrtlkBkaYcnxBuQmc',
    PREMIUM_ENTITLEMENT_ID: 'premium_monthly',
  },
  
  // Google Play - ID de tu suscripción en Play Console
  SUBSCRIPTION: {
    MONTHLY_PRODUCT_ID: 'premium_monthly',
  },
  
  // Precios (en soles peruanos)
  PRICES: {
    MONTHLY: 'S/9.90',
    YEARLY: 'S/89.90',
  },
};

// Funciones helper
export const formatPrice = (price: string): string => {
  return price;
};

export const getProductId = (): string => {
  return MONETIZATION_CONFIG.SUBSCRIPTION.MONTHLY_PRODUCT_ID;
};
