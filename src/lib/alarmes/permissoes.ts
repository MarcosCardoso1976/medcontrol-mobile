import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

export interface EstadoPermissoes {
  notificacoes: 'granted' | 'denied' | 'undetermined';
  podePedirNotificacao: boolean;
  /** Android 12+: permissão de alarme exato. No iOS é sempre true. */
  alarmeExato: boolean;
  podePedirAlarmeExato: boolean;
}

export async function obterEstadoPermissoes(): Promise<EstadoPermissoes> {
  const n = await Notifications.getPermissionsAsync();
  let alarmeExato = true;
  let podePedirAlarmeExato = false;
  if (Platform.OS === 'android') {
    try {
      const e = await Notifications.getExactAlarmPermissionsAsync();
      alarmeExato = e.granted;
      podePedirAlarmeExato = !e.granted && e.canAskAgain;
    } catch {
      alarmeExato = true;
    }
  }
  return {
    notificacoes: n.granted ? 'granted' : n.canAskAgain ? 'undetermined' : 'denied',
    podePedirNotificacao: !n.granted && n.canAskAgain,
    alarmeExato,
    podePedirAlarmeExato,
  };
}

export async function pedirNotificacoes(): Promise<boolean> {
  const r = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return r.granted;
}

/** Abre a tela do sistema para liberar "Alarmes e lembretes" (Android 12+). */
export async function pedirAlarmeExato(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const r = await Notifications.requestExactAlarmPermissionsAsync();
    return r.granted;
  } catch {
    return false;
  }
}

export async function abrirConfiguracoesDoApp(): Promise<void> {
  await Linking.openSettings();
}

/** Abre a lista de otimização de bateria do Android (o usuário escolhe "Sem restrições" para o MedControl). */
export async function abrirConfigBateria(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
  } catch {
    await Linking.openSettings();
  }
}
