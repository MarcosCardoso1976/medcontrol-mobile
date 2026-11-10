import type { Remedio } from '@/types/remedio';

export type AlertaEstoque = { tipo: 'zerado' | 'baixo'; quantidade: number };

export interface ResultadoEstoque {
  remedio: Remedio;
  alterado: boolean;
  alerta?: AlertaEstoque;
}

export const DOSAGEM_POR_MARCA = {
  victoza: { total: 36, doses: [0.6, 1.2, 1.8], canetas: 2, rotulo: 'Victoza (2 canetas - 36 mg)' },
  saxenda: { total: 54, doses: [0.6, 1.2, 1.8, 2.4, 3.0], canetas: 3, rotulo: 'Saxenda (3 canetas - 54 mg)' },
  olire: { total: 54, doses: [0.6, 1.2, 1.8, 2.4, 3.0], canetas: 3, rotulo: 'Olire (3 canetas - 54 mg)' },
} as const;

/**
 * Baixa (ou reversão) de estoque ao marcar/desmarcar uma dose.
 * Função pura — porta de `aplicarAlteracaoEstoque` do app web.
 *
 * @param outrasDosesTomadasHoje  há outra dose DESTE remédio tomada hoje? (só importa na reversão da dosagem)
 */
export function aplicarAlteracaoEstoque(
  original: Remedio,
  reverter: boolean,
  hoje: string,
  outrasDosesTomadasHoje: boolean,
): ResultadoEstoque {
  const r: Remedio = { ...original };
  let alterado = false;
  let alerta: AlertaEstoque | undefined;

  // 1) Estoque em unidades
  if (r.estoque && r.quantidadeEstoque !== undefined) {
    const atual = r.quantidadeEstoque || 0;
    const novo = reverter ? atual + 1 : Math.max(0, atual - 1);
    if (novo !== r.quantidadeEstoque) {
      r.quantidadeEstoque = novo;
      alterado = true;
      if (!reverter) {
        if (novo === 0) alerta = { tipo: 'zerado', quantidade: 0 };
        else if (r.alertaEstoque !== undefined && novo <= r.alertaEstoque) alerta = { tipo: 'baixo', quantidade: novo };
      }
    }
  }

  // 2) Estoque por volume
  if (r.estoqueVolume && r.dosagemPorDose && r.quantidadeRestanteVolume !== undefined) {
    const delta = reverter ? r.dosagemPorDose : -r.dosagemPorDose;
    const novo = Math.min(r.quantidadeTotalVolume || 0, Math.max(0, (r.quantidadeRestanteVolume || 0) + delta));
    if (novo !== r.quantidadeRestanteVolume) {
      r.quantidadeRestanteVolume = novo;
      alterado = true;
      if (!reverter) {
        if (novo <= 0) alerta = { tipo: 'zerado', quantidade: 0 };
        else if (r.alertaVolume !== undefined && novo <= r.alertaVolume) alerta = { tipo: 'baixo', quantidade: novo };
      }
    }
  }

  // 3) Estoque por dosagem (canetas) — baixa no máximo 1x por dia
  if (r.estoqueDosagem && r.dosagemDiaria && r.quantidadeRestanteDosagem !== undefined) {
    if (!reverter) {
      if (r.ultimaDataDecrementoDosagem !== hoje) {
        const nova = Math.max(0, (r.quantidadeRestanteDosagem || 0) - (r.dosagemDiaria || 0));
        r.quantidadeRestanteDosagem = nova;
        if (r.quantidadeRestanteAgulhas !== undefined && r.quantidadeRestanteAgulhas > 0) {
          r.quantidadeRestanteAgulhas = Math.max(0, r.quantidadeRestanteAgulhas - 1);
        }
        r.ultimaDataDecrementoDosagem = hoje;
        alterado = true;
        const dias = r.dosagemDiaria > 0 ? Math.floor(nova / r.dosagemDiaria) : 0;
        if (nova === 0) alerta = { tipo: 'zerado', quantidade: 0 };
        else if (dias <= (r.alertaDiasDosagem || 7)) alerta = { tipo: 'baixo', quantidade: dias };
      }
    } else if (r.ultimaDataDecrementoDosagem === hoje && !outrasDosesTomadasHoje) {
      r.quantidadeRestanteDosagem = Math.min(
        (r.quantidadeRestanteDosagem || 0) + (r.dosagemDiaria || 0),
        r.quantidadeTotalDosagem || 0,
      );
      if (r.quantidadeRestanteAgulhas !== undefined) {
        r.quantidadeRestanteAgulhas = Math.min(
          (r.quantidadeRestanteAgulhas || 0) + 1,
          r.quantidadeTotalAgulhas || 0,
        );
      }
      r.ultimaDataDecrementoDosagem = undefined;
      alterado = true;
    }
  }

  return { remedio: r, alterado, alerta };
}

export function tituloAlertaEstoque(alerta: AlertaEstoque): string {
  return alerta.tipo === 'zerado' ? 'Estoque zerado!' : 'Estoque baixo!';
}

/** Mensagem do diálogo de alerta de estoque (textos idênticos ao web). */
export function mensagemAlertaEstoque(r: Remedio, alerta: AlertaEstoque, nomeLista: string): string {
  const prefixo = `(Lista: ${nomeLista}) `;
  const q = alerta.quantidade;
  if (r.estoqueDosagem) {
    return alerta.tipo === 'zerado'
      ? `${prefixo}${r.nome} está sem estoque de dosagem. É necessário repor.`
      : `${prefixo}${r.nome} está com apenas ${q} ${q === 1 ? 'dia' : 'dias'} de dosagem restante.`;
  }
  if (alerta.tipo === 'zerado') return `${prefixo}${r.nome} está sem estoque. É necessário repor.`;
  if (r.estoqueVolume) return `${prefixo}${r.nome} está com apenas ${Number(q.toFixed(1))} ${r.unidadeVolume || 'ml'} restantes.`;
  return `${prefixo}${r.nome} está com apenas ${q} ${q === 1 ? 'unidade restante' : 'unidades restantes'}.`;
}
