import React, { useState, useEffect, useRef } from 'react';
import { TextInput, StyleSheet, TextInputProps, View, TouchableOpacity, Text } from 'react-native';
import { colors, spacing, borderRadius } from '../theme/colors';
import { typography } from '../theme/typography';

interface DecimalInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (value: string) => void;
  showDotButton?: boolean;
  autoFormat?: boolean;
}

export const DecimalInput: React.FC<DecimalInputProps> = ({
  value,
  onChangeText,
  style,
  showDotButton = true,
  autoFormat = false,
  ...props
}) => {
  const inputRef = useRef<TextInput>(null);
  const [displayValue, setDisplayValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setDisplayValue(value);
    }
  }, [value]);

  const formatAsCurrency = (text: string): string => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') return '';

    const num = parseInt(cleaned, 10);
    if (isNaN(num)) return '';

    if (cleaned.length <= 2) {
      return num.toString();
    }

    const pesos = cleaned.slice(0, -2);
    const centavos = cleaned.slice(-2);
    return `${pesos}.${centavos}`;
  };

  const handleChange = (text: string) => {
    let cleaned = text.replace(/[^0-9.]/g, '');

    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    const decimalParts = cleaned.split('.');
    if (decimalParts.length === 2 && decimalParts[1].length > 2) {
      cleaned = decimalParts[0] + '.' + decimalParts[1].slice(0, 2);
    }

    if (autoFormat && isFocused) {
      const formatted = formatAsCurrency(cleaned);
      setDisplayValue(formatted);
      onChangeText(formatted);
    } else {
      setDisplayValue(cleaned);
      onChangeText(cleaned);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (displayValue === '' || displayValue === '.') {
      setDisplayValue('0');
      onChangeText('0');
    } else {
      const numValue = parseFloat(displayValue);
      if (!isNaN(numValue)) {
        setDisplayValue(numValue.toString());
        onChangeText(numValue.toString());
      } else {
        setDisplayValue('0');
        onChangeText('0');
      }
    }
  };

  const insertDecimal = () => {
    if (!displayValue.includes('.')) {
      const newValue = displayValue + '.';
      setDisplayValue(newValue);
    }
    inputRef.current?.focus();
  };

  if (!showDotButton) {
    return (
      <TextInput
        ref={inputRef}
        style={[styles.inputOnly, style]}
        value={displayValue}
        onChangeText={handleChange}
        onBlur={handleBlur}
        onFocus={() => setIsFocused(true)}
        keyboardType="numeric"
        selectTextOnFocus
        placeholderTextColor={colors.input.placeholder}
        {...props}
      />
    );
  }

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      <TextInput
        ref={inputRef}
        style={[styles.input, style]}
        value={displayValue}
        onChangeText={handleChange}
        onBlur={handleBlur}
        onFocus={() => setIsFocused(true)}
        keyboardType="numeric"
        selectTextOnFocus
        placeholderTextColor={colors.input.placeholder}
        {...props}
      />
      <TouchableOpacity
        style={[styles.dotButton, displayValue.includes('.') && styles.dotButtonDisabled]}
        onPress={insertDecimal}
        disabled={displayValue.includes('.')}
      >
        <Text style={[styles.dotButtonText, displayValue.includes('.') && styles.dotButtonTextDisabled]}>
          .
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.input.background,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    maxWidth: 150,
    borderWidth: 1.5,
    borderColor: colors.input.border,
  },
  containerFocused: {
    backgroundColor: colors.input.backgroundFocused,
    borderColor: colors.input.borderFocused,
  },
  input: {
    flex: 1,
    padding: spacing[2],
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'center',
    backgroundColor: 'transparent',
    minWidth: 0,
  },
  inputOnly: {
    backgroundColor: colors.input.background,
    borderRadius: borderRadius.sm,
    padding: spacing[2],
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: colors.input.border,
  },
  dotButton: {
    backgroundColor: colors.primary.main,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[1],
    borderRadius: borderRadius.xs,
  },
  dotButtonDisabled: {
    backgroundColor: colors.backgroundTertiary,
  },
  dotButtonText: {
    color: colors.common.white,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  dotButtonTextDisabled: {
    color: colors.textMuted,
  },
});
