import { LinearGradient } from 'expo-linear-gradient';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icone } from '@/components/ui/icone';
import { T } from '@/components/ui/texto';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export function CalendarioCabecalho({
  dataRef,
  onMudar,
  onSelecionar,
}: {
  dataRef: Date;
  onMudar: (delta: number) => void;
  onSelecionar: (d: Date) => void;
}) {
  const { c } = useTema();
  const hoje = new Date();
  const inicio = startOfWeek(dataRef);
  const semana = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  const diaSemana = format(dataRef, 'EEEE', { locale: ptBR });
  const titulo = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

  return (
    <LinearGradient
      colors={c.calGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.cartao, { borderColor: c.dark ? 'rgba(27,184,154,0.18)' : c.border }]}
    >
      {c.dark ? <View style={styles.brilho} pointerEvents="none" /> : null}
      <T serif tam={30} style={{ lineHeight: 36 }} accessibilityRole="header">
        {titulo}
      </T>
      <View style={styles.linhaData}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dia anterior"
          hitSlop={10}
          onPress={() => onMudar(-1)}
          style={[styles.seta, { backgroundColor: c.dark ? 'rgba(255,255,255,0.08)' : c.muted }]}
        >
          <Icone nome="chevron-left" tam={16} cor={c.foreground} />
        </Pressable>
        <T tom="suave" peso="medium" tam={14} style={{ flex: 1 }} centro>
          {format(dataRef, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Próximo dia"
          hitSlop={10}
          onPress={() => onMudar(1)}
          style={[styles.seta, { backgroundColor: c.dark ? 'rgba(255,255,255,0.08)' : c.muted }]}
        >
          <Icone nome="chevron-right" tam={16} cor={c.foreground} />
        </Pressable>
      </View>

      <View style={styles.semana}>
        {semana.map((d, i) => {
          const selecionado = isSameDay(d, dataRef);
          const ehHoje = isSameDay(d, hoje);
          return (
            <Pressable
              key={d.toISOString()}
              accessibilityRole="button"
              accessibilityLabel={format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}
              accessibilityState={{ selected: selecionado }}
              onPress={() => onSelecionar(d)}
              style={styles.dia}
            >
              <T tam={10.5} peso="bold" tom={selecionado ? 'destaque' : 'suave'} style={{ textTransform: 'uppercase' }}>
                {DIAS[i]}
              </T>
              <View
                style={[
                  styles.bolinha,
                  selecionado
                    ? { backgroundColor: c.primary, transform: [{ scale: 1.05 }] }
                    : ehHoje
                      ? { backgroundColor: c.primarySoft, borderWidth: 1, borderColor: c.primaryBorder }
                      : { backgroundColor: c.dark ? 'rgba(255,255,255,0.05)' : c.muted },
                ]}
              >
                <T peso="bold" tam={14} style={{ color: selecionado ? c.primaryForeground : c.foreground }}>
                  {d.getDate()}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  cartao: { borderRadius: radius.xxl, borderWidth: 1.5, padding: 18, gap: 10, overflow: 'hidden' },
  brilho: { position: 'absolute', top: -60, right: -60, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(27,184,154,0.14)' },
  linhaData: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seta: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  semana: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dia: { alignItems: 'center', gap: 6, flex: 1 },
  bolinha: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
