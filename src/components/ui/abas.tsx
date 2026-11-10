import { Pressable, StyleSheet, View } from 'react-native';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';
import { T } from './texto';

export function Abas<K extends string>({
  itens,
  valor,
  onChange,
}: {
  itens: { chave: K; titulo: string }[];
  valor: K;
  onChange: (k: K) => void;
}) {
  const { c } = useTema();
  return (
    <View style={[styles.lista, { backgroundColor: c.dark ? 'rgba(255,255,255,0.04)' : c.muted }]} accessibilityRole="tablist">
      {itens.map((i) => {
        const ativo = i.chave === valor;
        return (
          <Pressable
            key={i.chave}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            onPress={() => onChange(i.chave)}
            style={[styles.aba, ativo && { backgroundColor: c.tabActiveBg, borderColor: c.dark ? c.primaryBorder : c.border, borderWidth: 1 }]}
          >
            <T peso="bold" tam={14} style={{ color: ativo ? c.tabActiveText : c.mutedForeground }}>
              {i.titulo}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { flexDirection: 'row', borderRadius: radius.lg, padding: 4, height: 52 },
  aba: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
});
