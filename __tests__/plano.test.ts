import { calcularPlano } from '@/lib/alarmes/plano';
import type { ListaRemedios, RemedioTomado } from '@/types/remedio';
import { remedio } from './fixtures';

const listas: ListaRemedios[] = [{ id: 'l1', nome: 'Geral', criadaEm: '2026-01-01T00:00:00.000Z' }];
const AGORA = new Date(2026, 10, 7, 7, 0); // 07/11/2026 07:00
const base = { agora: AGORA, plataforma: 'android' as const, preAviso: true, atrasos: true, horizonteDias: 3 };

describe('calcularPlano', () => {
  it('gera dose, pré-aviso e 3 atrasos por dia', () => {
    const p = calcularPlano([remedio()], [], listas, base);
    const hoje = p.notificacoes.filter((n) => n.data.dia === '2026-11-07');
    expect(hoje.map((n) => n.tipo).sort()).toEqual(['dose', 'late', 'late', 'late', 'pre']);
    expect(p.notificacoes.filter((n) => n.tipo === 'dose')).toHaveLength(3);
  });

  it('textos idênticos aos do web', () => {
    const p = calcularPlano([remedio()], [], listas, base);
    const dose = p.notificacoes.find((n) => n.tipo === 'dose')!;
    expect(dose.titulo).toBe('⏰ Hora do Remédio!');
    expect(dose.corpo).toBe('Dipirona - Manhã às 08:00 (Lista: Geral)');
    expect(p.notificacoes.find((n) => n.tipo === 'pre')!.titulo).toBe('⏰ Remédio em 15 minutos');
    expect(p.notificacoes.find((n) => n.tipo === 'late')!.titulo).toBe('🚨 Remédio atrasado!');
  });

  it('pré-aviso 15 min antes e atrasos +10/+25/+40', () => {
    const p = calcularPlano([remedio()], [], listas, base);
    const min = (n: { quando: Date }) => n.quando.getHours() * 60 + n.quando.getMinutes();
    const hoje = p.notificacoes.filter((n) => n.data.dia === '2026-11-07');
    expect(min(hoje.find((n) => n.tipo === 'pre')!)).toBe(7 * 60 + 45);
    expect(hoje.filter((n) => n.tipo === 'late').map(min)).toEqual([8 * 60 + 10, 8 * 60 + 25, 8 * 60 + 40]);
  });

  it('dose de hoje já tomada não gera nada hoje, mas amanhã sim', () => {
    const t: RemedioTomado = { remedioId: 'r1', periodo: 'manha', horario: '08:00', data: '2026-11-07', tomadoEm: '' };
    const p = calcularPlano([remedio()], [t], listas, base);
    expect(p.notificacoes.some((n) => n.data.dia === '2026-11-07')).toBe(false);
    expect(p.notificacoes.some((n) => n.data.dia === '2026-11-08')).toBe(true);
  });

  it('dose que já passou hoje não é agendada, mas os atrasos futuros sim', () => {
    const tarde = { ...base, agora: new Date(2026, 10, 7, 8, 12) };
    const p = calcularPlano([remedio()], [], listas, tarde);
    const hoje = p.notificacoes.filter((n) => n.data.dia === '2026-11-07');
    expect(hoje.some((n) => n.tipo === 'dose')).toBe(false);
    expect(hoje.filter((n) => n.tipo === 'late')).toHaveLength(2); // +25 e +40
  });

  it('remédio inativo não gera alarmes', () => {
    expect(calcularPlano([remedio({ ativo: false })], [], listas, base).notificacoes).toHaveLength(0);
  });

  it('diasDeTratamento limita o agendamento (períodos não diários)', () => {
    const p = calcularPlano([remedio({ diasDeTratamento: 2 })], [], listas, { ...base, horizonteDias: 10 });
    expect(p.notificacoes.filter((n) => n.tipo === 'dose')).toHaveLength(2);
  });

  it('período diário ignora o limite de dias de tratamento', () => {
    const p = calcularPlano([remedio({ diasDeTratamento: 2, periodosDiarios: ['manha'] })], [], listas, { ...base, horizonteDias: 5 });
    expect(p.notificacoes.filter((n) => n.tipo === 'dose')).toHaveLength(5);
  });

  it('preferências desligam pré-aviso e atrasos', () => {
    const p = calcularPlano([remedio()], [], listas, { ...base, preAviso: false, atrasos: false });
    expect(p.notificacoes.every((n) => n.tipo === 'dose')).toBe(true);
  });

  it('orçamento do iOS: doses principais primeiro, nunca excede o limite', () => {
    const muitos = Array.from({ length: 10 }, (_, i) =>
      remedio({ id: `r${i}`, horarios: [{ id: `h${i}`, periodo: 'manha', horario: `0${8 + (i % 2)}:${i < 5 ? '00' : '30'}` }] }),
    );
    const p = calcularPlano(muitos, [], listas, { ...base, plataforma: 'ios', horizonteDias: 14 });
    expect(p.notificacoes.length).toBeLessThanOrEqual(60);
    expect(p.notificacoes.filter((n) => n.tipo === 'dose').length).toBe(Math.min(60, 10 * 14));
    expect(p.coberturaAte).not.toBeNull();
  });

  it('várias doses no mesmo minuto geram ids distintos', () => {
    const dois = [remedio({ id: 'a' }), remedio({ id: 'b' })];
    const p = calcularPlano(dois, [], listas, { ...base, horizonteDias: 1 });
    const ids = p.notificacoes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('horário 00:00 e 23:59', () => {
    const r = remedio({ horarios: [{ id: 'x', periodo: 'noite', horario: '23:59' }, { id: 'y', periodo: 'noite', horario: '00:00' }] });
    const p = calcularPlano([r], [], listas, { ...base, horizonteDias: 1, preAviso: false, atrasos: false });
    expect(p.notificacoes.map((n) => n.data.horario)).toEqual(['23:59']);
  });

  it('assinatura muda quando o texto muda', () => {
    const a = calcularPlano([remedio()], [], listas, base).notificacoes[0].data.sig;
    const b = calcularPlano([remedio({ nome: 'Outro' })], [], listas, base).notificacoes[0].data.sig;
    expect(a).not.toBe(b);
  });
});
