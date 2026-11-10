import type { Remedio, RemedioTomado } from '@/types/remedio';
import { horarioJaPassou } from './periodos';

/** Doses de hoje que já passaram do horário e ainda não foram tomadas. */
export function dosesPendentes(remedios: Remedio[], tomados: RemedioTomado[], hoje: string, agora: Date): number {
  let pendentes = 0;
  for (const r of remedios.filter((x) => x.ativo)) {
    for (const h of r.horarios) {
      if (!horarioJaPassou(h.horario, agora)) continue;
      const jaTomado = tomados.some(
        (t) => t.remedioId === r.id && t.periodo === h.periodo && t.horario === h.horario && t.data === hoje,
      );
      if (!jaTomado) pendentes++;
    }
  }
  return pendentes;
}

export function dosePendente(
  r: Remedio,
  periodo: string,
  horario: string,
  tomados: RemedioTomado[],
  hoje: string,
  agora: Date,
): boolean {
  if (!r.ativo || !horarioJaPassou(horario, agora)) return false;
  return !tomados.some((t) => t.remedioId === r.id && t.periodo === periodo && t.horario === horario && t.data === hoje);
}

export interface Progresso {
  total: number;
  tomados: number;
  restantes: number;
  porcentagem: number;
}

export function progressoDoDia(remedios: Remedio[], tomados: RemedioTomado[], data: string): Progresso {
  const total = remedios.filter((r) => r.ativo).reduce((acc, r) => acc + r.horarios.length, 0);
  const ids = new Set(remedios.map((r) => r.id));
  const feitos = tomados.filter((t) => t.data === data && ids.has(t.remedioId)).length;
  return {
    total,
    tomados: feitos,
    restantes: Math.max(0, total - feitos),
    porcentagem: total > 0 ? Math.min(100, Math.round((feitos / total) * 100)) : 0,
  };
}
