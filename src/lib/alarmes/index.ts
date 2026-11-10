import { Platform } from 'react-native';
import { getMeta, obterListas, obterRemedios, obterTomados, setMeta } from '@/lib/db/repo';
import { criarStore } from '@/lib/mini-store';
import { aplicarPlano } from './agendador';
import { configurarNotificacoes } from './canais';
import { obterEstadoPermissoes, type EstadoPermissoes } from './permissoes';
import { calcularPlano } from './plano';

export interface EstadoAlarmes {
  permissoes: EstadoPermissoes | null;
  total: number;
  coberturaAte: string | null;
  ultimoPlano: number | null;
  erro: string | null;
  preAviso: boolean;
  atrasos: boolean;
}

export const estadoAlarmes = criarStore<EstadoAlarmes>({
  permissoes: null,
  total: 0,
  coberturaAte: null,
  ultimoPlano: null,
  erro: null,
  preAviso: true,
  atrasos: true,
});

export async function carregarPreferencias() {
  const [pre, atr] = await Promise.all([getMeta('pref_preaviso'), getMeta('pref_atrasos')]);
  estadoAlarmes.set({ preAviso: pre !== '0', atrasos: atr !== '0' });
}

export async function salvarPreferencias(p: { preAviso?: boolean; atrasos?: boolean }) {
  if (p.preAviso !== undefined) await setMeta('pref_preaviso', p.preAviso ? '1' : '0');
  if (p.atrasos !== undefined) await setMeta('pref_atrasos', p.atrasos ? '1' : '0');
  estadoAlarmes.set(p);
  await replanejar({ imediato: true });
}

export async function atualizarPermissoes() {
  const permissoes = await obterEstadoPermissoes();
  estadoAlarmes.set({ permissoes });
  return permissoes;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let execucao: Promise<void> = Promise.resolve();
let aguardando: (() => void)[] = [];

/** Recalcula o plano e reaplica no sistema. Com debounce de 400 ms (use `imediato` para forçar). */
export function replanejar(opts: { imediato?: boolean } = {}): Promise<void> {
  return new Promise((resolve) => {
    aguardando.push(resolve);
    if (timer) clearTimeout(timer);
    const disparar = () => {
      timer = null;
      const resolvedores = aguardando;
      aguardando = [];
      execucao = execucao.then(executar).finally(() => resolvedores.forEach((r) => r()));
    };
    if (opts.imediato) disparar();
    else timer = setTimeout(disparar, 400);
  });
}

async function executar(): Promise<void> {
  try {
    const permissoes = await atualizarPermissoes();
    if (permissoes.notificacoes !== 'granted') {
      estadoAlarmes.set({ erro: null, total: 0, coberturaAte: null });
      return;
    }
    await configurarNotificacoes();
    const [remedios, tomados, listas, pre, atr] = await Promise.all([
      obterRemedios(),
      obterTomados(),
      obterListas(),
      getMeta('pref_preaviso'),
      getMeta('pref_atrasos'),
    ]);
    const { notificacoes, coberturaAte } = calcularPlano(remedios, tomados, listas, {
      agora: new Date(),
      plataforma: Platform.OS === 'ios' ? 'ios' : 'android',
      preAviso: pre !== '0',
      atrasos: atr !== '0',
    });
    await aplicarPlano(notificacoes);
    const agora = Date.now();
    await setMeta('alarmes_cobertura', coberturaAte ? coberturaAte.toISOString() : '');
    estadoAlarmes.set({
      total: notificacoes.length,
      coberturaAte: coberturaAte ? coberturaAte.toISOString() : null,
      ultimoPlano: agora,
      erro: null,
      preAviso: pre !== '0',
      atrasos: atr !== '0',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[alarmes] falha ao replanejar:', msg);
    estadoAlarmes.set({ erro: msg });
  }
}

/** Dias de cobertura restantes (para o aviso de renovação, principalmente no iOS). */
export function diasDeCobertura(coberturaAte: string | null, agora = new Date()): number | null {
  if (!coberturaAte) return null;
  return Math.floor((new Date(coberturaAte).getTime() - agora.getTime()) / 86_400_000);
}
