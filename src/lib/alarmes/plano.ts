import type { ListaRemedios, Periodo, Remedio, RemedioTomado } from '@/types/remedio';
import { getLocalDateString } from '@/lib/utils';
import { PERIODO_LABELS } from '@/lib/dominio/periodos';

export type TipoNotificacao = 'dose' | 'pre' | 'late';

export const CANAL_ALARME = 'medcontrol_alarme_v1';
export const CANAL_LEMBRETE = 'medcontrol_lembrete_v1';

export interface BaseDados {
  remedioId: string;
  periodo: Periodo;
  horario: string;
  dia: string; // YYYY-MM-DD
  listaId: string;
}

export interface DadosNotificacao extends BaseDados {
  tipo: TipoNotificacao;
  sig: string; // assinatura (quando|titulo|corpo) para detectar mudanças sem inspecionar o trigger
  [chave: string]: unknown;
}

export interface NotificacaoPlanejada {
  id: string;
  quando: Date;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string;
  canal: typeof CANAL_ALARME | typeof CANAL_LEMBRETE;
  data: DadosNotificacao;
}

export interface OpcoesPlano {
  agora: Date;
  plataforma: 'android' | 'ios';
  preAviso: boolean;
  atrasos: boolean;
  horizonteDias?: number; // padrão 14
  limite?: number; // padrão: android 300 · ios 60
}

export interface ResultadoPlano {
  notificacoes: NotificacaoPlanejada[];
  /** Horário da última dose principal agendada (cobertura do plano). */
  coberturaAte: Date | null;
}

export const ATRASOS_MIN = [10, 25, 40];
export const PRE_AVISO_MIN = 15;

function comHora(base: Date, horario: string): Date {
  const [h, m] = horario.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}
function somaDias(base: Date, dias: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d;
}
const somaMin = (base: Date, min: number) => new Date(base.getTime() + min * 60_000);

export function idDose(remedioId: string, periodo: string, horario: string, dia: string): string {
  return `${remedioId}|${periodo}|${horario}|${dia}`;
}

/** Função pura: dado o estado e o relógio, devolve exatamente o que deve estar agendado. */
export function calcularPlano(
  remedios: Remedio[],
  tomados: RemedioTomado[],
  listas: ListaRemedios[],
  op: OpcoesPlano,
): ResultadoPlano {
  const H = op.horizonteDias ?? 14;
  const limite = op.limite ?? (op.plataforma === 'ios' ? 60 : 300);
  const hoje = getLocalDateString(op.agora);
  const inicioHoje = new Date(op.agora);
  inicioHoje.setHours(0, 0, 0, 0);

  const tomadosHoje = new Set(
    tomados.filter((t) => t.data === hoje).map((t) => `${t.remedioId}|${t.periodo}|${t.horario}`),
  );
  const nomeLista = (id: string) => listas.find((l) => l.id === id)?.nome ?? 'Geral';

  const todas: NotificacaoPlanejada[] = [];
  const empurrar = (
    id: string,
    quando: Date,
    tipo: TipoNotificacao,
    titulo: string,
    corpo: string,
    canal: NotificacaoPlanejada['canal'],
    base: BaseDados,
  ) => {
    todas.push({
      id,
      quando,
      tipo,
      titulo,
      corpo,
      canal,
      data: { ...base, tipo, sig: `${quando.getTime()}|${titulo}|${corpo}` },
    });
  };

  for (const r of remedios.filter((x) => x.ativo)) {
    for (const h of r.horarios) {
      const diario = r.periodosDiarios?.includes(h.periodo) ?? false;
      const limiteDias = !diario && r.diasDeTratamento && r.diasDeTratamento > 0 ? Math.min(H, r.diasDeTratamento) : H;

      for (let d = 0; d < limiteDias; d++) {
        const dia = somaDias(inicioHoje, d);
        const diaStr = getLocalDateString(dia);
        if (d === 0 && tomadosHoje.has(`${r.id}|${h.periodo}|${h.horario}`)) continue;

        const quando = comHora(dia, h.horario);
        const base = idDose(r.id, h.periodo, h.horario, diaStr);
        const lista = nomeLista(r.listaId);
        const rotulo = PERIODO_LABELS[h.periodo];
        const dados = { remedioId: r.id, periodo: h.periodo, horario: h.horario, dia: diaStr, listaId: r.listaId };

        if (quando > op.agora) {
          empurrar(
            `dose|${base}`,
            quando,
            'dose',
            '⏰ Hora do Remédio!',
            `${r.nome} - ${rotulo} às ${h.horario} (Lista: ${lista})`,
            CANAL_ALARME,
            dados,
          );
        }
        if (op.preAviso) {
          const pre = somaMin(quando, -PRE_AVISO_MIN);
          if (pre > op.agora) {
            empurrar(
              `pre|${base}`,
              pre,
              'pre',
              `⏰ Remédio em ${PRE_AVISO_MIN} minutos`,
              `${r.nome} - ${rotulo} às ${h.horario} (${lista})`,
              CANAL_LEMBRETE,
              dados,
            );
          }
        }
        if (op.atrasos) {
          ATRASOS_MIN.forEach((min, i) => {
            const t = somaMin(quando, min);
            if (t > op.agora) {
              empurrar(
                `late|${base}|${i + 1}`,
                t,
                'late',
                '🚨 Remédio atrasado!',
                `${r.nome} - ${rotulo} deveria ter sido tomado às ${h.horario} (atraso de ${min} min)`,
                CANAL_ALARME,
                dados,
              );
            }
          });
        }
      }
    }
  }

  const porHora = (a: NotificacaoPlanejada, b: NotificacaoPlanejada) => a.quando.getTime() - b.quando.getTime();

  // Orçamento: as doses principais têm prioridade absoluta; extras (pré-aviso/atrasos) só com a sobra.
  // Se as doses já enchem o limite (ex.: iOS com muitos remédios), a sobra é 0 e não há extras.
  const principais = todas.filter((n) => n.tipo === 'dose').sort(porHora).slice(0, limite);
  const corte = principais.length ? principais[principais.length - 1].quando : null;
  const sobra = Math.max(0, limite - principais.length);
  const extras = todas.filter((n) => n.tipo !== 'dose').sort(porHora).slice(0, sobra);

  return { notificacoes: [...principais, ...extras].sort(porHora), coberturaAte: corte };
}
