import { diffDias, processarDia } from '@/lib/dominio/tratamento';
import { remedio } from './fixtures';

describe('diffDias', () => {
  it('calcula dias', () => {
    expect(diffDias('2026-11-01', '2026-11-07')).toBe(6);
    expect(diffDias('2026-02-27', '2026-03-02')).toBe(3);
    expect(diffDias('2026-11-07', '2026-11-07')).toBe(0);
  });
});

describe('dias de tratamento', () => {
  it('decrementa 1 na primeira abertura do dia', () => {
    const r = processarDia(remedio({ diasDeTratamento: 5 }), '2026-11-07');
    expect(r.remedio.diasDeTratamento).toBe(4);
    expect(r.remedio.ultimaDataDecrementoDiasTratamento).toBe('2026-11-07');
    expect(r.alterado).toBe(true);
  });
  it('não decrementa duas vezes no mesmo dia', () => {
    const r = processarDia(remedio({ diasDeTratamento: 4, ultimaDataDecrementoDiasTratamento: '2026-11-07' }), '2026-11-07');
    expect(r.remedio.diasDeTratamento).toBe(4);
    expect(r.alterado).toBe(false);
  });
  it('MELHORIA: decrementa pela diferença de dias', () => {
    const r = processarDia(remedio({ diasDeTratamento: 10, ultimaDataDecrementoDiasTratamento: '2026-11-03' }), '2026-11-07');
    expect(r.remedio.diasDeTratamento).toBe(6);
  });
  it('remove o remédio ao chegar a zero sem períodos diários', () => {
    const r = processarDia(remedio({ diasDeTratamento: 1 }), '2026-11-07');
    expect(r.remedio.diasDeTratamento).toBe(0);
    expect(r.remover).toBe(true);
  });
  it('mantém se houver período diário', () => {
    const r = processarDia(remedio({ diasDeTratamento: 1, periodosDiarios: ['manha'] }), '2026-11-07');
    expect(r.remover).toBe(false);
  });
  it('não passa de zero', () => {
    const r = processarDia(remedio({ diasDeTratamento: 2, ultimaDataDecrementoDiasTratamento: '2026-10-01' }), '2026-11-07');
    expect(r.remedio.diasDeTratamento).toBe(0);
  });
});

describe('recalculo da dosagem', () => {
  const base = remedio({
    estoqueDosagem: true, dosagemDiaria: 1.2, quantidadeTotalDosagem: 36, diasEmTratamento: 10,
  });
  it('calcula quando indefinido', () => {
    expect(processarDia(base, '2026-11-07').remedio.quantidadeRestanteDosagem).toBeCloseTo(24);
  });
  it('preserva ajuste manual divergente', () => {
    const r = processarDia({ ...base, quantidadeRestanteDosagem: 20 }, '2026-11-07');
    expect(r.remedio.quantidadeRestanteDosagem).toBe(20);
  });
  it('atualiza quando coincide com o cálculo', () => {
    const r = processarDia({ ...base, quantidadeRestanteDosagem: 24 }, '2026-11-07');
    expect(r.remedio.quantidadeRestanteDosagem).toBeCloseTo(24);
  });
});
