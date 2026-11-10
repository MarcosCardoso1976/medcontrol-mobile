import { validarNomeLista } from '@/lib/dominio/listas';

const listas = [{ id: '1', nome: 'Geral' }, { id: '2', nome: 'Viagem' }];

describe('validarNomeLista', () => {
  it('vazio', () => expect(validarNomeLista('   ', listas)).toBe('Nome não pode ser vazio'));
  it('muito longo', () => expect(validarNomeLista('x'.repeat(51), listas)).toBe('Máximo 50 caracteres'));
  it('duplicado sem diferenciar maiúsculas', () => expect(validarNomeLista('geral', listas)).toBe('Nome já existe'));
  it('renomear para o próprio nome é permitido', () => expect(validarNomeLista('Geral', listas, '1')).toBeNull());
  it('válido', () => expect(validarNomeLista('Trabalho', listas)).toBeNull());
});
