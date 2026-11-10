import { Switch } from 'react-native';
import { useTema } from '@/theme/theme-provider';

export function Chave({ valor, onChange, rotulo }: { valor: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  const { c } = useTema();
  return (
    <Switch
      accessibilityLabel={rotulo}
      value={valor}
      onValueChange={onChange}
      trackColor={{ false: c.switchOff, true: c.primary }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={c.switchOff}
    />
  );
}
