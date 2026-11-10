import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { Chave } from '@/components/ui/chave';
import { Confirmar, Dialogo } from '@/components/ui/dialogo';
import { Emblema } from '@/components/ui/emblema';
import { Icone } from '@/components/ui/icone';
import { T } from '@/components/ui/texto';
import { dosePendente } from '@/lib/dominio/estatisticas';
import { PERIODOS_ORDEM, PERIODO_EMOJIS, PERIODO_LABELS, obterHorariosPorPeriodo } from '@/lib/dominio/periodos';
import type { Periodo, Remedio, RemedioTomado } from '@/types/remedio';
import { useTema } from '@/theme/theme-provider';
import { GraficoDosagem } from './grafico-dosagem';

interface Props {
  remedios: Remedio[];
  tomados: RemedioTomado[];
  hoje: string;
  agora: Date;
  onMarcar: (r: Remedio, periodo: Periodo, horario: string) => void;
  onAtivo: (r: Remedio, ativo: boolean) => void;
  onEditar: (r: Remedio) => void;
  onDuplicar: (r: Remedio) => void;
  onExcluir: (r: Remedio) => void;
  onRemoverPeriodo: (r: Remedio, p: Periodo) => void;
}

export function ListaRemedios(props: Props) {
  const { remedios } = props;
  const { c } = useTema();
  const [confirmarExcluir, setConfirmarExcluir] = useState<Remedio | null>(null);
  const [confirmarPeriodo, setConfirmarPeriodo] = useState<{ r: Remedio; p: Periodo } | null>(null);
  const [notas, setNotas] = useState<Remedio | null>(null);

  if (remedios.length === 0) {
    return (
      <Cartao estilo={styles.vazio}>
        <T tam={42}>💊</T>
        <T peso="extra" tam={17} centro>
          Nenhum remédio cadastrado
        </T>
        <T tom="suave" tam={14} centro>
          Toque no botão + para adicionar seu primeiro remédio e receber os lembretes.
        </T>
      </Cartao>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {remedios.map((r) => (
        <CardRemedio
          key={r.id}
          r={r}
          {...props}
          onExcluirPedido={() => setConfirmarExcluir(r)}
          onPeriodoPedido={(p) => setConfirmarPeriodo({ r, p })}
          onNotas={() => setNotas(r)}
        />
      ))}

      <Confirmar
        aberto={!!confirmarExcluir}
        titulo="Remover remédio?"
        descricao={confirmarExcluir ? `"${confirmarExcluir.nome}" e seus horários serão removidos. Esta ação não pode ser desfeita.` : ''}
        confirmarTexto="Remover"
        perigo
        onCancelar={() => setConfirmarExcluir(null)}
        onConfirmar={() => {
          if (confirmarExcluir) props.onExcluir(confirmarExcluir);
          setConfirmarExcluir(null);
        }}
      />
      <Confirmar
        aberto={!!confirmarPeriodo}
        titulo={confirmarPeriodo ? `Remover do período ${PERIODO_LABELS[confirmarPeriodo.p]}?` : ''}
        descricao={confirmarPeriodo ? `Os horários de "${confirmarPeriodo.r.nome}" neste período serão removidos.` : ''}
        confirmarTexto="Remover"
        perigo
        onCancelar={() => setConfirmarPeriodo(null)}
        onConfirmar={() => {
          if (confirmarPeriodo) props.onRemoverPeriodo(confirmarPeriodo.r, confirmarPeriodo.p);
          setConfirmarPeriodo(null);
        }}
      />
      <Dialogo
        aberto={!!notas}
        onFechar={() => setNotas(null)}
        titulo={notas ? `Anotações · ${notas.nome}` : ''}
        icone={<Icone nome="file-text" cor={c.primaryLight} />}
        acoes={<Botao titulo="Fechar" variante="contorno" onPress={() => setNotas(null)} estilo={{ flex: 1 }} />}
      >
        <View style={{ gap: 10 }}>
          {notas?.horarios
            .filter((h) => h.anotacao)
            .map((h) => (
              <T key={h.id} tam={14}>
                <T peso="bold" tam={14}>
                  {PERIODO_LABELS[h.periodo]} - {h.horario}:{' '}
                </T>
                {h.anotacao}
              </T>
            ))}
        </View>
      </Dialogo>
    </View>
  );
}

function CardRemedio({
  r,
  tomados,
  hoje,
  agora,
  onMarcar,
  onAtivo,
  onEditar,
  onDuplicar,
  onExcluirPedido,
  onPeriodoPedido,
  onNotas,
}: Props & { r: Remedio; onExcluirPedido: () => void; onPeriodoPedido: (p: Periodo) => void; onNotas: () => void }) {
  const { c } = useTema();
  const periodos = PERIODOS_ORDEM.filter((p) => r.horarios.some((h) => h.periodo === p));
  const temNotas = r.horarios.some((h) => !!h.anotacao);
  const diario = !!r.periodosDiarios && r.periodosDiarios.length > 0;

  return (
    <Cartao estilo={[styles.card, { opacity: r.ativo ? 1 : 0.6 }]}>
      <View style={styles.topo}>
        <View style={{ flex: 1, gap: 6 }}>
          <T peso="extra" tam={17} numberOfLines={2}>
            {r.nome}
          </T>
          <View style={styles.badges}>
            {diario ? <Emblema texto="Diário" tom="primario" /> : null}
            {r.diasDeTratamento && r.diasDeTratamento > 0 ? (
              <Emblema texto={`${r.diasDeTratamento} ${r.diasDeTratamento === 1 ? 'dia' : 'dias'}`} tom="alerta" />
            ) : null}
            {periodos.map((p) => (
              <Emblema key={p} texto={`${PERIODO_EMOJIS[p]} ${PERIODO_LABELS[p]}`} />
            ))}
          </View>
        </View>
        <View style={styles.switchCol}>
          <Chave valor={r.ativo} onChange={(v) => onAtivo(r, v)} rotulo={`${r.ativo ? 'Desativar' : 'Ativar'} ${r.nome}`} />
          <T tam={11} tom="suave" peso="bold">
            {r.ativo ? 'Ativo' : 'Inativo'}
          </T>
        </View>
      </View>

      <Estoque r={r} />
      {r.estoqueDosagem ? <GraficoDosagem remedio={r} /> : null}

      <View style={styles.acoes}>
        {temNotas ? <BotaoIcone nome="file-text" rotulo="Ver anotações" onPress={onNotas} /> : null}
        <BotaoIcone nome="copy" rotulo={`Duplicar ${r.nome}`} onPress={() => onDuplicar(r)} />
        <BotaoIcone nome="edit-2" rotulo={`Editar ${r.nome}`} onPress={() => onEditar(r)} />
        <BotaoIcone nome="trash-2" rotulo={`Remover ${r.nome}`} onPress={onExcluirPedido} perigo />
      </View>

      <View style={{ gap: 12 }}>
        {periodos.map((p) => (
          <View key={p} style={{ gap: 8 }}>
            {periodos.length > 1 ? (
              <View style={styles.cabPeriodo}>
                <T peso="bold" tam={13} tom="suave">
                  {PERIODO_EMOJIS[p]} {PERIODO_LABELS[p]}
                </T>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${r.nome} do período ${PERIODO_LABELS[p]}`}
                  hitSlop={10}
                  onPress={() => onPeriodoPedido(p)}
                >
                  <Icone nome="x" tam={16} cor={c.mutedForeground} />
                </Pressable>
              </View>
            ) : null}
            {obterHorariosPorPeriodo(r.horarios, p).map((h) => {
              const tomado = tomados.some((t) => t.remedioId === r.id && t.periodo === h.periodo && t.horario === h.horario && t.data === hoje);
              const pendente = dosePendente(r, h.periodo, h.horario, tomados, hoje, agora);
              return (
                <Pressable
                  key={h.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: tomado }}
                  accessibilityLabel={`${r.nome} às ${h.horario}${tomado ? ', tomado' : pendente ? ', atrasado' : ''}`}
                  onPress={() => onMarcar(r, h.periodo, h.horario)}
                  style={({ pressed }) => [
                    styles.dose,
                    {
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      backgroundColor: tomado ? c.primarySoft : pendente ? c.destructiveSoft : c.dark ? 'rgba(255,255,255,0.04)' : c.muted,
                      borderColor: tomado ? c.primaryBorder : pendente ? c.destructiveBorder : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.check,
                      {
                        backgroundColor: tomado ? c.primary : 'transparent',
                        borderColor: tomado ? c.primary : pendente ? c.destructive : c.mutedForeground,
                      },
                    ]}
                  >
                    {tomado ? <Icone nome="check" tam={14} cor="#FFFFFF" /> : null}
                  </View>
                  <T peso="extra" tam={17} style={{ color: tomado ? c.primaryLight : pendente ? c.destructive : c.foreground }}>
                    {h.horario}
                  </T>
                  <View style={{ flex: 1 }} />
                  {tomado ? (
                    <T tam={12} peso="bold" tom="primario">
                      Tomado
                    </T>
                  ) : pendente ? (
                    <View style={styles.atraso}>
                      <Icone nome="alert-circle" tam={14} cor={c.destructive} />
                      <T tam={12} peso="bold" tom="destrutivo">
                        Atrasado
                      </T>
                    </View>
                  ) : (
                    <Icone nome="clock" tam={14} cor={c.mutedForeground} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Cartao>
  );
}

function Estoque({ r }: { r: Remedio }) {
  const itens: { texto: string; nivel: 'ok' | 'aviso' | 'critico'; icone: 'package' | 'droplet' }[] = [];
  if (r.estoque && r.quantidadeEstoque !== undefined) {
    const q = r.quantidadeEstoque;
    const nivel = q === 0 ? 'critico' : r.alertaEstoque !== undefined && q <= r.alertaEstoque ? 'aviso' : 'ok';
    itens.push({ texto: `${q} ${q === 1 ? 'unidade' : 'unidades'}`, nivel, icone: 'package' });
  }
  if (r.estoqueVolume && r.quantidadeRestanteVolume !== undefined) {
    const q = r.quantidadeRestanteVolume;
    const nivel = q <= 0 ? 'critico' : r.alertaVolume !== undefined && q <= r.alertaVolume ? 'aviso' : 'ok';
    itens.push({ texto: `${Number(q.toFixed(1))} ${r.unidadeVolume ?? 'ml'}`, nivel, icone: 'droplet' });
  }
  const { c } = useTema();
  if (itens.length === 0) return null;
  return (
    <View style={styles.badges}>
      {itens.map((i) => {
        const cor = i.nivel === 'critico' ? c.destructive : i.nivel === 'aviso' ? c.warn : c.mutedForeground;
        return (
          <View
            key={i.texto}
            accessible
            accessibilityLabel={`Estoque: ${i.texto}${i.nivel === 'critico' ? ', zerado' : i.nivel === 'aviso' ? ', baixo' : ''}`}
            style={[
              styles.chip,
              {
                borderColor: i.nivel === 'ok' ? 'transparent' : cor,
                backgroundColor: i.nivel === 'critico' ? c.destructiveSoft : i.nivel === 'aviso' ? c.warnSoft : c.dark ? 'rgba(255,255,255,0.05)' : c.muted,
              },
            ]}
          >
            <Icone nome={i.icone} tam={14} cor={cor} />
            <T peso="bold" tam={12.5} style={{ color: cor }}>
              {i.texto}
            </T>
          </View>
        );
      })}
    </View>
  );
}

function BotaoIcone({ nome, rotulo, onPress, perigo }: { nome: 'copy' | 'edit-2' | 'trash-2' | 'file-text'; rotulo: string; onPress: () => void; perigo?: boolean }) {
  const { c } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btnIcone, { backgroundColor: c.dark ? 'rgba(255,255,255,0.06)' : c.muted, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
    >
      <Icone nome={nome} tam={16} cor={perigo ? c.destructive : c.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  vazio: { padding: 28, alignItems: 'center', gap: 8 },
  card: { padding: 16, gap: 12 },
  topo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  switchCol: { alignItems: 'center', gap: 2 },
  acoes: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  btnIcone: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cabPeriodo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dose: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, height: 54, borderRadius: 16, borderWidth: 1.5 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  atraso: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, borderRadius: 999, borderWidth: 1.5 },
});
