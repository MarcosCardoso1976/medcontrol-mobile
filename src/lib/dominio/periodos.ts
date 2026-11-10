import type { HorarioRemedio, Periodo } from '@/types/remedio';

export const PERIODOS_ORDEM: Periodo[] = ['madrugada', 'manha', 'tarde', 'noite'];

export const PERIODO_LABELS: Record<Periodo, string> = {
  madrugada: 'Madrugada',
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

export const PERIODO_EMOJIS: Record<Periodo, string> = {
  madrugada: '🌃',
  manha: '🌅',
  tarde: '☀️',
  noite: '🌙',
};

/**
 * Madrugada 00:01–05:59 · Manhã 06:00–12:00 · Tarde 12:01–18:00 · Noite 18:01–00:00
 */
export function obterPeriodoPorHorario(horario: string): Periodo {
  const [h, m] = horario.split(':').map(Number);
  const total = h * 60 + m;
  if (total >= 1 && total <= 359) return 'madrugada';
  if (total >= 360 && total <= 720) return 'manha';
  if (total >= 721 && total <= 1080) return 'tarde';
  return 'noite';
}

export function ordenarHorarios(horarios: HorarioRemedio[]): HorarioRemedio[] {
  return [...horarios].sort((a, b) => a.horario.localeCompare(b.horario));
}

export function obterHorariosPorPeriodo(horarios: HorarioRemedio[], periodo: Periodo): HorarioRemedio[] {
  return ordenarHorarios(horarios.filter((h) => h.periodo === periodo));
}

export function periodosDoRemedio(horarios: HorarioRemedio[]): Periodo[] {
  return PERIODOS_ORDEM.filter((p) => horarios.some((h) => h.periodo === p));
}

/** O horário (HH:mm) de hoje já passou em relação a `agora`? */
export function horarioJaPassou(horario: string, agora: Date): boolean {
  const [h, m] = horario.split(':').map(Number);
  return h < agora.getHours() || (h === agora.getHours() && m <= agora.getMinutes());
}

export function horarioValido(horario: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(horario);
}
