import { Text, type TextProps, type TextStyle } from 'react-native';
import { fontes } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';

type Tom = 'padrao' | 'suave' | 'primario' | 'destaque' | 'destrutivo' | 'aviso' | 'invertido';
type Peso = 'regular' | 'medium' | 'bold' | 'extra';

interface Props extends TextProps {
  tom?: Tom;
  peso?: Peso;
  tam?: number;
  serif?: boolean;
  centro?: boolean;
}

export function T({ tom = 'padrao', peso = 'regular', tam = 14, serif, centro, style, ...rest }: Props) {
  const { c } = useTema();
  const cor: Record<Tom, string> = {
    padrao: c.foreground,
    suave: c.mutedForeground,
    primario: c.dark ? c.primaryLight : c.primaryLight,
    destaque: c.primary,
    destrutivo: c.destructive,
    aviso: c.warn,
    invertido: c.primaryForeground,
  };
  const base: TextStyle = {
    color: cor[tom],
    fontSize: tam,
    fontFamily: serif ? fontes.serif : fontes[peso],
    letterSpacing: -0.015 * tam * 0.5,
    textAlign: centro ? 'center' : undefined,
  };
  return <Text {...rest} style={[base, style]} />;
}
