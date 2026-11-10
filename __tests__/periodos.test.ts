import { horarioJaPassou, horarioValido, obterPeriodoPorHorario } from '@/lib/dominio/periodos';

describe('obterPeriodoPorHorario', () => {
  it.each([
    ['00:00', 'noite'],
    ['00:01', 'madrugada'],
    ['05:59', 'madrugada'],
    ['06:00', 'manha'],
    ['12:00', 'manha'],
    ['12:01', 'tarde'],
    ['18:00', 'tarde'],
    ['18:01', 'noite'],
    ['23:59', 'noite'],
  ])('%s → %s', (h, esperado) => {
    expect(obterPeriodoPorHorario(h)).toBe(esperado);
  });
});

describe('horarioJaPassou', () => {
  const agora = new Date(2026, 10, 7, 14, 30);
  it('passado', () => expect(horarioJaPassou('14:30', agora)).toBe(true));
  it('futuro', () => expect(horarioJaPassou('14:31', agora)).toBe(false));
  it('hora anterior', () => expect(horarioJaPassou('09:45', agora)).toBe(true));
});

describe('horarioValido', () => {
  it('aceita HH:mm', () => expect(horarioValido('07:05')).toBe(true));
  it('rejeita inválidos', () => {
    expect(horarioValido('7:05')).toBe(false);
    expect(horarioValido('24:00')).toBe(false);
    expect(horarioValido('12:60')).toBe(false);
  });
});
