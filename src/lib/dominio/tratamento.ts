import type { Remedio } from '@/types/remedio';

/** Diferença em dias entre duas datas YYYY-MM-DD (b - a). */
export function diffDias(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export interface ResultadoDia {
  remedio: Remedio;
  remover: boolean;
  alterado: boolean;
}

/**
 * Processamento diário feito ao abrir o app (porta de `init()` do web).
 *
 * MELHORIA consciente: o web decrementa só 1 dia por abertura; aqui decrementamos pela
 * diferença de dias desde o último decremento (mínimo 1), para quem fica dias sem abrir o app.
 */
export function processarDia(original: Remedio, hoje: string): ResultadoDia {
  const r: Remedio = { ...original };
  let alterado = false;
  let remover = false;

  if (r.diasDeTratamento && r.diasDeTratamento > 0) {
    const ultima = r.ultimaDataDecrementoDiasTratamento;
    if (!ultima || ultima !== hoje) {
      const delta = ultima ? Math.max(1, diffDias(ultima, hoje)) : 1;
      r.diasDeTratamento = Math.max(0, r.diasDeTratamento - delta);
      r.ultimaDataDecrementoDiasTratamento = hoje;
      alterado = true;
      if (r.diasDeTratamento === 0) {
        const temDiarios = !!r.periodosDiarios && r.periodosDiarios.length > 0;
        if (!temDiarios) remover = true;
      }
    }
  }

  if (r.estoqueDosagem && r.diasEmTratamento && r.diasEmTratamento > 0) {
    const dosagem = r.dosagemDiaria || 0;
    const total = r.quantidadeTotalDosagem || 0;
    const restanteAtual = r.quantidadeRestanteDosagem;
    if (dosagem > 0 && total > 0) {
      const calculada = Math.max(0, total - r.diasEmTratamento * dosagem);
      if (restanteAtual === undefined || restanteAtual === null || Math.abs(restanteAtual - calculada) < 0.01) {
        if (r.quantidadeRestanteDosagem !== calculada) alterado = true;
        r.quantidadeRestanteDosagem = calculada;
      }
    }
  }

  return { remedio: r, remover, alterado };
}
