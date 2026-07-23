import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Warning, CheckCircle, Info, CurrencyDollar } from 'phosphor-react-native';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { typography } from '../theme/typography';

type DialogVariant = 'destructive' | 'success' | 'info' | 'action';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

const VARIANT_CONFIG = {
  destructive: {
    icon: Warning,
    iconColor: colors.error,
    iconBg: colors.errorLight,
    confirmBg: colors.error,
    confirmColor: colors.common.white,
  },
  success: {
    icon: CheckCircle,
    iconColor: colors.success,
    iconBg: colors.successLight,
    confirmBg: colors.success,
    confirmColor: colors.common.white,
  },
  info: {
    icon: Info,
    iconColor: colors.info,
    iconBg: colors.infoLight,
    confirmBg: colors.info,
    confirmColor: colors.common.white,
  },
  action: {
    icon: CurrencyDollar,
    iconColor: colors.primary.main,
    iconBg: colors.primary.light,
    confirmBg: colors.primary.main,
    confirmColor: colors.common.white,
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  variant = 'destructive',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  showCancel = true,
  onConfirm,
  onCancel,
}) => {
  const config = VARIANT_CONFIG[variant];
  const IconComponent = config.icon;

  const handleClose = onCancel || (() => {});

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
            <IconComponent size={28} color={config.iconColor} weight="fill" />
          </View>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.message} numberOfLines={5}>{message}</Text>
          <View style={styles.actions}>
            {showCancel && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose} activeOpacity={0.7}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: config.confirmBg }, !showCancel && styles.confirmButtonFull]}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={[styles.confirmText, { color: config.confirmColor }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[24],
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.common.white,
    borderRadius: borderRadius.lg,
    padding: spacing[24],
    alignItems: 'center',
    ...shadows.lg,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[16],
  },
  title: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing[24],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[12],
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing[12],
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  cancelText: {
    ...typography.buttonSmall,
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing[12],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  confirmButtonFull: {
    flex: undefined,
    width: '100%',
  },
  confirmText: {
    ...typography.buttonSmall,
  },
});
