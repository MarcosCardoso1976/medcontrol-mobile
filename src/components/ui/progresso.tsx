import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useTema } from '@/theme/theme-provider';

export function Progresso({ valor, altura = 8 }: { valor: number; altura?: number }) {
  const { c } = useTema();
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[styles.trilha, { height: altura, backgroundColor: c.dark ? 'rgba(255,255,255,0.08)' : c.primarySoft }]}
    >
      <LinearGradient
        colors={c.progressGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${pct}%`, height: '100%', borderRadius: altura }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ trilha: { borderRadius: 999, overflow: 'hidden', width: '100%' } });
