import { StyleSheet, View } from 'react-native';
import { Progresso } from '@/components/ui/progresso';
import { T } from '@/components/ui/texto';
import { DOSAGEM_POR_MARCA } from '@/lib/dominio/estoque';
import type { Remedio } from '@/types/remedio';
import { useTema } from '@/theme/theme-provider';

export function GraficoDosagem({ remedio: r }: { remedio: Remedio }) {
  const { c } = useTema();
  if (!r.estoqueDosagem || r.quantidadeRestanteDosagem === undefined) return null;
  const total = r.quantidadeTotalDosagem || (r.tipoMedicamentoDosagem ? DOSAGEM_POR_MARCA[r.tipoMedicamentoDosagem].total : 0);
  const restante = r.quantidadeRestanteDosagem;
  const pct = total > 0 ? (restante / total) * 100 : 0;
  const dias = r.dosagemDiaria && r.dosagemDiaria > 0 ? Math.floor(restante / r.dosagemDiaria) : null;
  const limite = r.alertaDiasDosagem || 7;
  const critico = restante <= 0;
  const aviso = !critico && dias !== null && dias <= limite;
  const cor = critico ? c.destructive : aviso ? c.warn : c.primaryLight;
  const marca = r.tipoMedicamentoDosagem ? r.tipoMedicamentoDosagem[0].toUpperCase() + r.tipoMedicamentoDosagem.slice(1) : 'Dosagem';

  return (
    <View
      style={[styles.caixa, { backgroundColor: c.dark ? 'rgba(255,255,255,0.04)' : c.muted }]}
      accessible
      accessibilityLabel={`${marca}: ${Number(restante.toFixed(1))} de ${total} miligramas restantes${dias !== null ? `, ${dias} dias` : ''}`}
    >
      <View style={styles.topo}>
        <T peso="bold" tam={12.5}>
          💉 {marca}
        </T>
        <T peso="extra" tam={12.5} style={{ color: cor }}>
          {Number(restante.toFixed(1))} / {total} mg
        </T>
      </View>
      <Progresso valor={pct} altura={6} />
      <View style={styles.topo}>
        <T tom="suave" tam={11.5}>
          {dias !== null ? `${dias} ${dias === 1 ? 'dia' : 'dias'} restantes` : ''}
        </T>
        {r.quantidadeRestanteAgulhas !== undefined ? (
          <T tom="suave" tam={11.5}>
            Agulhas: {r.quantidadeRestanteAgulhas}
            {r.quantidadeTotalAgulhas !== undefined ? ` / ${r.quantidadeTotalAgulhas}` : ''}
          </T>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { borderRadius: 14, padding: 10, gap: 6 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
