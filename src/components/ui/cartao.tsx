import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';

interface Props extends ViewProps {
  estilo?: StyleProp<ViewStyle>;
  semBorda?: boolean;
}

export function Cartao({ estilo, semBorda, style, ...rest }: Props) {
  const { c } = useTema();
  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderWidth: semBorda ? 0 : 1.5,
          shadowColor: c.shadow,
          shadowOpacity: c.shadowOpacity,
        },
        estilo,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
});
