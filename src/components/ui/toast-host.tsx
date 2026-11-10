import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/lib/mini-store';
import { toastStore } from '@/lib/toast';
import { useTema } from '@/theme/theme-provider';
import { T } from './texto';

export function ToastHost() {
  const { c } = useTema();
  const insets = useSafeAreaInsets();
  const id = useStore(toastStore, (e) => e.id);
  const [opacidade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!id) return;
    opacidade.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacidade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacidade, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [id, opacidade]);

  const { msg, tipo } = toastStore.get();
  if (!msg) return null;
  const fundo = tipo === 'erro' ? (c.dark ? 'rgba(248,113,113,0.95)' : c.destructive) : tipo === 'sucesso' ? (c.dark ? 'rgba(27,184,154,0.95)' : c.primaryLight) : c.foreground;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 24 }]}>
      <Animated.View style={[styles.toast, { backgroundColor: fundo, opacity: opacidade }]}>
        <T peso="bold" tam={14} style={{ color: '#FFFFFF' }}>
          {msg}
        </T>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, maxWidth: '88%' },
});
