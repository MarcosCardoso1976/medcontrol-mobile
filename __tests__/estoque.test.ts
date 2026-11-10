import { aplicarAlteracaoEstoque, mensagemAlertaEstoque } from '@/lib/dominio/estoque';
import { remedio } from './fixtures';

const HOJE = '2026-11-07';

describe('estoque em unidades', () => {
  it('baixa 1 e reverte', () => {
    const r = remedio({ estoque: true, quantidadeEstoque: 10, alertaEstoque: 3 });
    const baixa = aplicarAlteracaoEstoque(r, false, HOJE, false);
    expect(baixa.remedio.quantidadeEstoque).toBe(9);
    expect(baixa.alerta).toBeUndefined();
    const volta = aplicarAlteracaoEstoque(baixa.remedio, true, HOJE, false);
    expect(volta.remedio.quantidadeEstoque).toBe(10);
  });
  it('alerta baixo ao atingir o limite', () => {
    const r = remedio({ estoque: true, quantidadeEstoque: 4, alertaEstoque: 3 });
    expect(aplicarAlteracaoEstoque(r, false, HOJE, false).alerta).toEqual({ tipo: 'baixo', quantidade: 3 });
  });
  it('alerta zerado e não fica negativo', () => {
    const r = remedio({ estoque: true, quantidadeEstoque: 1, alertaEstoque: 3 });
    const z = aplicarAlteracaoEstoque(r, false, HOJE, false);
    expect(z.alerta).toEqual({ tipo: 'zerado', quantidade: 0 });
    const de0 = aplicarAlteracaoEstoque(z.remedio, false, HOJE, false);
    expect(de0.remedio.quantidadeEstoque).toBe(0);
    expect(de0.alterado).toBe(false);
  });
  it('não alerta ao reverter', () => {
    const r = remedio({ estoque: true, quantidadeEstoque: 0, alertaEstoque: 3 });
    expect(aplicarAlteracaoEstoque(r, true, HOJE, false).alerta).toBeUndefined();
  });
});

describe('estoque por volume', () => {
  const base = remedio({
    estoqueVolume: true, unidadeVolume: 'ml', dosagemPorDose: 10,
    quantidadeTotalVolume: 120, quantidadeRestanteVolume: 30, alertaVolume: 20,
  });
  it('baixa a dosagem por dose', () => {
    expect(aplicarAlteracaoEstoque(base, false, HOJE, false).remedio.quantidadeRestanteVolume).toBe(20);
  });
  it('alerta baixo e zerado', () => {
    expect(aplicarAlteracaoEstoque(base, false, HOJE, false).alerta).toEqual({ tipo: 'baixo', quantidade: 20 });
    const quase = { ...base, quantidadeRestanteVolume: 10 };
    expect(aplicarAlteracaoEstoque(quase, false, HOJE, false).alerta).toEqual({ tipo: 'zerado', quantidade: 0 });
  });
  it('reverter respeita o total', () => {
    const cheio = { ...base, quantidadeRestanteVolume: 115 };
    expect(aplicarAlteracaoEstoque(cheio, true, HOJE, false).remedio.quantidadeRestanteVolume).toBe(120);
  });
});

describe('estoque por dosagem (canetas)', () => {
  const base = remedio({
    estoqueDosagem: true, tipoMedicamentoDosagem: 'victoza', dosagemDiaria: 1.2,
    quantidadeTotalDosagem: 36, quantidadeRestanteDosagem: 36, alertaDiasDosagem: 7,
    quantidadeTotalAgulhas: 10, quantidadeRestanteAgulhas: 10,
  });
  it('baixa a dose diária e 1 agulha', () => {
    const r = aplicarAlteracaoEstoque(base, false, HOJE, false).remedio;
    expect(r.quantidadeRestanteDosagem).toBeCloseTo(34.8);
    expect(r.quantidadeRestanteAgulhas).toBe(9);
    expect(r.ultimaDataDecrementoDosagem).toBe(HOJE);
  });
  it('só baixa 1x por dia', () => {
    const uma = aplicarAlteracaoEstoque(base, false, HOJE, false).remedio;
    const duas = aplicarAlteracaoEstoque(uma, false, HOJE, false);
    expect(duas.alterado).toBe(false);
    expect(duas.remedio.quantidadeRestanteDosagem).toBeCloseTo(34.8);
  });
  it('reverte só se não houver outras doses tomadas hoje', () => {
    const uma = aplicarAlteracaoEstoque(base, false, HOJE, false).remedio;
    expect(aplicarAlteracaoEstoque(uma, true, HOJE, true).alterado).toBe(false);
    const volta = aplicarAlteracaoEstoque(uma, true, HOJE, false).remedio;
    expect(volta.quantidadeRestanteDosagem).toBeCloseTo(36);
    expect(volta.quantidadeRestanteAgulhas).toBe(10);
    expect(volta.ultimaDataDecrementoDosagem).toBeUndefined();
  });
  it('alerta por dias restantes', () => {
    const quase = { ...base, quantidadeRestanteDosagem: 9.6 }; // → 8.4 = 7 dias
    expect(aplicarAlteracaoEstoque(quase, false, HOJE, false).alerta).toEqual({ tipo: 'baixo', quantidade: 7 });
  });
  it('zerado', () => {
    const fim = { ...base, quantidadeRestanteDosagem: 1.2 };
    expect(aplicarAlteracaoEstoque(fim, false, HOJE, false).alerta).toEqual({ tipo: 'zerado', quantidade: 0 });
  });
});

describe('mensagens', () => {
  it('zerado simples', () => {
    expect(mensagemAlertaEstoque(remedio(), { tipo: 'zerado', quantidade: 0 }, 'Geral')).toBe(
      '(Lista: Geral) Dipirona está sem estoque. É necessário repor.',
    );
  });
  it('baixo singular/plural', () => {
    expect(mensagemAlertaEstoque(remedio(), { tipo: 'baixo', quantidade: 1 }, 'Geral')).toContain('1 unidade restante.');
    expect(mensagemAlertaEstoque(remedio(), { tipo: 'baixo', quantidade: 3 }, 'Geral')).toContain('3 unidades restantes.');
  });
});
