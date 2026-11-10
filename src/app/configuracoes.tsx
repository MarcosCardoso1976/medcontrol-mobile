import Constants from 'expo-constants';
import { format } from 'date-fns';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingPermissoes, dicaFabricante, usePermissoes } from '@/components/home/permissoes-alarme';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Cartao } from '@/components/ui/cartao';
import { Chave } from '@/components/ui/chave';
import { Confirmar } from '@/components/ui/dialogo';
import { Icone } from '@/components/ui/icone';
import { T } from '@/components/ui/texto';
import { estadoAlarmes, replanejar, salvarPreferencias } from '@/lib/alarmes';
import { agendarTeste, listarAgendadas } from '@/lib/alarmes/agendador';
import { abrirConfigBateria, abrirConfiguracoesDoApp, pedirNotificacoes } from '@/lib/alarmes/permissoes';
import { URL_API, apiConfigurada } from '@/lib/api/client';
import { emExpoGo } from '@/lib/ambiente';
import { limparDescartados, reativarOutbox } from '@/lib/db/repo';
import { codigoValido } from '@/lib/device-id';
import { useStore } from '@/lib/mini-store';
import { sincronizarAgora, useApp, vincularCodigo } from '@/lib/store';
import { statusSync } from '@/lib/sync/status';
import { toast } from '@/lib/toast';
import { radius } from '@/theme/tokens';
import { useTema, type PreferenciaTema } from '@/theme/theme-provider';

export default function Configuracoes() {
  const { c, pref, setPref } = useTema();
  const insets = useSafeAreaInsets();
  const permissoes = usePermissoes();
  const alarmes = useStore(estadoAlarmes, (e) => e);
  const sync = useStore(statusSync, (e) => e);
  const deviceId = useApp((s) => s.deviceId);

  const [onboarding, setOnboarding] = useState(false);
  const [diagnostico, setDiagnostico] = useState<{ id: string; titulo: string; corpo: string }[] | null>(null);
  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState('');
  const [erroCodigo, setErroCodigo] = useState<string | undefined>();
  const [confirmarVinculo, setConfirmarVinculo] = useState(false);
  const [vinculando, setVinculando] = useState(false);

  const carregarDiagnostico = useCallback(async () => setDiagnostico(await listarAgendadas()), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega o diagnóstico quando o plano muda
    if (diagnostico) void carregarDiagnostico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmes.ultimoPlano]);

  const android = Platform.OS === 'android';
  const dica = dicaFabricante();
  const cobertura = alarmes.coberturaAte ? format(new Date(alarmes.coberturaAte), "dd/MM 'às' HH:mm") : null;

  const textoSync =
    sync.estado === 'sem-api'
      ? 'Sincronização desativada (URL da API não configurada). O app funciona apenas neste aparelho.'
      : sync.estado === 'sincronizando'
        ? 'Sincronizando…'
        : sync.estado === 'offline'
          ? 'Sem conexão — suas alterações serão enviadas quando a internet voltar.'
          : sync.estado === 'erro'
            ? `Erro ao sincronizar${sync.ultimoErro ? `: ${sync.ultimoErro}` : ''}`
            : sync.ultimaSync
              ? `Sincronizado em ${format(new Date(sync.ultimaSync), "dd/MM 'às' HH:mm")}`
              : 'Ainda não sincronizado';

  const testar = async () => {
    if (permissoes?.notificacoes !== 'granted') {
      const ok = await pedirNotificacoes();
      if (!ok) return toast.erro('Permita as notificações primeiro');
    }
    await replanejar({ imediato: true });
    await agendarTeste(10);
    toast.info('Alarme de teste em 10 segundos. Pode fechar o app!');
  };

  const aplicarVinculo = async () => {
    setConfirmarVinculo(false);
    setVinculando(true);
    try {
      await vincularCodigo(novoCodigo);
      setNovoCodigo('');
      toast.sucesso('Dados vinculados');
    } catch {
      toast.erro('Não foi possível vincular');
    } finally {
      setVinculando(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={[styles.conteudo, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
      <Secao titulo="Aparência">
        <View style={styles.linha}>
          {(
            [
              ['system', 'Sistema'],
              ['light', 'Claro'],
              ['dark', 'Escuro'],
            ] as [PreferenciaTema, string][]
          ).map(([k, t]) => (
            <Opcao key={k} texto={t} ativo={pref === k} onPress={() => setPref(k)} />
          ))}
        </View>
      </Secao>

      <Secao titulo="Alarmes">
        {emExpoGo ? (
          <View style={[styles.info, { backgroundColor: c.warnSoft }]}>
            <T tam={12.5} peso="bold" tom="aviso">
              Você está no Expo Go
            </T>
            <T tam={12.5} tom="suave">
              Aqui o alarme com o app fechado NÃO é confiável (sem som personalizado, sem horário exato e sem tarefa em segundo plano). Para testar de verdade, instale o development build.
            </T>
          </View>
        ) : null}
        <Status ok={permissoes?.notificacoes === 'granted'} texto="Notificações" acao={permissoes?.notificacoes === 'granted' ? undefined : { titulo: 'Permitir', onPress: async () => { if (permissoes?.notificacoes === 'denied') await abrirConfiguracoesDoApp(); else await pedirNotificacoes(); } }} />
        {android ? <Status ok={permissoes?.alarmeExato ?? true} texto="Alarmes e lembretes (horário exato)" acao={permissoes?.alarmeExato === false ? { titulo: 'Permitir', onPress: () => setOnboarding(true) } : undefined} /> : null}
        {android ? (
          <View style={{ gap: 6 }}>
            <Botao titulo="Ajustes de bateria" icone="battery-charging" variante="contorno" tamanho="sm" onPress={abrirConfigBateria} estilo={{ alignSelf: 'flex-start' }} />
            {dica ? (
              <T tom="suave" tam={12.5}>
                {dica}
              </T>
            ) : null}
          </View>
        ) : null}

        <Linha titulo="Avisar 15 minutos antes" valor={alarmes.preAviso} onChange={(v) => void salvarPreferencias({ preAviso: v })} />
        <Linha titulo="Lembretes de atraso (+10, +25 e +40 min)" valor={alarmes.atrasos} onChange={(v) => void salvarPreferencias({ atrasos: v })} />

        <View style={[styles.info, { backgroundColor: c.dark ? 'rgba(255,255,255,0.04)' : c.muted }]}>
          <T tam={13} peso="bold">
            {alarmes.total} avisos agendados
          </T>
          <T tam={12.5} tom="suave">
            {cobertura ? `Cobertura até ${cobertura}` : 'Nenhum alarme agendado no momento'}
          </T>
          {alarmes.erro ? (
            <T tam={12.5} tom="destrutivo">
              Erro: {alarmes.erro}
            </T>
          ) : null}
        </View>

        <View style={styles.linha}>
          <Botao titulo="Testar em 10 s" icone="bell" onPress={testar} estilo={{ flex: 1 }} />
          <Botao titulo="Passo a passo" icone="help-circle" variante="contorno" onPress={() => setOnboarding(true)} estilo={{ flex: 1 }} />
        </View>
        <Botao
          titulo={diagnostico ? 'Ocultar diagnóstico' : 'Diagnóstico de alarmes'}
          variante="fantasma"
          tamanho="sm"
          onPress={() => (diagnostico ? setDiagnostico(null) : void carregarDiagnostico())}
        />
        {diagnostico ? (
          <View style={{ gap: 6 }}>
            {diagnostico.length === 0 ? (
              <T tom="suave" tam={12.5}>
                Nada agendado.
              </T>
            ) : (
              diagnostico.slice(0, 40).map((d) => (
                <T key={d.id} tam={11.5} tom="suave" numberOfLines={2}>
                  {d.titulo} · {d.corpo}
                </T>
              ))
            )}
            {diagnostico.length > 40 ? (
              <T tam={11.5} tom="suave">
                … e mais {diagnostico.length - 40}
              </T>
            ) : null}
          </View>
        ) : null}
      </Secao>

      <Secao titulo="Dados e sincronização">
        <T tam={13} tom="suave">
          {textoSync}
        </T>
        {apiConfigurada ? (
          <T tam={11.5} tom="suave" numberOfLines={1}>
            Servidor: {URL_API}
          </T>
        ) : null}
        {sync.pendentes > 0 ? (
          <T tam={12.5} peso="bold" tom="aviso">
            {sync.pendentes} alteração(ões) aguardando envio
          </T>
        ) : null}
        {sync.descartados > 0 ? (
          <View style={{ gap: 8 }}>
            <T tam={12.5} peso="bold" tom="destrutivo">
              {sync.descartados} alteração(ões) rejeitada(s) pelo servidor{sync.ultimoErro ? `: ${sync.ultimoErro}` : ''}
            </T>
            <View style={styles.linha}>
              <Botao titulo="Tentar de novo" variante="contorno" tamanho="sm" estilo={{ flex: 1 }} onPress={async () => { await reativarOutbox(); await sincronizarAgora(); }} />
              <Botao titulo="Descartar" variante="destrutivo" tamanho="sm" estilo={{ flex: 1 }} onPress={async () => { await limparDescartados(); await sincronizarAgora(); }} />
            </View>
          </View>
        ) : null}
        <Botao titulo="Sincronizar agora" icone="refresh-cw" variante="contorno" carregando={sync.estado === 'sincronizando'} onPress={sincronizarAgora} />

        <View style={[styles.separador, { backgroundColor: c.border }]} />
        <T peso="extra" tam={14}>
          Código de vínculo
        </T>
        <T tam={12.5} tom="suave">
          Use o mesmo código em outro aparelho (ou no app antigo) para acessar os mesmos remédios. Trate-o como uma senha.
        </T>
        <View style={styles.linha}>
          <View style={[styles.codigo, { backgroundColor: c.dark ? 'rgba(255,255,255,0.04)' : c.muted, borderColor: c.border }]}>
            <T tam={12.5} peso="bold" numberOfLines={1} selectable={mostrarCodigo}>
              {mostrarCodigo ? deviceId : '••••••••-••••-••••-••••-••••••••••••'}
            </T>
          </View>
          <Botao icone={mostrarCodigo ? 'eye-off' : 'eye'} variante="contorno" acessibilidade={mostrarCodigo ? 'Ocultar código' : 'Mostrar código'} onPress={() => setMostrarCodigo((v) => !v)} />
          <Botao icone="share-2" variante="contorno" acessibilidade="Compartilhar código" onPress={() => deviceId && void Share.share({ message: deviceId })} />
        </View>
        <Campo
          rotulo="Usar outro código"
          value={novoCodigo}
          onChangeText={(t) => {
            setNovoCodigo(t);
            setErroCodigo(undefined);
          }}
          placeholder="Cole aqui o código do outro aparelho"
          autoCapitalize="none"
          autoCorrect={false}
          erro={erroCodigo}
        />
        <Botao
          titulo="Vincular este código"
          variante="contorno"
          carregando={vinculando}
          desabilitado={!novoCodigo.trim()}
          onPress={() => {
            if (!codigoValido(novoCodigo)) return setErroCodigo('Código inválido');
            setConfirmarVinculo(true);
          }}
        />
      </Secao>

      <Secao titulo="Sobre">
        <T tam={13} tom="suave">
          MedControl {Constants.expoConfig?.version ?? ''}
        </T>
        <T tam={12.5} tom="suave">
          O MedControl é um lembrete de horários e não substitui a orientação de um profissional de saúde.
        </T>
      </Secao>

      <Confirmar
        aberto={confirmarVinculo}
        titulo="Substituir os dados deste aparelho?"
        descricao="Os remédios deste aparelho serão substituídos pelos da conta desse código. Alterações ainda não enviadas serão perdidas."
        confirmarTexto="Vincular"
        perigo
        onCancelar={() => setConfirmarVinculo(false)}
        onConfirmar={aplicarVinculo}
      />
      <OnboardingPermissoes aberto={onboarding} onFechar={() => setOnboarding(false)} />
    </ScrollView>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Cartao estilo={styles.secao}>
      <T peso="extra" tam={17} accessibilityRole="header">
        {titulo}
      </T>
      {children}
    </Cartao>
  );
}

function Status({ ok, texto, acao }: { ok: boolean; texto: string; acao?: { titulo: string; onPress: () => void } }) {
  const { c } = useTema();
  return (
    <View style={styles.linhaStatus}>
      <Icone nome={ok ? 'check-circle' : 'alert-circle'} cor={ok ? c.primaryLight : c.destructive} />
      <T tam={14} peso="medium" style={{ flex: 1 }}>
        {texto}
      </T>
      {acao ? <Botao titulo={acao.titulo} tamanho="sm" onPress={acao.onPress} /> : null}
    </View>
  );
}

function Linha({ titulo, valor, onChange }: { titulo: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.linhaStatus}>
      <T tam={14} peso="medium" style={{ flex: 1 }}>
        {titulo}
      </T>
      <Chave valor={valor} onChange={onChange} rotulo={titulo} />
    </View>
  );
}

function Opcao({ texto, ativo, onPress }: { texto: string; ativo: boolean; onPress: () => void }) {
  const { c } = useTema();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: ativo }}
      onPress={onPress}
      style={[styles.opcao, { borderColor: ativo ? c.primary : c.input, backgroundColor: ativo ? c.primarySoft : 'transparent' }]}
    >
      <T peso="bold" tam={13.5} style={{ color: ativo ? c.primaryLight : c.foreground }}>
        {texto}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 16, gap: 16 },
  secao: { padding: 16, gap: 12 },
  linha: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  linhaStatus: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  info: { padding: 12, borderRadius: radius.md, gap: 2 },
  opcao: { flex: 1, height: 42, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  codigo: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 12, justifyContent: 'center' },
  separador: { height: 1, marginVertical: 4 },
});
