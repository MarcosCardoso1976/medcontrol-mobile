import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Campo } from '@/components/ui/campo';
import { T } from '@/components/ui/texto';
import { api, type MedicamentoSugestao } from '@/lib/api/client';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';

/** Campo de nome com sugestões da base da Anvisa. Offline ou sem API, funciona como texto livre. */
export function AutocompleteMedicamento({ valor, onChange, erro }: { valor: string; onChange: (v: string) => void; erro?: string }) {
  const { c } = useTema();
  const [sugestoes, setSugestoes] = useState<MedicamentoSugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const ignorarBusca = useRef(false);

  useEffect(() => {
    if (ignorarBusca.current) {
      ignorarBusca.current = false;
      return;
    }
    const termo = valor.trim();
    if (termo.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa as sugestões quando o termo fica curto
      setSugestoes([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await api.buscarMedicamentos(termo, ctrl.signal);
        setSugestoes(r.slice(0, 10));
        setAberto(r.length > 0);
      } catch {
        setSugestoes([]);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [valor]);

  return (
    <View style={{ zIndex: 5 }}>
      <Campo
        rotulo="Nome do remédio"
        value={valor}
        onChangeText={(t) => {
          onChange(t);
          setAberto(true);
        }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder="Ex.: Dipirona"
        autoCapitalize="words"
        autoCorrect={false}
        erro={erro}
      />
      {aberto && sugestoes.length > 0 ? (
        <View style={[styles.lista, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityLabel="Sugestões de medicamentos">
          {sugestoes.map((s) => (
            <Pressable
              key={s.nome}
              accessibilityRole="button"
              accessibilityLabel={`Usar ${s.nome}`}
              style={({ pressed }) => [styles.item, { backgroundColor: pressed ? c.primarySoft : 'transparent', borderColor: c.border }]}
              onPress={() => {
                ignorarBusca.current = true;
                onChange(s.nome);
                setSugestoes([]);
                setAberto(false);
              }}
            >
              <T peso="bold" tam={14} numberOfLines={1}>
                {s.nome}
              </T>
              {s.principioAtivo ? (
                <T tom="suave" tam={12} numberOfLines={1}>
                  {s.principioAtivo}
                </T>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { marginTop: 6, borderWidth: 1.5, borderRadius: radius.md, overflow: 'hidden' },
  item: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
