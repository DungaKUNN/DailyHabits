import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { format, addDays, startOfWeek, isSameDay, subWeeks, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';

interface WeekCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const { width } = Dimensions.get('window');
const DAY_WIDTH = (width - 32) / 7;

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  selectedDate,
  onSelectDate,
}) => {
  const today = new Date();
  const [currentWeek, setCurrentWeek] = React.useState(startOfWeek(selectedDate, { weekStartsOn: 1 }));

  const handleDayPress = React.useCallback((date: Date) => {
    onSelectDate(date);
  }, [onSelectDate]);

  React.useEffect(() => {
    const newWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    setCurrentWeek(newWeekStart);
  }, [selectedDate]);

  const goToPreviousWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentWeek(startOfWeek(today, { weekStartsOn: 1 }));
    onSelectDate(today);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  const isCurrentWeek = isSameDay(currentWeek, startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={goToPreviousWeek} 
          style={styles.arrowButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.arrow}>‹</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToToday} style={styles.monthButton}>
          <Text style={styles.monthYear}>
            {format(currentWeek, "MMMM yyyy", { locale: es })}
          </Text>
          {!isCurrentWeek && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Ir a hoy</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={goToNextWeek} 
          style={styles.arrowButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.daysContainer}>
        {weekDays.map((date, index) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, new Date());
          const dayName = format(date, 'EEE', { locale: es });
          const dayNumber = format(date, 'd');
          
          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={[
                styles.dayButton,
                isSelected && styles.selectedDay,
                isToday && !isSelected && styles.todayButton,
              ]}
              onPress={() => handleDayPress(date)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayName,
                isSelected && styles.selectedText,
                isToday && !isSelected && styles.todayText,
              ]}>
                {dayName}
              </Text>
              
              <View style={[
                styles.dayNumberContainer,
                isSelected && styles.selectedDayNumberContainer,
              ]}>
                <Text style={[
                  styles.dayNumber,
                  isSelected && styles.selectedText,
                  isToday && !isSelected && styles.todayText,
                ]}>
                  {dayNumber}
                </Text>
              </View>

              {isToday && (
                <View style={[
                  styles.todayDot,
                  isSelected && styles.selectedTodayDot,
                ]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  monthButton: {
    alignItems: 'center',
  },
  monthYear: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    textTransform: 'capitalize',
  },
  todayBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  todayBadgeText: {
    fontSize: 11,
    color: '#2e7d32',
    fontWeight: '600',
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  dayButton: {
    width: DAY_WIDTH - 8, // -8 for margin
    height: 75,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  selectedDay: {
    backgroundColor: '#4CAF50',
    elevation: 4,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  todayButton: {
    backgroundColor: '#e8f5e9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  dayName: {
    fontSize: 12,
    color: '#999',
    textTransform: 'lowercase',
    marginBottom: 4,
    fontWeight: '600',
  },
  selectedText: {
    color: '#fff',
  },
  todayText: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  dayNumberContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDayNumberContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4CAF50',
    marginTop: 4,
  },
  selectedTodayDot: {
    backgroundColor: '#fff',
  },
});

export default WeekCalendar;
