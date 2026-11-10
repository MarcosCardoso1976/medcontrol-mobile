import { useSyncExternalStore } from 'react';

/** Store mínima (sem dependências) compatível com React 19 via useSyncExternalStore. */
export function criarStore<T extends object>(inicial: T) {
  let estado = inicial;
  const ouvintes = new Set<() => void>();
  return {
    get: () => estado,
    set(parcial: Partial<T> | ((e: T) => Partial<T>)) {
      const p = typeof parcial === 'function' ? parcial(estado) : parcial;
      estado = { ...estado, ...p };
      ouvintes.forEach((l) => l());
    },
    subscribe(l: () => void) {
      ouvintes.add(l);
      return () => {
        ouvintes.delete(l);
      };
    },
  };
}

export type Store<T extends object> = ReturnType<typeof criarStore<T>>;

/** O seletor deve devolver valores estáveis (primitivos ou referências já guardadas no estado). */
export function useStore<T extends object, S>(store: Store<T>, seletor: (e: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => seletor(store.get()), () => seletor(store.get()));
}
