import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Meal } from '../../domain/entities/Meal';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface RepeatModalProps {
  meal: Meal | null;
  onClose: () => void;
  onConfirm: (dates: Date[]) => void;
}

const RepeatModal: React.FC<RepeatModalProps> = ({ meal, onClose, onConfirm }) => {
  const [selectedOption, setSelectedOption] = useState<'week' | 'custom' | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [customDates, setCustomDates] = useState<Date[]>([]);

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const generateDates = (): Date[] => {
    const today = new Date();
    const dates: Date[] = [];

    if (selectedOption === 'week') {
      const currentDay = today.getDay();
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysFromMonday);

      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        if (date >= today) {
          dates.push(date);
        }
      }
    } else if (selectedOption === 'custom') {
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dayOfWeek = date.getDay();
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        if (selectedDays.includes(adjustedDay)) {
          dates.push(date);
        }
      }
    }

    return dates;
  };

  const handleConfirm = () => {
    const dates = generateDates();
    if (dates.length > 0) {
      onConfirm(dates);
    }
  };

  if (!meal) return null;

  const getTypeLabel = () => {
    switch (meal.type) {
      case 'breakfast': return 'Desayuno';
      case 'lunch': return 'Almuerzo';
      case 'dinner': return 'Cena';
      default: return 'Comida';
    }
  };

  return (
    <View style={styles.overlay}>
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.handle} />
        
        <Text style={styles.title}>Repetir Comida</Text>
        <Text style={styles.subtitle}>
          {getTypeLabel()}: {meal.name}
        </Text>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Opciones rápidas</Text>
          
          <TouchableOpacity
            style={[
              styles.optionButton,
              selectedOption === 'week' && styles.optionButtonSelected
            ]}
            onPress={() => {
              setSelectedOption('week');
              setSelectedDays([]);
            }}
          >
            <Text style={styles.optionIcon}>📅</Text>
            <View style={styles.optionContent}>
              <Text style={[
                styles.optionTitle,
                selectedOption === 'week' && styles.optionTextSelected
              ]}>
                Toda esta semana
              </Text>
              <Text style={styles.optionDescription}>
                Repetir los próximos días de esta semana
              </Text>
            </View>
            {selectedOption === 'week' && <Text style={styles.checkIcon}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              selectedOption === 'custom' && styles.optionButtonSelected
            ]}
            onPress={() => {
              setSelectedOption('custom');
              setSelectedDays([]);
            }}
          >
            <Text style={styles.optionIcon}>🗓️</Text>
            <View style={styles.optionContent}>
              <Text style={[
                styles.optionTitle,
                selectedOption === 'custom' && styles.optionTextSelected
              ]}>
                Días específicos
              </Text>
              <Text style={styles.optionDescription}>
                Selecciona los días de la semana
              </Text>
            </View>
            {selectedOption === 'custom' && <Text style={styles.checkIcon}>✓</Text>}
          </TouchableOpacity>

          {/* Day Selector */}
          {selectedOption === 'custom' && (
            <Animated.View style={styles.daySelectorContainer}>
              <Text style={styles.sectionTitle}>Selecciona los días</Text>
              <View style={styles.daysRow}>
                {weekDays.map((day, index) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      selectedDays.includes(index) && styles.dayButtonSelected
                    ]}
                    onPress={() => toggleDay(index)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      selectedDays.includes(index) && styles.dayButtonTextSelected
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Summary */}
          {selectedOption && (
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryText}>
                Se agregará a <Text style={styles.summaryHighlight}>
                  {selectedOption === 'week' 
                    ? `${generateDates().length} días`
                    : selectedDays.length > 0 
                      ? `${generateDates().length} fechas`
                      : '0 días'
                  }
                </Text>
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.confirmButton,
              (!selectedOption || (selectedOption === 'custom' && selectedDays.length === 0)) && 
                styles.confirmButtonDisabled
            ]}
            onPress={handleConfirm}
            disabled={!selectedOption || (selectedOption === 'custom' && selectedDays.length === 0)}
          >
            <LinearGradient
              colors={['#4CAF50', '#2e7d32']}
              style={styles.confirmButtonGradient}
            >
              <Text style={styles.confirmButtonText}>Repetir</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  content: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  optionIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  optionTextSelected: {
    color: '#2e7d32',
  },
  optionDescription: {
    fontSize: 13,
    color: '#999',
  },
  checkIcon: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  daySelectorContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#4CAF50',
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  dayButtonTextSelected: {
    color: '#fff',
  },
  summaryContainer: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  summaryHighlight: {
    fontWeight: 'bold',
    color: '#e65100',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 8,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default RepeatModal;
