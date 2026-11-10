import { Platform } from 'react-native';
import { remedio } from './fixtures';

const mockAgendadas = new Map<string, any>();
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getAllScheduledNotificationsAsync: jest.fn(async () => [...mockAgendadas.values()]),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    mockAgendadas.delete(id);
  }),
  scheduleNotificationAsync: jest.fn(async (req: any) => {
    mockAgendadas.set(req.identifier, req);
    return req.identifier;
  }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => mockAgendadas.clear()),
  getPresentedNotificationsAsync: jest.fn(async () => []),
  dismissNotificationAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-sqlite', () => {
  const { criarBancoMemoria } = require('./helpers/sqlite-shim');
  return { openDatabaseAsync: async () => criarBancoMemoria() };
});
const mockPermissoes = { notificacoes: 'granted', podePedirNotificacao: false, alarmeExato: true, podePedirAlarmeExato: false };
jest.mock('@/lib/alarmes/permissoes', () => ({ obterEstadoPermissoes: jest.fn(async () => mockPermissoes) }));
jest.mock('@/lib/alarmes/canais', () => ({
  configurarNotificacoes: jest.fn(async () => undefined),
  CATEGORIA_DOSE: 'dose',
  SOM_ALARME: 'alarm.wav',
  ACAO_TOMEI: 'tomei',
}));

import * as Notifications from 'expo-notifications';
import { cancelarDose, aplicarPlano } from '@/lib/alarmes/agendador';
import { estadoAlarmes, replanejar } from '@/lib/alarmes';
import { calcularPlano } from '@/lib/alarmes/plano';
import * as repo from '@/lib/db/repo';

const AGORA = new Date(2026, 10, 7, 7, 0);
const listas = [{ id: 'l1', nome: 'Geral', criadaEm: '2026-01-01T00:00:00.000Z' }];
const plano = (r = remedio(), opt = {}) =>
  calcularPlano([r], [], listas, { agora: AGORA, plataforma: 'android', preAviso: true, atrasos: true, horizonteDias: 2, ...opt }).notificacoes;

beforeEach(() => {
  mockAgendadas.clear();
  jest.clearAllMocks();
  (Platform as any).OS = 'android';
});

describe('agendador', () => {
  it('Android: dose e atraso usam alarmClock; pré-aviso usa bestEffort; canal correto', async () => {
    await aplicarPlano(plano());
    const por = (prefixo: string) => [...mockAgendadas.values()].filter((r) => r.identifier.startsWith(prefixo));
    expect(por('dose|').length).toBe(2);
    for (const r of por('dose|')) expect(r.trigger).toMatchObject({ type: 'date', delivery: 'alarmClock', channelId: 'medcontrol_alarme_v1' });
    for (const r of por('late|')) expect(r.trigger).toMatchObject({ delivery: 'alarmClock', channelId: 'medcontrol_alarme_v1' });
    for (const r of por('pre|')) expect(r.trigger).toMatchObject({ delivery: 'bestEffort', channelId: 'medcontrol_lembrete_v1' });
    const dose = por('dose|')[0];
    expect(dose.content).toMatchObject({ title: '⏰ Hora do Remédio!', categoryIdentifier: 'dose' });
    expect(dose.content.data).toMatchObject({ tipo: 'dose', remedioId: 'r1', horario: '08:00' });
    expect(dose.trigger.date).toEqual(new Date(2026, 10, 7, 8, 0));
  });

  it('iOS usa o som personalizado no conteúdo', async () => {
    (Platform as any).OS = 'ios';
    await aplicarPlano(plano(remedio(), { plataforma: 'ios' }));
    expect([...mockAgendadas.values()][0].content.sound).toBe('alarm.wav');
  });

  it('reaplicar o mesmo plano não cancela nem agenda nada', async () => {
    await aplicarPlano(plano());
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();
    await aplicarPlano(plano());
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('mudança de texto reagenda só o que mudou; remoção cancela', async () => {
    await aplicarPlano(plano());
    const total = mockAgendadas.size;
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
    await aplicarPlano(plano(remedio({ nome: 'Outro nome' })));
    expect(mockAgendadas.size).toBe(total);
    expect([...mockAgendadas.values()].every((r) => r.content.body.startsWith('Outro nome'))).toBe(true);

    await aplicarPlano(plano(remedio({ ativo: false })));
    expect(mockAgendadas.size).toBe(0);
  });

  it('remove agendamentos antigos que não pertencem ao plano', async () => {
    mockAgendadas.set('lixo', { identifier: 'lixo', content: { data: {} }, trigger: {} });
    await aplicarPlano(plano());
    expect(mockAgendadas.has('lixo')).toBe(false);
  });

  it('cancelarDose remove dose, pré-aviso e os 3 atrasos', async () => {
    await aplicarPlano(plano());
    await cancelarDose('r1', 'manha', '08:00', '2026-11-07');
    const ids = [...mockAgendadas.keys()];
    expect(ids.filter((i) => i.includes('2026-11-07'))).toEqual([]);
    expect(ids.filter((i) => i.includes('2026-11-08')).length).toBe(5); // o dia seguinte permanece
  });
});

describe('replanejar (a partir do banco local)', () => {
  beforeEach(async () => {
    await repo.resetarDadosLocais();
    mockPermissoes.notificacoes = 'granted';
  });

  it('lê remédios do SQLite, agenda e publica a cobertura', async () => {
    await repo.salvarListaLocal({ id: 'l1', nome: 'Geral', criadaEm: '2026-01-01T00:00:00.000Z', remoto: true }, false);
    await repo.salvarRemedioLocal(remedio({ id: 'r1', listaId: 'l1', horarios: [{ id: 'h', periodo: 'noite', horario: '23:30' }] }), false);
    await replanejar({ imediato: true });
    expect(mockAgendadas.size).toBeGreaterThan(0);
    expect([...mockAgendadas.keys()].some((k) => k.startsWith('dose|r1|noite|23:30|'))).toBe(true);
    const e = estadoAlarmes.get();
    expect(e.erro).toBeNull();
    expect(e.total).toBe(mockAgendadas.size);
    expect(e.coberturaAte).not.toBeNull();
  });

  it('preferências desligam pré-aviso e atrasos', async () => {
    await repo.salvarListaLocal({ id: 'l1', nome: 'Geral', criadaEm: '2026-01-01T00:00:00.000Z', remoto: true }, false);
    await repo.salvarRemedioLocal(remedio({ id: 'r1', listaId: 'l1', horarios: [{ id: 'h', periodo: 'noite', horario: '23:30' }] }), false);
    await repo.setMeta('pref_preaviso', '0');
    await repo.setMeta('pref_atrasos', '0');
    await replanejar({ imediato: true });
    expect([...mockAgendadas.keys()].every((k) => k.startsWith('dose|'))).toBe(true);
  });

  it('sem permissão de notificação não agenda nada e não gera erro', async () => {
    mockPermissoes.notificacoes = 'denied';
    await repo.salvarListaLocal({ id: 'l1', nome: 'Geral', criadaEm: '2026-01-01T00:00:00.000Z', remoto: true }, false);
    await repo.salvarRemedioLocal(remedio({ id: 'r1', listaId: 'l1' }), false);
    await replanejar({ imediato: true });
    expect(mockAgendadas.size).toBe(0);
    expect(estadoAlarmes.get()).toMatchObject({ total: 0, erro: null });
  });

  it('chamadas seguidas são unificadas (debounce)', async () => {
    await repo.salvarListaLocal({ id: 'l1', nome: 'Geral', criadaEm: '2026-01-01T00:00:00.000Z', remoto: true }, false);
    await repo.salvarRemedioLocal(remedio({ id: 'r1', listaId: 'l1', horarios: [{ id: 'h', periodo: 'noite', horario: '23:30' }] }), false);
    await Promise.all([replanejar(), replanejar(), replanejar()]);
    const n = (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mock.calls.length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(2);
  });
});
