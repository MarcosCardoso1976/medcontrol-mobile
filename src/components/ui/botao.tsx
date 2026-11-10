import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';
import { Icone, type NomeIcone } from './icone';
import { T } from './texto';

interface Props {
  titulo?: string;
  onPress?: () => void;
  variante?: 'padrao' | 'contorno' | 'fantasma' | 'destrutivo';
  tamanho?: 'sm' | 'md' | 'lg';
  icone?: NomeIcone;
  carregando?: boolean;
  desabilitado?: boolean;
  estilo?: StyleProp<ViewStyle>;
  acessibilidade?: string;
}

export function Botao({ titulo, onPress, variante = 'padrao', tamanho = 'md', icone, carregando, desabilitado, estilo, acessibilidade }: Props) {
  const { c } = useTema();
  const alturas = { sm: 36, md: 44, lg: 52 } as const;
  const fundo = {
    padrao: c.primary,
    contorno: 'transparent',
    fantasma: 'transparent',
    destrutivo: c.destructive,
  }[variante];
  const corTexto = variante === 'padrao' || variante === 'destrutivo' ? c.primaryForeground : variante === 'contorno' ? c.foreground : c.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={acessibilidade ?? titulo}
      accessibilityState={{ disabled: !!desabilitado || !!carregando }}
      disabled={desabilitado || carregando}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: alturas[tamanho],
          backgroundColor: fundo,
          borderColor: variante === 'contorno' ? c.border : 'transparent',
          borderWidth: variante === 'contorno' ? 1.5 : 0,
          opacity: desabilitado ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          paddingHorizontal: titulo ? 16 : 0,
          width: titulo ? undefined : alturas[tamanho],
        },
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <View style={styles.conteudo}>
          {icone ? <Icone nome={icone} cor={corTexto} tam={tamanho === 'sm' ? 16 : 18} /> : null}
          {titulo ? (
            <T peso="bold" tam={tamanho === 'sm' ? 13 : 15} style={{ color: corTexto }}>
              {titulo}
            </T>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
