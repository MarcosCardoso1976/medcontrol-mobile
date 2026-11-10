import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CalendarioCabecalho } from '@/components/home/calendario-cabecalho';
import { EstatisticasDia } from '@/components/home/estatisticas-dia';
import { FormularioRemedio } from '@/components/home/formulario-remedio';
import { GraficoDosagem } from '@/components/home/grafico-dosagem';
import { HistoricoRemedios } from '@/components/home/historico-remedios';
import { ListaRemedios } from '@/components/home/lista-remedios';
import { ThemeProvider } from '@/theme/theme-provider';
import type { RemedioTomado } from '@/types/remedio';
import { remedio } from './fixtures';

// módulos nativos / acesso a banco não existem no ambiente de teste
let mockTemaSalvo: string | null = null;
jest.mock('@/lib/db/repo', () => ({
  getMeta: jest.fn(async () => mockTemaSalvo),
  setMeta: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api/client', () => ({
  api: { buscarMedicamentos: jest.fn(async () => [{ nome: 'Dipirona Sódica', principioAtivo: 'dipirona', laboratorio: 'X' }]) },
  apiConfigurada: true,
}));
jest.mock('@/lib/ids', () => {
  let n = 0;
  return { generateId: () => `uuid-${++n}` };
});
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };

async function renderizar(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

const AGORA = new Date(2026, 10, 7, 10, 0);
const HOJE = '2026-11-07';

afterEach(() => {
  mockTemaSalvo = null;
});

describe('CalendarioCabecalho', () => {
  it('mostra o dia da semana, a data e a semana inteira', async () => {
    await renderizar(<CalendarioCabecalho dataRef={AGORA} onMudar={() => undefined} onSelecionar={() => undefined} />);
    expect(screen.getByText('Sábado')).toBeTruthy();
    expect(screen.getByText('7 de novembro de 2026')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(9); // 7 dias + anterior + próximo
  });

  it('navega e seleciona dias', async () => {
    const onMudar = jest.fn();
    const onSelecionar = jest.fn();
    await renderizar(<CalendarioCabecalho dataRef={AGORA} onMudar={onMudar} onSelecionar={onSelecionar} />);
    await fireEvent.press(screen.getByLabelText('Próximo dia'));
    expect(onMudar).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByLabelText('Dia anterior'));
    expect(onMudar).toHaveBeenCalledWith(-1);
    await fireEvent.press(screen.getByLabelText(/segunda-feira, 2 de novembro/i));
    expect(onSelecionar).toHaveBeenCalledTimes(1);
  });
});

describe('EstatisticasDia', () => {
  it('mostra progresso e contadores', async () => {
    await renderizar(<EstatisticasDia p={{ total: 4, tomados: 1, restantes: 3, porcentagem: 25 }} />);
    expect(screen.getByText('Progresso de Hoje')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByLabelText('Restantes: 3')).toBeTruthy();
  });
});

describe('ListaRemedios', () => {
  const acoes = {
    onMarcar: jest.fn(),
    onAtivo: jest.fn(),
    onEditar: jest.fn(),
    onDuplicar: jest.fn(),
    onExcluir: jest.fn(),
    onRemoverPeriodo: jest.fn(),
  };
  beforeEach(() => Object.values(acoes).forEach((f) => f.mockClear()));

  it('estado vazio', async () => {
    await renderizar(<ListaRemedios remedios={[]} tomados={[]} hoje={HOJE} agora={AGORA} {...acoes} />);
    expect(screen.getByText('Nenhum remédio cadastrado')).toBeTruthy();
  });

  it('card com doses: marcar, atrasado e tomado', async () => {
    const r = remedio({
      horarios: [
        { id: 'a', periodo: 'manha', horario: '08:00' },
        { id: 'b', periodo: 'noite', horario: '21:00' },
      ],
      estoque: true, quantidadeEstoque: 2, alertaEstoque: 3,
      periodosDiarios: ['manha'], diasDeTratamento: 5,
    });
    const tomados: RemedioTomado[] = [];
    await renderizar(<ListaRemedios remedios={[r]} tomados={tomados} hoje={HOJE} agora={AGORA} {...acoes} />);
    expect(screen.getByText('Dipirona')).toBeTruthy();
    expect(screen.getByText('Diário')).toBeTruthy();
    expect(screen.getByText('5 dias')).toBeTruthy();
    expect(screen.getByText('2 unidades')).toBeTruthy();
    expect(screen.getByText('Atrasado')).toBeTruthy(); // 08:00 já passou às 10:00
    await fireEvent.press(screen.getByLabelText('Dipirona às 21:00'));
    expect(acoes.onMarcar).toHaveBeenCalledWith(r, 'noite', '21:00');
  });

  it('dose tomada aparece como tomada', async () => {
    const r = remedio();
    const t: RemedioTomado = { remedioId: 'r1', periodo: 'manha', horario: '08:00', data: HOJE, tomadoEm: '2026-11-07T11:00:00.000Z' };
    await renderizar(<ListaRemedios remedios={[r]} tomados={[t]} hoje={HOJE} agora={AGORA} {...acoes} />);
    expect(screen.getByText('Tomado')).toBeTruthy();
    expect(screen.queryByText('Atrasado')).toBeNull();
  });

  it('confirma antes de remover o remédio', async () => {
    const r = remedio();
    await renderizar(<ListaRemedios remedios={[r]} tomados={[]} hoje={HOJE} agora={AGORA} {...acoes} />);
    await fireEvent.press(screen.getByLabelText('Remover Dipirona'));
    expect(acoes.onExcluir).not.toHaveBeenCalled();
    expect(screen.getByText('Remover remédio?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Remover'));
    expect(acoes.onExcluir).toHaveBeenCalledWith(r);
  });

  it('ativar/inativar', async () => {
    const r = remedio();
    await renderizar(<ListaRemedios remedios={[r]} tomados={[]} hoje={HOJE} agora={AGORA} {...acoes} />);
    await fireEvent(screen.getByLabelText('Desativar Dipirona'), 'valueChange', false);
    expect(acoes.onAtivo).toHaveBeenCalledWith(r, false);
  });

  it('gráfico de dosagem', async () => {
    const r = remedio({
      estoqueDosagem: true, tipoMedicamentoDosagem: 'victoza', dosagemDiaria: 1.2,
      quantidadeTotalDosagem: 36, quantidadeRestanteDosagem: 12, quantidadeTotalAgulhas: 10, quantidadeRestanteAgulhas: 7,
    });
    await renderizar(<GraficoDosagem remedio={r} />);
    expect(screen.getByText('12 / 36 mg')).toBeTruthy();
    expect(screen.getByText('10 dias restantes')).toBeTruthy();
    expect(screen.getByText('Agulhas: 7 / 10')).toBeTruthy();
  });
});

describe('HistoricoRemedios', () => {
  it('vazio', async () => {
    await renderizar(<HistoricoRemedios tomados={[]} remedios={[]} onLimpar={() => undefined} />);
    expect(screen.getByText('Nenhum registro ainda')).toBeTruthy();
  });
  it('lista e limpa com confirmação', async () => {
    const onLimpar = jest.fn();
    const t: RemedioTomado = { remedioId: 'r1', periodo: 'manha', horario: '08:00', data: HOJE, tomadoEm: new Date(2026, 10, 7, 8, 5).toISOString() };
    await renderizar(<HistoricoRemedios tomados={[t]} remedios={[remedio()]} onLimpar={onLimpar} />);
    expect(screen.getByText('Dipirona')).toBeTruthy();
    expect(screen.getByText('Tomado às 08:05')).toBeTruthy();
    await fireEvent.press(screen.getByText('Limpar Histórico'));
    await fireEvent.press(screen.getByText('Limpar'));
    expect(onLimpar).toHaveBeenCalled();
  });
});

describe('FormularioRemedio', () => {
  it('valida e salva um remédio novo', async () => {
    const onSalvar = jest.fn(async () => undefined);
    const onFechar = jest.fn();
    await renderizar(<FormularioRemedio aberto modo="novo" remedio={null} listaId="l1" onFechar={onFechar} onSalvar={onSalvar} />);
    expect(screen.getByText('Novo Remédio')).toBeTruthy();

    await fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(screen.getByText('Por favor, informe o nome do remédio')).toBeTruthy());
    expect(screen.getByText('Selecione pelo menos um período')).toBeTruthy();
    expect(onSalvar).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Nome do remédio'), 'Losartana');
    await fireEvent.press(screen.getByLabelText('Manhã'));
    expect(screen.getByLabelText(/Horário 1 da Manhã: 08:00/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
    const salvo = (onSalvar.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(salvo).toMatchObject({ nome: 'Losartana', listaId: 'l1', ativo: true });
    expect((salvo.horarios as { horario: string }[])[0].horario).toBe('08:00');
    expect(onFechar).toHaveBeenCalled();
  });

  it('ativa o controle de estoque e valida a quantidade', async () => {
    const onSalvar = jest.fn(async () => undefined);
    await renderizar(<FormularioRemedio aberto modo="novo" remedio={null} listaId="l1" onFechar={() => undefined} onSalvar={onSalvar} />);
    await fireEvent.changeText(screen.getByLabelText('Nome do remédio'), 'Losartana');
    await fireEvent.press(screen.getByLabelText('Noite'));
    await fireEvent(screen.getByLabelText('Ativar estoque em unidades'), 'valueChange', true);
    await fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(screen.getByText('Por favor, informe uma quantidade de estoque válida')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Quantidade em estoque'), '30');
    await fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(onSalvar).toHaveBeenCalled());
    expect((onSalvar.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toMatchObject({ estoque: true, quantidadeEstoque: 30 });
  });

  it('editar mostra os dados do remédio', async () => {
    const r = remedio({ nome: 'Metformina', horarios: [{ id: 'h', periodo: 'tarde', horario: '15:30', anotacao: 'após o almoço' }] });
    await renderizar(<FormularioRemedio aberto modo="editar" remedio={r} listaId="l1" onFechar={() => undefined} onSalvar={async () => undefined} />);
    expect(screen.getByText('Editar Remédio')).toBeTruthy();
    expect(screen.getByDisplayValue('Metformina')).toBeTruthy();
    expect(screen.getByDisplayValue('após o almoço')).toBeTruthy();
    expect(screen.getByLabelText(/Horário 1 da Tarde: 15:30/)).toBeTruthy();
    expect(screen.getByText('Salvar')).toBeTruthy();
  });

  it('autocomplete sugere medicamentos da Anvisa', async () => {
    jest.useFakeTimers();
    try {
      await renderizar(<FormularioRemedio aberto modo="novo" remedio={null} listaId="l1" onFechar={() => undefined} onSalvar={async () => undefined} />);
      await fireEvent.changeText(screen.getByLabelText('Nome do remédio'), 'dipi');
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      await waitFor(() => expect(screen.getByLabelText('Usar Dipirona Sódica')).toBeTruthy());
      await fireEvent.press(screen.getByLabelText('Usar Dipirona Sódica'));
      expect(screen.getByDisplayValue('Dipirona Sódica')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('tema escuro', () => {
  it('renderiza com a preferência salva', async () => {
    mockTemaSalvo = 'dark';
    await renderizar(<EstatisticasDia p={{ total: 1, tomados: 1, restantes: 0, porcentagem: 100 }} />);
    expect(screen.getByText('100%')).toBeTruthy();
  });
});
