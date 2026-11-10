export type Periodo = 'manha' | 'tarde' | 'noite' | 'madrugada';

export interface ListaRemedios {
  id: string;
  nome: string;
  criadaEm: string;
  cor?: string;
  usuarioId?: string;
}

export interface HorarioRemedio {
  id: string; // ID único para cada horário
  periodo: Periodo;
  horario: string; // formato HH:mm
  anotacao?: string; // Anotação opcional por período
}
export interface Remedio {
  id: string;
  listaId: string;
  nome: string;
  horarios: HorarioRemedio[];
  periodosDiarios?: Periodo[]; // Períodos marcados como diários
  ativo: boolean;

  // Controle de Estoque
  estoque?: boolean;
  quantidadeEstoque?: number;
  alertaEstoque?: number; // Quantidade mínima para alerta

  // Controle de Estoque por Volume (para xaropes, gotas, pomadas)
  estoqueVolume?: boolean; // Ativa controle por volume
  unidadeVolume?: 'ml' | 'g' | 'gotas'; // Unidade de medida
  dosagemPorDose?: number; // Quantidade por dose (ex: 10 ml)
  quantidadeTotalVolume?: number; // Volume total disponível (ex: 120 ml)
  quantidadeRestanteVolume?: number; // Volume restante (calculado)
  alertaVolume?: number; // Volume mínimo para alerta (ex: 20 ml)

  // Controle de Estoque por Dosagem (para Victoza e similares)
  estoqueDosagem?: boolean; // Ativa controle por dosagem
  tipoMedicamentoDosagem?: 'victoza' | 'saxenda' | 'olire'; // Tipo de medicamento
  dosagemDiaria?: number; // mg por dia (ex: 0.6, 1.2, 1.8)
  quantidadeTotalDosagem?: number; // mg total disponível (ex: 36 para 2 canetas Victoza, 54 para 3 canetas Saxenda/Olire)
  quantidadeRestanteDosagem?: number; // mg restante (calculado)
  alertaDiasDosagem?: number; // Dias mínimos restantes para alerta (ex: 7 dias)
  diasEmTratamento?: number; // Dias em tratamento (0-90) para cálculo automático
  ultimaDataDecrementoDosagem?: string; // Data (YYYY-MM-DD) em que a dosagem foi decrementada pela última vez

  // Controle de Agulhas
  quantidadeTotalAgulhas?: number;     // Quantidade total de agulhas configurada
  quantidadeRestanteAgulhas?: number;  // Quantidade restante de agulhas (controlado automaticamente)

  // Dias de Tratamento (independente do controle de dosagem)
  diasDeTratamento?: number; // Quantidade de dias do tratamento (ex: 5 dias)
  ultimaDataDecrementoDiasTratamento?: string; // YYYY-MM-DD - última vez que decrementou dias de tratamento

  criadoEm: string;
  atualizadoEm: string;
}

export interface RemedioTomado {
  id?: string;
  listaId?: string;
  remedioId: string;
  periodo: Periodo;
  horario: string;
  data: string;
  tomadoEm: string;
}
