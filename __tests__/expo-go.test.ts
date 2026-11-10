import { remedio } from './fixtures';

const mockAgendadas = new Map<string, { identifier: string; content: { sound?: unknown }; trigger: { delivery?: string } }>();
jest.mock('@/lib/ambiente', () => ({ emExpoGo: true }));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getAllScheduledNotificationsAsync: jest.fn(async () => [...mockAgendadas.values()]),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => void mockAgendadas.delete(id)),
  scheduleNotificationAsync: jest.fn(async (req: never) => {
    mockAgendadas.set((req as { identifier: string }).identifier, req);
    return 'ok';
  }),
}));

import { aplicarPlano } from '@/lib/alarmes/agendador';
import { calcularPlano } from '@/lib/alarmes/plano';
import { registrarTarefaReabastecimento } from '@/lib/alarmes/tarefa';

describe('Expo Go', () => {
  it('não usa alarmClock nem som personalizado (recursos que só existem no development build)', async () => {
    const plano = calcularPlano([remedio()], [], [{ id: 'l1', nome: 'Geral', criadaEm: '' }], {
      agora: new Date(2026, 10, 7, 7, 0), plataforma: 'android', preAviso: true, atrasos: true, horizonteDias: 1,
    });
    await aplicarPlano(plano.notificacoes);
    expect(mockAgendadas.size).toBeGreaterThan(0);
    for (const r of mockAgendadas.values()) {
      expect(r.trigger.delivery).toBe('bestEffort');
      expect(r.content.sound).toBe(true);
    }
  });

  it('a tarefa em segundo plano é ignorada sem erro', async () => {
    await expect(registrarTarefaReabastecimento()).resolves.toBeUndefined();
  });
});
