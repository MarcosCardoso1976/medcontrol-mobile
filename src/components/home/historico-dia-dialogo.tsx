import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { View } from 'react-native';
import { Botao } from '@/components/ui/botao';
import { Dialogo } from '@/components/ui/dialogo';
import { T } from '@/components/ui/texto';
import type { Remedio, RemedioTomado } from '@/types/remedio';
import { LinhaTomado } from './historico-remedios';

export function HistoricoDiaDialogo({
  data,
  hoje,
  tomados,
  remedios,
  onFechar,
}: {
  data: string | null;
  hoje: string;
  tomados: RemedioTomado[];
  remedios: Remedio[];
  onFechar: () => void;
}) {
  const doDia = data ? tomados.filter((t) => t.data === data).sort((a, b) => a.horario.localeCompare(b.horario)) : [];
  const titulo = !data ? '' : data === hoje ? 'Tomados Hoje' : `Tomados em ${format(parseISO(data), "d 'de' MMMM", { locale: ptBR })}`;
  return (
    <Dialogo
      aberto={!!data}
      onFechar={onFechar}
      titulo={titulo}
      acoes={<Botao titulo="Fechar" onPress={onFechar} estilo={{ flex: 1 }} />}
    >
      {doDia.length === 0 ? (
        <T tom="suave" tam={14} centro style={{ paddingVertical: 18 }}>
          Nenhum remédio tomado nesta data.
        </T>
      ) : (
        <View style={{ gap: 8 }}>
          {doDia.map((t) => (
            <LinhaTomado key={`${t.remedioId}|${t.periodo}|${t.horario}`} t={t} remedios={remedios} />
          ))}
        </View>
      )}
    </Dialogo>
  );
}
