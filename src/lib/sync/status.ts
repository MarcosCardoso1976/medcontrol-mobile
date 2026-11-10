import { criarStore } from '@/lib/mini-store';

export interface StatusSync {
  estado: 'ocioso' | 'sincronizando' | 'offline' | 'erro' | 'sem-api';
  pendentes: number;
  descartados: number;
  ultimoErro: string | null;
  ultimaSync: number | null;
}

export const statusSync = criarStore<StatusSync>({
  estado: 'ocioso',
  pendentes: 0,
  descartados: 0,
  ultimoErro: null,
  ultimaSync: null,
});
