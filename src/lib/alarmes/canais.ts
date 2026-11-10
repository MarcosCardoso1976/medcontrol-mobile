import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { emExpoGo } from '@/lib/ambiente';
import { CANAL_ALARME, CANAL_LEMBRETE } from './plano';

export const CATEGORIA_DOSE = 'dose';
export const ACAO_TOMEI = 'tomei';
export const SOM_ALARME = 'alarm.wav';

let configurado = false;

/**
 * Cria canais (Android) e categoria de ações. Idempotente.
 * Atenção: depois de criado, o usuário controla o canal; para mudar som/importância crie um id novo (`_v2`).
 */
export async function configurarNotificacoes(): Promise<void> {
  if (configurado) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL_ALARME, {
      name: 'Alarmes de remédio',
      description: 'Aviso no horário de cada dose e lembretes de atraso',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 300, 500, 300, 800],
      lightColor: '#1BB89A',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: emExpoGo ? 'default' : SOM_ALARME, // no Expo Go o arquivo alarm.wav não existe
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      bypassDnd: false,
    });
    await Notifications.setNotificationChannelAsync(CANAL_LEMBRETE, {
      name: 'Lembretes',
      description: 'Aviso 15 minutos antes da dose',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#1BB89A',
    });
  }

  await Notifications.setNotificationCategoryAsync(CATEGORIA_DOSE, [
    { identifier: ACAO_TOMEI, buttonTitle: '✅ Tomei', options: { opensAppToForeground: true } },
  ]);

  // Com o app aberto, mostramos também o banner/som (a tela de alarme é aberta pelo listener da raiz).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  configurado = true;
}
