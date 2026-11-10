import { criarStore } from './mini-store';

export interface EstadoToast {
  id: number;
  msg: string | null;
  tipo: 'sucesso' | 'erro' | 'info';
}
export const toastStore = criarStore<EstadoToast>({ id: 0, msg: null, tipo: 'info' });

const mostrar = (msg: string, tipo: EstadoToast['tipo']) => toastStore.set((e) => ({ id: e.id + 1, msg, tipo }));
export const toast = {
  sucesso: (m: string) => mostrar(m, 'sucesso'),
  erro: (m: string) => mostrar(m, 'erro'),
  info: (m: string) => mostrar(m, 'info'),
};
