import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { emExpoGo } from '@/lib/ambiente';
import { CATEGORIA_DOSE, SOM_ALARME } from './canais';
import { ATRASOS_MIN, idDose, type NotificacaoPlanejada } from './plano';

let fila: Promise<void> = Promise.resolve();

/** Serializa as aplicações: nunca duas ao mesmo tempo. */
export function aplicarPlano(plano: NotificacaoPlanejada[]): Promise<void> {
  const proxima = fila.then(() => aplicar(plano));
  fila = proxima.catch(() => undefined);
  return proxima;
}

function conteudo(n: NotificacaoPlanejada): Notifications.NotificationContentInput {
  return {
    title: n.titulo,
    body: n.corpo,
    data: n.data,
    sound: Platform.OS === 'ios' && !emExpoGo ? SOM_ALARME : true,
    categoryIdentifier: CATEGORIA_DOSE,
  };
}

function gatilho(n: NotificacaoPlanejada): Notifications.DateTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: n.quando,
    channelId: n.canal,
    // Android: setAlarmClock() — entrega no horário exato, sem adiamento por economia de bateria.
    // (Sem a permissão de alarme exato o próprio módulo cai para 'bestEffort'.)
    delivery: n.tipo === 'pre' || emExpoGo ? 'bestEffort' : 'alarmClock',
  };
}

async function aplicar(plano: NotificacaoPlanejada[]) {
  const desejadas = new Map(plano.map((n) => [n.id, n]));
  const agendadas = await Notifications.getAllScheduledNotificationsAsync();

  // 1) cancelar o que sobrou, o que mudou e o que não é nosso formato
  const mantidas = new Set<string>();
  for (const a of agendadas) {
    const alvo = desejadas.get(a.identifier);
    const sigAtual = (a.content.data as { sig?: string } | null)?.sig;
    if (alvo && sigAtual === alvo.data.sig) mantidas.add(a.identifier);
    else await Notifications.cancelScheduledNotificationAsync(a.identifier);
  }

  // 2) agendar o que falta
  for (const n of plano) {
    if (mantidas.has(n.id)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: conteudo(n),
      trigger: gatilho(n),
    });
  }
}

/** Cancela de imediato todos os avisos (principal, pré e atrasos) de uma dose específica. */
export async function cancelarDose(remedioId: string, periodo: string, horario: string, dia: string): Promise<void> {
  const base = idDose(remedioId, periodo, horario, dia);
  const ids = [`dose|${base}`, `pre|${base}`, ...ATRASOS_MIN.map((_, i) => `late|${base}|${i + 1}`)];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  // também remove da bandeja o que já foi exibido
  try {
    const presentes = await Notifications.getPresentedNotificationsAsync();
    for (const p of presentes) {
      if (ids.includes(p.request.identifier)) await Notifications.dismissNotificationAsync(p.request.identifier);
    }
  } catch {
    /* ignorar */
  }
}

export async function listarAgendadas() {
  const todas = await Notifications.getAllScheduledNotificationsAsync();
  return todas.map((a) => ({
    id: a.identifier,
    titulo: a.content.title ?? '',
    corpo: a.content.body ?? '',
    sig: (a.content.data as { sig?: string } | null)?.sig ?? '',
  }));
}

export async function cancelarTudo() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Agenda um alarme de teste daqui a `segundos` (usa o mesmo canal/entrega dos alarmes reais). */
export async function agendarTeste(segundos = 10): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: 'teste|alarme',
    content: {
      title: '⏰ Hora do Remédio! (teste)',
      body: 'Este é um alarme de teste do MedControl.',
      sound: Platform.OS === 'ios' && !emExpoGo ? SOM_ALARME : true,
      data: { tipo: 'teste' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + segundos * 1000),
      channelId: 'medcontrol_alarme_v1',
      delivery: emExpoGo ? 'bestEffort' : 'alarmClock',
    },
  });
}
