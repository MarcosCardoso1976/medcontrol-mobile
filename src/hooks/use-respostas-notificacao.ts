import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { ACAO_TOMEI } from '@/lib/alarmes/canais';
import type { DadosNotificacao } from '@/lib/alarmes/plano';
import { marcarTomado, useApp } from '@/lib/store';
import { toast } from '@/lib/toast';
import type { Periodo } from '@/types/remedio';

type Dados = Partial<DadosNotificacao>;

function dadosValidos(d: Dados | undefined): d is Dados & { remedioId: string; periodo: Periodo; horario: string; dia: string } {
  return !!d && !!d.remedioId && !!d.periodo && !!d.horario && !!d.dia;
}

/**
 * Liga as notificações ao app:
 *  • toque na notificação (inclusive com o app fechado) → abre a tela de alarme;
 *  • ação "✅ Tomei" → marca a dose direto;
 *  • notificação recebida com o app aberto → abre a tela de alarme.
 */
export function useRespostasNotificacao() {
  const router = useRouter();
  const pronto = useApp((s) => s.pronto);
  const resposta = Notifications.useLastNotificationResponse();
  const processada = useRef<string | null>(null);

  useEffect(() => {
    if (!pronto || !resposta) return;
    const { identifier, content } = resposta.notification.request;
    const chave = `${identifier}|${resposta.notification.date}|${resposta.actionIdentifier}`;
    if (processada.current === chave) return;
    processada.current = chave;

    const d = content.data as Dados | undefined;
    if (!dadosValidos(d)) return;

    if (resposta.actionIdentifier === ACAO_TOMEI) {
      void marcarTomado(d.remedioId, d.periodo, d.horario, d.dia, 'marcar').then((r) => {
        if (r === 'marcado') toast.sucesso('Remédio tomado');
      });
    } else if (resposta.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.push({ pathname: '/alarme', params: { remedioId: d.remedioId, periodo: d.periodo, horario: d.horario, dia: d.dia } });
    }
  }, [pronto, resposta, router]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      if (AppState.currentState !== 'active') return;
      const d = n.request.content.data as Dados | undefined;
      if (!dadosValidos(d) || (d.tipo !== 'dose' && d.tipo !== 'late')) return;
      router.push({ pathname: '/alarme', params: { remedioId: d.remedioId, periodo: d.periodo, horario: d.horario, dia: d.dia } });
    });
    return () => sub.remove();
  }, [router]);
}
