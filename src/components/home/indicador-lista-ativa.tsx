import { StyleSheet, View } from 'react-native';
import { Icone } from '@/components/ui/icone';
import { T } from '@/components/ui/texto';
import { useTema } from '@/theme/theme-provider';

export function IndicadorListaAtiva({ nome }: { nome: string }) {
  const { c } = useTema();
  return (
    <View style={styles.linha} accessible accessibilityLabel={`Lista ativa: ${nome}`}>
      <Icone nome="list" tam={14} cor={c.mutedForeground} />
      <T tom="suave" tam={13} peso="medium">
        Lista: <T tam={13} peso="bold">{nome}</T>
      </T>
    </View>
  );
}

const styles = StyleSheet.create({ linha: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 } });
