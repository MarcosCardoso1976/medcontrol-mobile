import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Vibration, View } from 'react-native';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { T } from '@/components/ui/texto';
import { PERIODO_EMOJIS, PERIODO_LABELS } from '@/lib/dominio/periodos';
import { marcarTomado, useApp } from '@/lib/store';
import { toast } from '@/lib/toast';
import { getLocalDateString } from '@/lib/utils';
import type { Periodo } from '@/types/remedio';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';

/** Tela aberta ao tocar no alarme (ou quando a dose vence com o app aberto). */
export default function Alarme() {
  const { c } = useTema();
  const router = useRouter();
  const { remedioId, periodo, horario, dia } = useLocalSearchParams<{ remedioId?: string; periodo?: string; horario?: string; dia?: string }>();
  const pronto = useApp((s) => s.pronto);
  const remedios = useApp((s) => s.remedios);
  const listas = useApp((s) => s.listas);
  const tomados = useApp((s) => s.tomados);

  const remedio = remedios.find((r) => r.id === remedioId);
  const lista = listas.find((l) => l.id === remedio?.listaId);
  const dataDose = dia ?? getLocalDateString();
  const jaTomado = !!remedio && tomados.some((t) => t.remedioId === remedio.id && t.periodo === periodo && t.horario === horario && t.data === dataDose);
  const p = (periodo as Periodo | undefined) ?? 'manha';

  // vibração repetida enquanto a tela estiver aberta (equivale ao beep a cada 2 s do web)
  useEffect(() => {
    if (jaTomado || !remedio) return;
    Vibration.vibrate([0, 600, 400, 600, 1200], true);
    return () => Vibration.cancel();
  }, [jaTomado, remedio]);

  const fechar = () => {
    Vibration.cancel();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const tomei = async () => {
    if (!remedio || !horario) return;
    await marcarTomado(remedio.id, p, horario, dataDose, 'marcar');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.sucesso('Remédio tomado');
    fechar();
  };

  return (
    <View style={[styles.fundo, { backgroundColor: c.overlay }]}>
      <Cartao estilo={[styles.cartao, { backgroundColor: c.surface }]} accessibilityViewIsModal>
        {!pronto ? (
          <T tom="suave" centro>
            Carregando…
          </T>
        ) : !remedio || !horario ? (
          <>
            <T peso="extra" tam={18} centro>
              Remédio não encontrado
            </T>
            <T tom="suave" tam={14} centro>
              Este lembrete se refere a um remédio que não existe mais.
            </T>
            <Botao titulo="Fechar" onPress={fechar} />
          </>
        ) : (
          <>
            <View style={[styles.icone, { backgroundColor: c.primarySoft }]}>
              <T tam={34}>{PERIODO_EMOJIS[p]}</T>
            </View>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <T peso="extra" tam={12} tom="suave" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                {jaTomado ? 'Dose já registrada' : 'Hora do remédio!'}
              </T>
              <T tam={12} tom="suave">
                Lista: {lista?.nome ?? 'Geral'}
              </T>
            </View>
            <T peso="extra" tam={30} tom="primario">
              {horario} · {PERIODO_EMOJIS[p]} {PERIODO_LABELS[p]}
            </T>
            <T peso="extra" tam={24} centro accessibilityRole="header">
              {remedio.nome}
            </T>
            {jaTomado ? (
              <>
                <T tom="suave" tam={14} centro>
                  Esta dose já foi marcada como tomada.
                </T>
                <Botao titulo="Fechar" onPress={fechar} estilo={{ alignSelf: 'stretch' }} />
              </>
            ) : (
              <View style={styles.botoes}>
                <Botao titulo="Fechar" variante="contorno" tamanho="lg" onPress={fechar} estilo={{ flex: 1 }} />
                <Botao titulo="Tomei!" icone="check-circle" tamanho="lg" onPress={tomei} estilo={{ flex: 1.5 }} />
              </View>
            )}
          </>
        )}
      </Cartao>
    </View>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'center', padding: 24 },
  cartao: { borderRadius: radius.xxl + 4, padding: 24, gap: 14, alignItems: 'center' },
  icone: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  botoes: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
});
