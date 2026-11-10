import { useCallback, useEffect } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import * as Device from 'expo-device';
import { Botao } from '@/components/ui/botao';
import { Folha } from '@/components/ui/dialogo';
import { Icone } from '@/components/ui/icone';
import { T } from '@/components/ui/texto';
import { atualizarPermissoes, diasDeCobertura, estadoAlarmes, replanejar } from '@/lib/alarmes';
import {
  abrirConfigBateria,
  abrirConfiguracoesDoApp,
  pedirAlarmeExato,
  pedirNotificacoes,
  type EstadoPermissoes,
} from '@/lib/alarmes/permissoes';
import { getMeta, setMeta } from '@/lib/db/repo';
import { useStore } from '@/lib/mini-store';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';

/** Dicas por fabricante (Android): esses sistemas costumam "matar" apps em segundo plano. */
export function dicaFabricante(): string | null {
  if (Platform.OS !== 'android') return null;
  const m = (Device.manufacturer ?? '').toLowerCase();
  if (m.includes('xiaomi') || m.includes('redmi') || m.includes('poco'))
    return 'Xiaomi/Redmi: em Configurações › Apps › MedControl › ative "Início automático" e escolha "Sem restrições" em Economia de bateria.';
  if (m.includes('samsung'))
    return 'Samsung: em Configurações › Bateria › Limites de uso em segundo plano, remova o MedControl de "Apps em suspensão" e "Apps em suspensão profunda".';
  if (m.includes('huawei') || m.includes('honor'))
    return 'Huawei/Honor: em Bateria › Inicialização de apps, desative o gerenciamento automático do MedControl e permita execução em segundo plano.';
  if (m.includes('oppo') || m.includes('realme') || m.includes('oneplus') || m.includes('vivo'))
    return 'Oppo/Realme/OnePlus/Vivo: permita "Início automático" e "Atividade em segundo plano" para o MedControl nas configurações de bateria do app.';
  if (m.includes('motorola'))
    return 'Motorola: em Configurações › Apps › MedControl › Bateria, escolha "Sem restrições".';
  return 'Em Configurações › Apps › MedControl › Bateria, escolha "Sem restrições" para que os alarmes nunca sejam adiados.';
}

export function usePermissoes() {
  const permissoes = useStore(estadoAlarmes, (e) => e.permissoes);
  useEffect(() => {
    void atualizarPermissoes();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void atualizarPermissoes();
    });
    return () => sub.remove();
  }, []);
  return permissoes;
}

/** Banner de alerta na Home: permissões ausentes ou cobertura de alarmes curta. */
export function BannerAlarmes({ temRemedios, onAbrirAjuste }: { temRemedios: boolean; onAbrirAjuste: () => void }) {
  const { c } = useTema();
  const permissoes = usePermissoes();
  const cobertura = useStore(estadoAlarmes, (e) => e.coberturaAte);
  if (!permissoes) return null;

  let msg: string | null = null;
  if (permissoes.notificacoes !== 'granted') msg = 'As notificações estão desativadas — você não será avisado na hora do remédio.';
  else if (!permissoes.alarmeExato) msg = 'Permita "Alarmes e lembretes" para que os avisos toquem no horário exato.';
  else if (temRemedios && Platform.OS === 'ios') {
    const dias = diasDeCobertura(cobertura);
    if (dias !== null && dias < 3) msg = 'Abra o MedControl com frequência para manter seus lembretes ativos.';
  }
  if (!msg) return null;
  const critico = permissoes.notificacoes !== 'granted' || !permissoes.alarmeExato;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: critico ? c.destructiveSoft : c.warnSoft, borderColor: critico ? c.destructiveBorder : c.warn }]}
    >
      <Icone nome="alert-triangle" cor={critico ? c.destructive : c.warn} />
      <T tam={13} peso="medium" style={{ flex: 1 }}>
        {msg}
      </T>
      <Botao titulo="Ajustar" tamanho="sm" variante="contorno" onPress={onAbrirAjuste} />
    </View>
  );
}

/** Passo a passo de permissões e bateria (abre sozinho na primeira vez e pelo banner/Configurações). */
export function OnboardingPermissoes({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { c } = useTema();
  const permissoes = usePermissoes();
  const android = Platform.OS === 'android';
  const dica = dicaFabricante();

  const concluir = useCallback(async () => {
    await setMeta('onboarding_ok', '1');
    void replanejar({ imediato: true });
    onFechar();
  }, [onFechar]);

  const notificacoesOk = permissoes?.notificacoes === 'granted';
  const exatoOk = permissoes?.alarmeExato ?? true;

  return (
    <Folha aberto={aberto} onFechar={concluir} titulo="Receba seus lembretes" descricao="Três ajustes rápidos garantem que o alarme toque na hora certa">
      <View style={styles.corpo}>
        <Passo
          n={1}
          titulo="Permitir notificações"
          texto="Necessário para o MedControl avisar a hora do remédio, mesmo com o app fechado."
          ok={notificacoesOk}
          acao={async () => {
            const p: EstadoPermissoes | null = permissoes;
            if (p?.podePedirNotificacao === false && p.notificacoes === 'denied') await abrirConfiguracoesDoApp();
            else await pedirNotificacoes();
            await atualizarPermissoes();
          }}
          rotuloAcao="Permitir"
        />
        {android ? (
          <Passo
            n={2}
            titulo="Alarmes e lembretes"
            texto="Permite que o aviso toque no minuto exato, como o despertador do celular."
            ok={exatoOk}
            acao={async () => {
              await pedirAlarmeExato();
              await atualizarPermissoes();
            }}
            rotuloAcao="Permitir"
          />
        ) : null}
        {android ? (
          <Passo
            n={3}
            titulo="Sem restrição de bateria"
            texto={dica ?? ''}
            ok={false}
            acao={abrirConfigBateria}
            rotuloAcao="Abrir ajustes"
            opcional
          />
        ) : null}
        <View style={{ flex: 1 }} />
        <Botao titulo="Concluir" tamanho="lg" onPress={concluir} />
        <T tom="suave" tam={12} centro style={{ color: c.mutedForeground }}>
          Você pode rever estes ajustes depois em Configurações.
        </T>
      </View>
    </Folha>
  );
}

function Passo({
  n,
  titulo,
  texto,
  ok,
  acao,
  rotuloAcao,
  opcional,
}: {
  n: number;
  titulo: string;
  texto: string;
  ok: boolean;
  acao: () => void | Promise<void>;
  rotuloAcao: string;
  opcional?: boolean;
}) {
  const { c } = useTema();
  return (
    <View style={[styles.passo, { borderColor: ok ? c.primaryBorder : c.border, backgroundColor: ok ? c.primarySoft : 'transparent' }]}>
      <View style={[styles.numero, { backgroundColor: ok ? c.primary : c.muted }]}>
        {ok ? <Icone nome="check" tam={16} cor="#FFFFFF" /> : <T peso="extra" tam={14}>{n}</T>}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <T peso="extra" tam={15}>
          {titulo}
          {opcional ? ' (recomendado)' : ''}
        </T>
        {texto ? (
          <T tom="suave" tam={13}>
            {texto}
          </T>
        ) : null}
        {!ok ? <Botao titulo={rotuloAcao} tamanho="sm" onPress={() => void acao()} estilo={{ alignSelf: 'flex-start' }} /> : null}
      </View>
    </View>
  );
}

/** Retorna true quando o onboarding ainda não foi concluído e há permissão pendente. */
export async function precisaOnboarding(): Promise<boolean> {
  if ((await getMeta('onboarding_ok')) === '1') return false;
  const p = await atualizarPermissoes();
  return p.notificacoes !== 'granted' || !p.alarmeExato || Platform.OS === 'android';
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1.5 },
  corpo: { flex: 1, padding: 20, gap: 14 },
  passo: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1.5 },
  numero: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
