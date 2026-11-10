import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { Confirmar } from '@/components/ui/dialogo';
import { T } from '@/components/ui/texto';
import { PERIODO_EMOJIS, PERIODO_LABELS } from '@/lib/dominio/periodos';
import type { Remedio, RemedioTomado } from '@/types/remedio';
import { useTema } from '@/theme/theme-provider';

const LIMITE = 200;

export function horaTomado(t: RemedioTomado): string {
  try {
    return format(new Date(t.tomadoEm), 'HH:mm');
  } catch {
    return '--:--';
  }
}

export function LinhaTomado({ t, remedios }: { t: RemedioTomado; remedios: Remedio[] }) {
  const { c } = useTema();
  const r = remedios.find((x) => x.id === t.remedioId);
  return (
    <View style={[styles.linha, { backgroundColor: c.dark ? 'rgba(255,255,255,0.04)' : c.muted }]}>
      <T tam={20}>{PERIODO_EMOJIS[t.periodo]}</T>
      <View style={{ flex: 1 }}>
        <T peso="bold" tam={14.5} numberOfLines={1}>
          {r?.nome ?? 'Remédio removido'}
        </T>
        <T tom="suave" tam={12.5}>
          {PERIODO_LABELS[t.periodo]} · agendado {t.horario}
        </T>
      </View>
      <T tom="primario" peso="bold" tam={12.5}>
        Tomado às {horaTomado(t)}
      </T>
    </View>
  );
}

export function HistoricoRemedios({ tomados, remedios, onLimpar }: { tomados: RemedioTomado[]; remedios: Remedio[]; onLimpar: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const grupos = useMemo(() => {
    const mapa = new Map<string, RemedioTomado[]>();
    for (const t of [...tomados].sort((a, b) => b.tomadoEm.localeCompare(a.tomadoEm)).slice(0, LIMITE)) {
      mapa.set(t.data, [...(mapa.get(t.data) ?? []), t]);
    }
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [tomados]);

  if (tomados.length === 0) {
    return (
      <Cartao estilo={styles.vazio}>
        <T tam={38}>🗓️</T>
        <T peso="extra" tam={16} centro>
          Nenhum registro ainda
        </T>
        <T tom="suave" tam={14} centro>
          Os remédios que você marcar como tomados aparecem aqui.
        </T>
      </Cartao>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {grupos.map(([data, itens]) => (
        <Cartao key={data} estilo={{ padding: 14, gap: 8 }}>
          <T peso="extra" tam={14} style={{ textTransform: 'capitalize' }}>
            {format(parseISO(data), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </T>
          {itens.map((t) => (
            <LinhaTomado key={`${t.remedioId}|${t.periodo}|${t.horario}|${t.data}`} t={t} remedios={remedios} />
          ))}
        </Cartao>
      ))}
      {tomados.length > LIMITE ? (
        <T tom="suave" tam={12} centro>
          Mostrando os últimos {LIMITE} registros.
        </T>
      ) : null}
      <Botao titulo="Limpar Histórico" variante="contorno" icone="trash-2" onPress={() => setConfirmar(true)} />
      <Confirmar
        aberto={confirmar}
        titulo="Limpar todo o histórico?"
        descricao="Todos os registros de remédios tomados serão apagados. Esta ação não pode ser desfeita."
        confirmarTexto="Limpar"
        perigo
        onCancelar={() => setConfirmar(false)}
        onConfirmar={() => {
          setConfirmar(false);
          onLimpar();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  vazio: { padding: 28, alignItems: 'center', gap: 8 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14 },
});
