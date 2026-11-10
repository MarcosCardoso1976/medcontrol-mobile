import { alternarPeriodo, estadoInicial, montarRemedio, validar, type FormState } from '@/lib/dominio/formulario';
import { remedio } from './fixtures';

let n = 0;
const id = () => `id-${++n}`;
const AGORA = '2026-11-07T10:00:00.000Z';

function formValido(): FormState {
  let f = estadoInicial(null, id);
  f = { ...f, nome: 'Losartana' };
  f = alternarPeriodo(f, 'manha', id);
  return f;
}

describe('validar', () => {
  it('vazio: pede nome e período', () => {
    const e = validar(estadoInicial(null, id));
    expect(e.nome).toBe('Por favor, informe o nome do remédio');
    expect(e.periodos).toBe('Selecione pelo menos um período');
  });
  it('válido: sem erros', () => expect(validar(formValido())).toEqual({}));
  it('horário repetido no período', () => {
    const f = formValido();
    f.horarios.manha.push({ id: 'x', horario: f.horarios.manha[0].horario, anotacao: '' });
    expect(validar(f).horarios_manha).toBeDefined();
  });
  it('dias de tratamento exige inteiro ≥ 1', () => {
    const f = formValido();
    f.modos.manha = 'dias';
    f.diasDeTratamento = '0';
    expect(validar(f).diasDeTratamento).toContain('dias de tratamento');
    f.diasDeTratamento = '5';
    expect(validar(f).diasDeTratamento).toBeUndefined();
  });
  it('estoque: alerta não pode passar da quantidade', () => {
    const f = { ...formValido(), estoque: true, quantidadeEstoque: '10', alertaEstoque: '11' };
    expect(validar(f).alertaEstoque).toContain('menor ou igual');
    expect(validar({ ...f, alertaEstoque: '3' }).alertaEstoque).toBeUndefined();
  });
  it('volume: total e dose obrigatórios', () => {
    const f = { ...formValido(), volume: true };
    const e = validar(f);
    expect(e.totalVolume).toBeDefined();
    expect(e.dosagemPorDose).toBeDefined();
  });
  it('dosagem: dose diária precisa estar na lista da marca', () => {
    const f = { ...formValido(), dosagem: true, marca: 'victoza' as const, dosagemDiaria: '2.4' };
    expect(validar(f).dosagemDiaria).toBeDefined();
    expect(validar({ ...f, dosagemDiaria: '1,2' }).dosagemDiaria).toBeUndefined();
    expect(validar({ ...f, marca: 'saxenda', dosagemDiaria: '2.4' }).dosagemDiaria).toBeUndefined();
  });
  it('dosagem: dias em tratamento 0–90', () => {
    const f = { ...formValido(), dosagem: true, dosagemDiaria: '0.6', diasEmTratamento: '91' };
    expect(validar(f).diasEmTratamento).toBeDefined();
  });
});

describe('montarRemedio', () => {
  it('cria remédio simples com horário padrão da manhã', () => {
    const r = montarRemedio(formValido(), null, 'lista-1', id, AGORA);
    expect(r.nome).toBe('Losartana');
    expect(r.listaId).toBe('lista-1');
    expect(r.ativo).toBe(true);
    expect(r.horarios).toHaveLength(1);
    expect(r.horarios[0]).toMatchObject({ periodo: 'manha', horario: '08:00' });
    expect(r.periodosDiarios).toBeUndefined();
    expect(r.estoque).toBeUndefined();
  });

  it('período diário e dias de tratamento', () => {
    let f = formValido();
    f = alternarPeriodo(f, 'noite', id);
    f.modos.manha = 'diario';
    f.modos.noite = 'dias';
    f.diasDeTratamento = '7';
    const r = montarRemedio(f, null, 'l', id, AGORA);
    expect(r.periodosDiarios).toEqual(['manha']);
    expect(r.diasDeTratamento).toBe(7);
    expect(r.horarios.map((h) => h.periodo)).toEqual(['manha', 'noite']);
  });

  it('volume: restante padrão = total', () => {
    const f = { ...formValido(), volume: true, unidadeVolume: 'ml' as const, totalVolume: '120', dosagemPorDose: '10', alertaVolume: '20' };
    const r = montarRemedio(f, null, 'l', id, AGORA);
    expect(r).toMatchObject({ estoqueVolume: true, quantidadeTotalVolume: 120, quantidadeRestanteVolume: 120, dosagemPorDose: 10, alertaVolume: 20 });
  });

  it('dosagem: total vem da marca e agulhas começam cheias', () => {
    const f = { ...formValido(), dosagem: true, marca: 'saxenda' as const, dosagemDiaria: '1.8', agulhasTotal: '10' };
    const r = montarRemedio(f, null, 'l', id, AGORA);
    expect(r).toMatchObject({
      estoqueDosagem: true, tipoMedicamentoDosagem: 'saxenda', quantidadeTotalDosagem: 54,
      quantidadeRestanteDosagem: 54, quantidadeTotalAgulhas: 10, quantidadeRestanteAgulhas: 10, alertaDiasDosagem: 7,
    });
  });

  it('editar preserva id, criadoEm, lista, ativo e restantes', () => {
    const original = remedio({
      id: 'abc', listaId: 'L9', ativo: false, criadoEm: '2025-01-01T00:00:00.000Z',
      estoqueVolume: true, unidadeVolume: 'ml', dosagemPorDose: 10, quantidadeTotalVolume: 120, quantidadeRestanteVolume: 55,
    });
    const f = estadoInicial(original, id);
    const r = montarRemedio({ ...f, nome: 'Dipirona 500' }, original, 'outra', id, AGORA);
    expect(r).toMatchObject({ id: 'abc', listaId: 'L9', ativo: false, criadoEm: '2025-01-01T00:00:00.000Z', atualizadoEm: AGORA, nome: 'Dipirona 500' });
    expect(r.quantidadeRestanteVolume).toBe(55);
  });

  it('roundtrip: estadoInicial → montarRemedio não altera os horários', () => {
    const original = remedio({
      horarios: [
        { id: 'a', periodo: 'manha', horario: '08:00', anotacao: 'com água' },
        { id: 'b', periodo: 'noite', horario: '21:30' },
      ],
      periodosDiarios: ['noite'],
    });
    const r = montarRemedio(estadoInicial(original, id), original, 'l', id, AGORA);
    expect(r.horarios).toEqual(original.horarios);
    expect(r.periodosDiarios).toEqual(['noite']);
  });

  it('mudar dias de tratamento reinicia o controle de decremento', () => {
    const original = remedio({ diasDeTratamento: 5, ultimaDataDecrementoDiasTratamento: '2026-11-06' });
    const f = estadoInicial(original, id);
    const mesmo = montarRemedio(f, original, 'l', id, AGORA);
    expect(mesmo.ultimaDataDecrementoDiasTratamento).toBe('2026-11-06');
    const outro = montarRemedio({ ...f, diasDeTratamento: '9' }, original, 'l', id, AGORA);
    expect(outro.ultimaDataDecrementoDiasTratamento).toBeUndefined();
  });
});
