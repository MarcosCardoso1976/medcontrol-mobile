import type { Remedio } from '@/types/remedio';

export function remedio(parcial: Partial<Remedio> = {}): Remedio {
  return {
    id: 'r1',
    listaId: 'l1',
    nome: 'Dipirona',
    horarios: [{ id: 'h1', periodo: 'manha', horario: '08:00' }],
    ativo: true,
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
    ...parcial,
  };
}
