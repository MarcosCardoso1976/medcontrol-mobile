import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Botao } from '@/components/ui/botao';
import { Dialogo } from '@/components/ui/dialogo';
import { Icone } from '@/components/ui/icone';
import { T } from '@/components/ui/texto';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';

function paraData(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 8, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}
const paraHHmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function CampoHora({ valor, onChange, rotulo }: { valor: string; onChange: (v: string) => void; rotulo: string }) {
  const { c } = useTema();
  const [ios, setIos] = useState<Date | null>(null);

  const abrir = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: paraData(valor),
        mode: 'time',
        is24Hour: true,
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) onChange(paraHHmm(d));
        },
      });
    } else {
      setIos(paraData(valor));
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: ${valor}. Toque para alterar`}
        onPress={abrir}
        style={({ pressed }) => [
          styles.campo,
          { borderColor: c.input, backgroundColor: c.dark ? 'rgba(255,255,255,0.04)' : c.card, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
      >
        <Icone nome="clock" tam={16} cor={c.primaryLight} />
        <T peso="extra" tam={17}>
          {valor}
        </T>
      </Pressable>

      {Platform.OS === 'ios' ? (
        <Dialogo
          aberto={!!ios}
          onFechar={() => setIos(null)}
          titulo={rotulo}
          acoes={
            <>
              <Botao titulo="Cancelar" variante="contorno" onPress={() => setIos(null)} estilo={{ flex: 1 }} />
              <Botao
                titulo="OK"
                onPress={() => {
                  if (ios) onChange(paraHHmm(ios));
                  setIos(null);
                }}
                estilo={{ flex: 1 }}
              />
            </>
          }
        >
          {ios ? (
            <DateTimePicker
              value={ios}
              mode="time"
              display="spinner"
              is24Hour
              themeVariant={c.dark ? 'dark' : 'light'}
              onChange={(_e: DateTimePickerEvent, d?: Date) => d && setIos(d)}
            />
          ) : null}
        </Dialogo>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  campo: { height: 46, minWidth: 104, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 12 },
});
