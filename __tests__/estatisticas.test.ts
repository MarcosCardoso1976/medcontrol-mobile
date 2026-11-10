import { dosesPendentes, progressoDoDia } from '@/lib/dominio/estatisticas';
import type { RemedioTomado } from '@/types/remedio';
import { remedio } from './fixtures';

const HOJE = '2026-11-07';
const agora = new Date(2026, 10, 7, 10, 0);
const r = remedio({
  horarios: [
    { id: 'a', periodo: 'manha', horario: '08:00' },
    { id: 'b', periodo: 'tarde', horario: '14:00' },
  ],
});
const tomado = (horario: string, periodo: 'manha' | 'tarde' = 'manha'): RemedioTomado => ({
  remedioId: 'r1', periodo, horario, data: HOJE, tomadoEm: '2026-11-07T11:00:00.000Z',
});

describe('dosesPendentes', () => {
  it('conta doses passadas não tomadas', () => expect(dosesPendentes([r], [], HOJE, agora)).toBe(1));
  it('ignora doses tomadas', () => expect(dosesPendentes([r], [tomado('08:00')], HOJE, agora)).toBe(0));
  it('ignora remédios inativos', () => expect(dosesPendentes([{ ...r, ativo: false }], [], HOJE, agora)).toBe(0));
  it('ignora tomados de outro dia', () => {
    expect(dosesPendentes([r], [{ ...tomado('08:00'), data: '2026-11-06' }], HOJE, agora)).toBe(1);
  });
});

describe('progressoDoDia', () => {
  it('calcula porcentagem', () => {
    expect(progressoDoDia([r], [tomado('08:00')], HOJE)).toEqual({ total: 2, tomados: 1, restantes: 1, porcentagem: 50 });
  });
  it('sem remédios → 0%', () => {
    expect(progressoDoDia([], [], HOJE).porcentagem).toBe(0);
  });
});
