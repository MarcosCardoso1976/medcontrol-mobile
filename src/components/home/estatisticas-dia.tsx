import { StyleSheet, View } from 'react-native';
import { Cartao } from '@/components/ui/cartao';
import { Progresso } from '@/components/ui/progresso';
import { T } from '@/components/ui/texto';
import type { Progresso as DadosProgresso } from '@/lib/dominio/estatisticas';

export function EstatisticasDia({ p }: { p: DadosProgresso }) {
  return (
    <Cartao estilo={styles.cartao}>
      <View style={styles.topo}>
        <T peso="extra" tam={16}>
          Progresso de Hoje
        </T>
        <T peso="extra" tam={20} tom="destaque">
          {p.porcentagem}%
        </T>
      </View>
      <Progresso valor={p.porcentagem} />
      <View style={styles.linha}>
        <Contador rotulo="Total" valor={p.total} />
        <Contador rotulo="Tomados" valor={p.tomados} destaque />
        <Contador rotulo="Restantes" valor={p.restantes} />
      </View>
    </Cartao>
  );
}

function Contador({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <View style={styles.contador} accessible accessibilityLabel={`${rotulo}: ${valor}`}>
      <T peso="extra" tam={22} tom={destaque ? 'destaque' : 'padrao'}>
        {valor}
      </T>
      <T tom="suave" tam={12} peso="medium">
        {rotulo}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: { padding: 18, gap: 14 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linha: { flexDirection: 'row' },
  contador: { flex: 1, alignItems: 'center', gap: 2 },
});
