import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays } from 'date-fns';
import { AlertaEstoqueDialogo } from '@/components/home/alerta-estoque-dialogo';
import { CalendarioCabecalho } from '@/components/home/calendario-cabecalho';
import { EstatisticasDia } from '@/components/home/estatisticas-dia';
import { FormularioRemedio, type ModoFormulario } from '@/components/home/formulario-remedio';
import { HeaderListas } from '@/components/home/header-listas';
import { HistoricoDiaDialogo } from '@/components/home/historico-dia-dialogo';
import { HistoricoRemedios } from '@/components/home/historico-remedios';
import { IndicadorListaAtiva } from '@/components/home/indicador-lista-ativa';
import { ListaRemedios } from '@/components/home/lista-remedios';
import { BannerAlarmes, OnboardingPermissoes, precisaOnboarding } from '@/components/home/permissoes-alarme';
import { Abas } from '@/components/ui/abas';
import { Icone } from '@/components/ui/icone';
import { T } from '@/components/ui/texto';
import { dosesPendentes, progressoDoDia } from '@/lib/dominio/estatisticas';
import { useStore } from '@/lib/mini-store';
import {
  alternarAtivo,
  copiarLista,
  criarCopia,
  criarLista,
  definirListaAtiva,
  excluirLista,
  excluirRemedio,
  limparHistorico,
  marcarTomado,
  removerPeriodo,
  renomearLista,
  salvarRemedio,
  sincronizarAgora,
  useApp,
} from '@/lib/store';
import { statusSync } from '@/lib/sync/status';
import { toast } from '@/lib/toast';
import { getLocalDateString } from '@/lib/utils';
import type { Periodo, Remedio } from '@/types/remedio';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';

export default function Home() {
  const { c, setPref } = useTema();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { action } = useLocalSearchParams<{ action?: string }>();

  const listas = useApp((s) => s.listas);
  const listaAtivaId = useApp((s) => s.listaAtivaId);
  const todosRemedios = useApp((s) => s.remedios);
  const todosTomados = useApp((s) => s.tomados);
  const pronto = useApp((s) => s.pronto);
  const sync = useStore(statusSync, (e) => e.estado);
  const pendentesSync = useStore(statusSync, (e) => e.pendentes + e.descartados);

  const [dataRef, setDataRef] = useState(() => new Date());
  const [agora, setAgora] = useState(() => new Date());
  const [aba, setAba] = useState<'lista' | 'historico'>('lista');
  const [form, setForm] = useState<{ modo: ModoFormulario; remedio: Remedio | null } | null>(null);
  const [diaHistorico, setDiaHistorico] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    void precisaOnboarding().then(setOnboarding);
  }, [pronto]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre o formulário a partir do deep link ?action=add
    if (action === 'add' && pronto) setForm({ modo: 'novo', remedio: null });
  }, [action, pronto]);

  const hoje = getLocalDateString(agora);
  const remedios = useMemo(
    () => todosRemedios.filter((r) => r.listaId === listaAtivaId).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
    [todosRemedios, listaAtivaId],
  );
  const tomados = useMemo(() => {
    const ids = new Set(remedios.map((r) => r.id));
    return todosTomados.filter((t) => ids.has(t.remedioId));
  }, [todosTomados, remedios]);

  const progresso = useMemo(() => progressoDoDia(remedios, tomados, hoje), [remedios, tomados, hoje]);
  const pendentes = useMemo(() => dosesPendentes(remedios, tomados, hoje, agora), [remedios, tomados, hoje, agora]);
  const nomeLista = listas.find((l) => l.id === listaAtivaId)?.nome ?? 'Geral';

  const marcar = useCallback(async (r: Remedio, periodo: Periodo, horario: string) => {
    try {
      const res = await marcarTomado(r.id, periodo, horario, getLocalDateString(), 'alternar');
      if (res === 'marcado') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.sucesso('Remédio tomado');
      } else if (res === 'desmarcado') {
        void Haptics.selectionAsync();
        toast.sucesso('Remédio desmarcado');
      }
    } catch {
      toast.erro('Erro ao marcar remédio');
    }
  }, []);

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    try {
      await sincronizarAgora();
    } finally {
      setAtualizando(false);
    }
  }, []);

  const iconeSync = sync === 'sincronizando' ? 'refresh-cw' : sync === 'ocioso' && pendentesSync === 0 ? 'check-circle' : sync === 'offline' ? 'cloud-off' : sync === 'sem-api' ? 'cloud-off' : 'alert-triangle';
  const corSync = sync === 'ocioso' && pendentesSync === 0 ? c.primaryLight : sync === 'sincronizando' ? c.mutedForeground : sync === 'erro' ? c.warn : c.mutedForeground;
  const rotuloSync = sync === 'sincronizando' ? 'Sincronizando' : sync === 'offline' ? 'Sem conexão' : sync === 'sem-api' ? 'Sincronização desativada' : sync === 'erro' ? 'Erro de sincronização' : pendentesSync > 0 ? `${pendentesSync} pendência(s) de sincronização` : 'Sincronizado';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: c.headerBg, borderColor: c.headerBorder }]}>
        <HeaderListas
          listas={listas}
          ativaId={listaAtivaId}
          onSelecionar={(id) => void definirListaAtiva(id)}
          onCriar={criarLista}
          onRenomear={renomearLista}
          onExcluir={excluirLista}
          onCopiar={copiarLista}
        />
        <View style={{ flex: 1 }} />
        <BotaoHeader nome={iconeSync} rotulo={`${rotuloSync}. Abrir configurações`} cor={corSync} onPress={() => router.push('/configuracoes')} />
        <BotaoHeader
          nome={c.dark ? 'sun' : 'moon'}
          rotulo={c.dark ? 'Usar tema claro' : 'Usar tema escuro'}
          cor={c.foreground}
          onPress={() => setPref(c.dark ? 'light' : 'dark')}
        />
        <BotaoHeader nome="settings" rotulo="Configurações" cor={c.foreground} onPress={() => router.push('/configuracoes')} />
        <Pressable accessibilityRole="button" accessibilityLabel="Adicionar remédio" onPress={() => setForm({ modo: 'novo', remedio: null })} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <LinearGradient colors={c.addGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.add}>
            <Icone nome="plus" tam={20} cor="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.conteudo, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={c.primary} colors={[c.primary]} />}
        keyboardShouldPersistTaps="handled"
      >
        <BannerAlarmes temRemedios={remedios.length > 0} onAbrirAjuste={() => setOnboarding(true)} />
        <IndicadorListaAtiva nome={nomeLista} />

        {pendentes > 0 ? (
          <View accessibilityRole="alert" style={[styles.pendente, { backgroundColor: c.destructiveSoft, borderColor: c.destructiveBorder }]}>
            <Icone nome="alert-triangle" cor={c.destructive} />
            <T peso="bold" tam={13.5} tom="destrutivo" style={{ flex: 1 }}>
              Você tem {pendentes} {pendentes === 1 ? 'remédio que já passou' : 'remédios que já passaram'} do horário
            </T>
          </View>
        ) : null}

        <CalendarioCabecalho
          dataRef={dataRef}
          onMudar={(d) => setDataRef((x) => addDays(x, d))}
          onSelecionar={(d) => {
            setDataRef(d);
            setDiaHistorico(getLocalDateString(d));
          }}
        />
        <EstatisticasDia p={progresso} />

        <Abas
          itens={[
            { chave: 'lista', titulo: 'Lista de Remédios' },
            { chave: 'historico', titulo: 'Histórico' },
          ]}
          valor={aba}
          onChange={setAba}
        />

        {aba === 'lista' ? (
          <ListaRemedios
            remedios={remedios}
            tomados={tomados}
            hoje={hoje}
            agora={agora}
            onMarcar={marcar}
            onAtivo={(r, v) => void alternarAtivo(r.id, v)}
            onEditar={(r) => setForm({ modo: 'editar', remedio: r })}
            onDuplicar={(r) => setForm({ modo: 'duplicar', remedio: criarCopia(r) })}
            onExcluir={(r) => {
              void excluirRemedio(r.id).then(() => toast.sucesso('Remédio removido'));
            }}
            onRemoverPeriodo={(r, p) => {
              void removerPeriodo(r.id, p).then(() => toast.sucesso('Período removido'));
            }}
          />
        ) : (
          <HistoricoRemedios tomados={tomados} remedios={remedios} onLimpar={() => void limparHistorico().then(() => toast.sucesso('Histórico limpo'))} />
        )}
      </ScrollView>

      <FormularioRemedio
        aberto={!!form}
        modo={form?.modo ?? 'novo'}
        remedio={form?.remedio ?? null}
        listaId={listaAtivaId ?? ''}
        onFechar={() => setForm(null)}
        onSalvar={async (r) => {
          const novo = form?.modo !== 'editar';
          await salvarRemedio(r);
          toast.sucesso(novo ? 'Remédio adicionado' : 'Remédio atualizado');
        }}
      />
      <HistoricoDiaDialogo data={diaHistorico} hoje={hoje} tomados={todosTomados} remedios={todosRemedios} onFechar={() => setDiaHistorico(null)} />
      <AlertaEstoqueDialogo />
      <OnboardingPermissoes aberto={onboarding} onFechar={() => setOnboarding(false)} />
    </View>
  );
}

function BotaoHeader({ nome, rotulo, cor, onPress }: { nome: 'refresh-cw' | 'check-circle' | 'cloud-off' | 'alert-triangle' | 'sun' | 'moon' | 'settings'; rotulo: string; cor: string; onPress: () => void }) {
  const { c } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.botaoHeader, { backgroundColor: c.dark ? 'rgba(255,255,255,0.06)' : c.muted, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
    >
      <Icone nome={nome} tam={17} cor={cor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, zIndex: 10 },
  botaoHeader: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  add: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  conteudo: { padding: 16, gap: 16 },
  pendente: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1.5 },
});
