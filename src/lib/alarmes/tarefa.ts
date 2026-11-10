import { emExpoGo } from '@/lib/ambiente';
import { replanejar } from './index';

export const TAREFA_REABASTECER = 'medcontrol-reabastecer-alarmes';

/* eslint-disable @typescript-eslint/no-require-imports -- carregados só fora do Expo Go (lá o TaskManager não existe no Android) */
type TaskManagerMod = typeof import('expo-task-manager');
type BackgroundTaskMod = typeof import('expo-background-task');

function modulos(): { TaskManager: TaskManagerMod; BackgroundTask: BackgroundTaskMod } | null {
  if (emExpoGo) return null;
  try {
    return { TaskManager: require('expo-task-manager'), BackgroundTask: require('expo-background-task') };
  } catch {
    return null;
  }
}

// A tarefa precisa ser definida no escopo do módulo (importado na raiz do app).
const mods = modulos();
if (mods) {
  try {
    mods.TaskManager.defineTask(TAREFA_REABASTECER, async () => {
      try {
        await replanejar({ imediato: true });
        return mods.BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return mods.BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch (e) {
    console.warn('[alarmes] não foi possível definir a tarefa em segundo plano:', e);
  }
}

/** Registra a tarefa periódica que reabastece a janela de alarmes (o SO decide quando executa). */
export async function registrarTarefaReabastecimento(): Promise<void> {
  if (!mods) return;
  try {
    const { TaskManager, BackgroundTask } = mods;
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;
    const registrada = await TaskManager.isTaskRegisteredAsync(TAREFA_REABASTECER);
    if (!registrada) await BackgroundTask.registerTaskAsync(TAREFA_REABASTECER, { minimumInterval: 12 * 60 });
  } catch (e) {
    console.warn('[alarmes] tarefa em segundo plano indisponível:', e);
  }
}
