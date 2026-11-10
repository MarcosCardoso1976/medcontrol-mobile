import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { getMeta, setMeta } from '@/lib/db/repo';
import { dark, light, type Cores } from './tokens';

export type PreferenciaTema = 'system' | 'light' | 'dark';

interface Ctx {
  c: Cores;
  pref: PreferenciaTema;
  carregado: boolean;
  setPref: (p: PreferenciaTema) => void;
}

const TemaContext = createContext<Ctx>({ c: light, pref: 'system', carregado: false, setPref: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [pref, setPrefState] = useState<PreferenciaTema>('system');
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    getMeta('tema')
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
      })
      .catch(() => undefined)
      .finally(() => setCarregado(true));
  }, []);

  const setPref = useCallback((p: PreferenciaTema) => {
    setPrefState(p);
    void setMeta('tema', p);
  }, []);

  const escuro = pref === 'system' ? sistema === 'dark' : pref === 'dark';
  const valor = useMemo<Ctx>(() => ({ c: escuro ? dark : light, pref, carregado, setPref }), [escuro, pref, carregado, setPref]);
  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export const useTema = () => useContext(TemaContext);
