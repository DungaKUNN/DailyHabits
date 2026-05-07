import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { shouldShowAds, getPremiumStatus } from '../../services/MonetizationService';

interface AdBannerProps {
  onUpgradePress?: () => void;
}

const AdBanner: React.FC<AdBannerProps> = ({ onUpgradePress }) => {
  const [showBanner, setShowBanner] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const premium = await getPremiumStatus();
    const shouldShow = await shouldShowAds();
    setIsPremium(premium);
    setShowBanner(shouldShow);
  };

  if (!showBanner || isPremium) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.adContent}>
        <Text style={styles.adText}>🎉 ¡Desbloquea Premium!</Text>
        <Text style={styles.adSubtext}>Sin ads + Funciones extras por S/9.90/mes</Text>
      </View>
      <TouchableOpacity style={styles.upgradeButton} onPress={onUpgradePress}>
        <Text style={styles.upgradeText}>Ver Más</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
  },
  adContent: {
    flex: 1,
  },
  adText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  adSubtext: {
    color: '#fff',
    fontSize: 11,
    opacity: 0.9,
  },
  upgradeButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  upgradeText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default AdBanner;
