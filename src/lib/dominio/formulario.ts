import type { HorarioRemedio, Periodo, Remedio } from '@/types/remedio';
import { DOSAGEM_POR_MARCA } from './estoque';
import { PERIODOS_ORDEM, PERIODO_LABELS, horarioValido } from './periodos';

export type ModoPeriodo = 'nenhum' | 'diario' | 'dias';
export type Marca = keyof typeof DOSAGEM_POR_MARCA;

export interface HorarioForm {
  id: string;
  horario: string;
  anotacao: string;
}

export interface FormState {
  nome: string;
  periodos: Periodo[];
  horarios: Record<Periodo, HorarioForm[]>;
  modos: Record<Periodo, ModoPeriodo>;
  diasDeTratamento: string;

  estoque: boolean;
  quantidadeEstoque: string;
  alertaEstoque: string;

  volume: boolean;
  unidadeVolume: 'ml' | 'g' | 'gotas';
  dosagemPorDose: string;
  totalVolume: string;
  restanteVolume: string;
  alertaVolume: string;

  dosagem: boolean;
  marca: Marca;
  dosagemDiaria: string;
  restanteDosagem: string;
  diasEmTratamento: string;
  alertaDiasDosagem: string;
  agulhasTotal: string;
  agulhasRestante: string;
}

export type Erros = Partial<Record<string, string>>;

const vazioPorPeriodo = <T,>(f: () => T): Record<Periodo, T> => ({
  madrugada: f(),
  manha: f(),
  tarde: f(),
  noite: f(),
});

const txt = (n: number | undefined) => (n === undefined || n === null ? '' : String(n));

export function estadoInicial(r: Remedio | null, novoId: () => string): FormState {
  const horarios = vazioPorPeriodo<HorarioForm[]>(() => []);
  const modos = vazioPorPeriodo<ModoPeriodo>(() => 'nenhum');
  if (r) {
    for (const h of r.horarios) horarios[h.periodo].push({ id: h.id, horario: h.horario, anotacao: h.anotacao ?? '' });
    for (const p of PERIODOS_ORDEM) horarios[p].sort((a, b) => a.horario.localeCompare(b.horario));
    for (const p of r.periodosDiarios ?? []) modos[p] = 'diario';
    if (r.diasDeTratamento && r.diasDeTratamento > 0) {
      for (const p of PERIODOS_ORDEM) if (horarios[p].length && modos[p] === 'nenhum') modos[p] = 'dias';
    }
  }
  return {
    nome: r?.nome ?? '',
    periodos: r ? PERIODOS_ORDEM.filter((p) => horarios[p].length > 0) : [],
    horarios,
    modos,
    diasDeTratamento: txt(r?.diasDeTratamento),

    estoque: !!r?.estoque,
    quantidadeEstoque: txt(r?.quantidadeEstoque),
    alertaEstoque: txt(r?.alertaEstoque),

    volume: !!r?.estoqueVolume,
    unidadeVolume: r?.unidadeVolume ?? 'ml',
    dosagemPorDose: txt(r?.dosagemPorDose),
    totalVolume: txt(r?.quantidadeTotalVolume),
    restanteVolume: txt(r?.quantidadeRestanteVolume),
    alertaVolume: txt(r?.alertaVolume),

    dosagem: !!r?.estoqueDosagem,
    marca: r?.tipoMedicamentoDosagem ?? 'victoza',
    dosagemDiaria: txt(r?.dosagemDiaria),
    restanteDosagem: txt(r?.quantidadeRestanteDosagem),
    diasEmTratamento: txt(r?.diasEmTratamento),
    alertaDiasDosagem: txt(r?.alertaDiasDosagem ?? (r ? undefined : 7)),
    agulhasTotal: txt(r?.quantidadeTotalAgulhas),
    agulhasRestante: txt(r?.quantidadeRestanteAgulhas),
  };
}

/** "8,5" ou "8.5" → 8.5 · vazio/ inválido → NaN */
export function num(v: string): number {
  const s = v.trim().replace(',', '.');
  if (s === '') return NaN;
  return Number(s);
}

export function alternarPeriodo(f: FormState, p: Periodo, novoId: () => string): FormState {
  if (f.periodos.includes(p)) {
    return { ...f, periodos: f.periodos.filter((x) => x !== p) };
  }
  const horarios = { ...f.horarios };
  if (horarios[p].length === 0) {
    const padrao = { manha: '08:00', tarde: '14:00', noite: '20:00', madrugada: '03:00' }[p];
    horarios[p] = [{ id: novoId(), horario: padrao, anotacao: '' }];
  }
  return { ...f, horarios, periodos: PERIODOS_ORDEM.filter((x) => x === p || f.periodos.includes(x)) };
}

export function validar(f: FormState): Erros {
  const e: Erros = {};
  if (!f.nome.trim()) e.nome = 'Por favor, informe o nome do remédio';
  if (f.periodos.length === 0) e.periodos = 'Selecione pelo menos um período';

  for (const p of f.periodos) {
    const hs = f.horarios[p];
    if (hs.length === 0) e[`horarios_${p}`] = `Adicione ao menos um horário em ${PERIODO_LABELS[p]}`;
    else if (hs.some((h) => !horarioValido(h.horario))) e[`horarios_${p}`] = 'Horário inválido';
    else if (new Set(hs.map((h) => h.horario)).size !== hs.length) e[`horarios_${p}`] = 'Há horários repetidos neste período';
  }

  if (f.periodos.some((p) => f.modos[p] === 'dias')) {
    const d = num(f.diasDeTratamento);
    if (!Number.isInteger(d) || d < 1) e.diasDeTratamento = 'Por favor, informe uma quantidade de dias de tratamento válida';
  }

  if (f.estoque) {
    const q = num(f.quantidadeEstoque);
    if (!Number.isFinite(q) || q < 0) e.quantidadeEstoque = 'Por favor, informe uma quantidade de estoque válida';
    else if (f.alertaEstoque.trim() !== '') {
      const a = num(f.alertaEstoque);
      if (!Number.isFinite(a) || a < 0 || a > q) e.alertaEstoque = 'O alerta de estoque deve ser um número válido e menor ou igual à quantidade';
    }
  }

  if (f.volume) {
    const total = num(f.totalVolume);
    const dose = num(f.dosagemPorDose);
    if (!Number.isFinite(total) || total <= 0) e.totalVolume = 'Por favor, informe um volume total válido';
    if (!Number.isFinite(dose) || dose <= 0) e.dosagemPorDose = 'Por favor, informe a dosagem por dose';
    if (f.restanteVolume.trim() !== '') {
      const r = num(f.restanteVolume);
      if (!Number.isFinite(r) || r < 0 || (Number.isFinite(total) && r > total)) e.restanteVolume = 'Volume restante inválido';
    }
    if (f.alertaVolume.trim() !== '') {
      const a = num(f.alertaVolume);
      if (!Number.isFinite(a) || a < 0) e.alertaVolume = 'Alerta de volume inválido';
    }
  }

  if (f.dosagem) {
    const marca = DOSAGEM_POR_MARCA[f.marca];
    const dose = num(f.dosagemDiaria);
    if (!(marca.doses as readonly number[]).some((d) => Math.abs(d - dose) < 0.001)) e.dosagemDiaria = 'Selecione a dose diária';
    if (f.restanteDosagem.trim() !== '') {
      const r = num(f.restanteDosagem);
      if (!Number.isFinite(r) || r < 0 || r > marca.total) e.restanteDosagem = 'Por favor, informe uma quantidade total válida';
    }
    if (f.diasEmTratamento.trim() !== '') {
      const d = num(f.diasEmTratamento);
      if (!Number.isInteger(d) || d < 0 || d > 90) e.diasEmTratamento = 'Dias em tratamento deve estar entre 0 e 90';
    }
    if (f.alertaDiasDosagem.trim() !== '') {
      const a = num(f.alertaDiasDosagem);
      if (!Number.isInteger(a) || a < 1) e.alertaDiasDosagem = 'Alerta de dias inválido';
    }
    if (f.agulhasTotal.trim() !== '') {
      const t = num(f.agulhasTotal);
      if (!Number.isInteger(t) || t < 0) e.agulhasTotal = 'Quantidade de agulhas inválida';
      else if (f.agulhasRestante.trim() !== '') {
        const r = num(f.agulhasRestante);
        if (!Number.isInteger(r) || r < 0 || r > t) e.agulhasRestante = 'Agulhas restantes inválidas';
      }
    }
  }
  return e;
}

export function montarRemedio(
  f: FormState,
  existente: Remedio | null,
  listaId: string,
  novoId: () => string,
  agora: string,
): Remedio {
  const horarios: HorarioRemedio[] = [];
  for (const p of PERIODOS_ORDEM) {
    if (!f.periodos.includes(p)) continue;
    for (const h of f.horarios[p]) {
      const item: HorarioRemedio = {
        id: h.id || novoId(),
        periodo: p,
        horario: h.horario,
      };
      if (h.anotacao.trim()) item.anotacao = h.anotacao.trim();
      horarios.push(item);
    }
  }

  const periodosDiarios = f.periodos.filter((p) => f.modos[p] === 'diario');
  const temDias = f.periodos.some((p) => f.modos[p] === 'dias');
  const diasDeTratamento = temDias ? Math.floor(num(f.diasDeTratamento)) : undefined;
  const diasMudaram = existente?.diasDeTratamento !== diasDeTratamento;

  const r: Remedio = {
    id: existente?.id ?? novoId(),
    listaId: existente?.listaId ?? listaId,
    nome: f.nome.trim(),
    horarios,
    periodosDiarios: periodosDiarios.length ? periodosDiarios : undefined,
    ativo: existente?.ativo ?? true,
    diasDeTratamento,
    ultimaDataDecrementoDiasTratamento: diasMudaram ? undefined : existente?.ultimaDataDecrementoDiasTratamento,
    criadoEm: existente?.criadoEm ?? agora,
    atualizadoEm: agora,
  };

  if (f.estoque) {
    r.estoque = true;
    r.quantidadeEstoque = num(f.quantidadeEstoque);
    if (f.alertaEstoque.trim() !== '') r.alertaEstoque = num(f.alertaEstoque);
  }

  if (f.volume) {
    const total = num(f.totalVolume);
    r.estoqueVolume = true;
    r.unidadeVolume = f.unidadeVolume;
    r.dosagemPorDose = num(f.dosagemPorDose);
    r.quantidadeTotalVolume = total;
    r.quantidadeRestanteVolume = f.restanteVolume.trim() !== '' ? num(f.restanteVolume) : total;
    if (f.alertaVolume.trim() !== '') r.alertaVolume = num(f.alertaVolume);
  }

  if (f.dosagem) {
    const marca = DOSAGEM_POR_MARCA[f.marca];
    r.estoqueDosagem = true;
    r.tipoMedicamentoDosagem = f.marca;
    r.dosagemDiaria = num(f.dosagemDiaria);
    r.quantidadeTotalDosagem = marca.total;
    r.quantidadeRestanteDosagem = f.restanteDosagem.trim() !== '' ? num(f.restanteDosagem) : marca.total;
    r.alertaDiasDosagem = f.alertaDiasDosagem.trim() !== '' ? num(f.alertaDiasDosagem) : 7;
    if (f.diasEmTratamento.trim() !== '') r.diasEmTratamento = num(f.diasEmTratamento);
    r.ultimaDataDecrementoDosagem = existente?.estoqueDosagem ? existente.ultimaDataDecrementoDosagem : undefined;
    if (f.agulhasTotal.trim() !== '') {
      r.quantidadeTotalAgulhas = num(f.agulhasTotal);
      r.quantidadeRestanteAgulhas = f.agulhasRestante.trim() !== '' ? num(f.agulhasRestante) : num(f.agulhasTotal);
    }
  }

  return r;
}
