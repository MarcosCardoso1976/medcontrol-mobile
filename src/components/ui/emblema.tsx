import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTema } from '@/theme/theme-provider';
import { T } from './texto';

type Tom = 'primario' | 'neutro' | 'alerta' | 'perigo';

export function Emblema({ texto, tom = 'neutro', estilo }: { texto: string; tom?: Tom; estilo?: StyleProp<ViewStyle> }) {
  const { c } = useTema();
  const mapa = {
    primario: { bg: c.primarySoft, borda: c.primaryBorder, cor: c.primaryLight },
    neutro: { bg: c.dark ? 'rgba(255,255,255,0.06)' : c.muted, borda: 'transparent', cor: c.mutedForeground },
    alerta: { bg: c.warnSoft, borda: c.warn, cor: c.warn },
    perigo: { bg: c.destructiveSoft, borda: c.destructiveBorder, cor: c.destructive },
  }[tom];
  return (
    <View
      style={[
        { backgroundColor: mapa.bg, borderColor: mapa.borda, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
        estilo,
      ]}
    >
      <T peso="bold" tam={11.5} style={{ color: mapa.cor }}>
        {texto}
      </T>
    </View>
  );
}
