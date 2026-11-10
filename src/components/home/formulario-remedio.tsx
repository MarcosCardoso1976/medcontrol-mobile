import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Chave } from '@/components/ui/chave';
import { Folha } from '@/components/ui/dialogo';
import { Icone } from '@/components/ui/icone';
import { T } from '@/components/ui/texto';
import { DOSAGEM_POR_MARCA } from '@/lib/dominio/estoque';
import {
  alternarPeriodo,
  estadoInicial,
  montarRemedio,
  validar,
  type Erros,
  type FormState,
  type Marca,
} from '@/lib/dominio/formulario';
import { PERIODOS_ORDEM, PERIODO_EMOJIS, PERIODO_LABELS } from '@/lib/dominio/periodos';
import { generateId } from '@/lib/ids';
import { agoraISO } from '@/lib/utils';
import type { Periodo, Remedio } from '@/types/remedio';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';
import { AutocompleteMedicamento } from './autocomplete-medicamento';
import { CampoHora } from './campo-hora';

export type ModoFormulario = 'novo' | 'editar' | 'duplicar';

const TITULOS: Record<ModoFormulario, { t: string; d: string }> = {
  novo: { t: 'Novo Remédio', d: 'Adicione um novo remédio ao seu controle' },
  editar: { t: 'Editar Remédio', d: 'Altere os detalhes do medicamento selecionado' },
  duplicar: { t: 'Duplicar Remédio', d: 'Ajuste os detalhes da cópia do medicamento' },
};

interface Props {
  aberto: boolean;
  modo: ModoFormulario;
  remedio: Remedio | null;
  listaId: string;
  onFechar: () => void;
  onSalvar: (r: Remedio) => Promise<void> | void;
}

export function FormularioRemedio({ aberto, modo, remedio, listaId, onFechar, onSalvar }: Props) {
  return (
    <Folha aberto={aberto} onFechar={onFechar} titulo={TITULOS[modo].t} descricao={TITULOS[modo].d}>
      {aberto ? <Corpo modo={modo} remedio={remedio} listaId={listaId} onFechar={onFechar} onSalvar={onSalvar} /> : null}
    </Folha>
  );
}

function Corpo({ modo, remedio, listaId, onFechar, onSalvar }: Omit<Props, 'aberto'>) {
  const { c } = useTema();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<FormState>(() => estadoInicial(remedio, generateId));
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const rolagem = useRef<{ scrollTo: (o: { y: number; animated?: boolean }) => void } | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((e) => ({ ...e, [k]: v }));
  const existente = modo === 'editar' ? remedio : null;
  const temDias = useMemo(() => f.periodos.some((p) => f.modos[p] === 'dias'), [f.periodos, f.modos]);

  const salvar = async () => {
    const e = validar(f);
    setErros(e);
    if (Object.keys(e).length > 0) {
      rolagem.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(montarRemedio(f, existente, listaId, generateId, agoraISO()));
      onFechar();
    } finally {
      setSalvando(false);
    }
  };

  const horarioMod = (p: Periodo, i: number, parcial: Partial<{ horario: string; anotacao: string }>) =>
    setF((e) => ({
      ...e,
      horarios: { ...e.horarios, [p]: e.horarios[p].map((h, idx) => (idx === i ? { ...h, ...parcial } : h)) },
    }));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={(r) => { rolagem.current = r; }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        {Object.keys(erros).length > 0 ? (
          <View accessibilityRole="alert" style={[styles.resumo, { backgroundColor: c.destructiveSoft, borderColor: c.destructiveBorder }]}>
            <Icone nome="alert-circle" cor={c.destructive} />
            <T tam={13} peso="bold" tom="destrutivo" style={{ flex: 1 }}>
              Corrija os campos destacados para salvar.
            </T>
          </View>
        ) : null}

        <AutocompleteMedicamento valor={f.nome} onChange={(v) => set('nome', v)} erro={erros.nome} />

        <View style={{ gap: 8 }}>
          <T peso="bold" tam={13}>
            Períodos
          </T>
          <View style={styles.chips}>
            {PERIODOS_ORDEM.map((p) => {
              const ativo = f.periodos.includes(p);
              return (
                <Pressable
                  key={p}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ativo }}
                  accessibilityLabel={PERIODO_LABELS[p]}
                  onPress={() => setF((e) => alternarPeriodo(e, p, generateId))}
                  style={[
                    styles.chipPeriodo,
                    { borderColor: ativo ? c.primary : c.input, backgroundColor: ativo ? c.primarySoft : 'transparent' },
                  ]}
                >
                  <T tam={18}>{PERIODO_EMOJIS[p]}</T>
                  <T peso="bold" tam={13.5} style={{ color: ativo ? c.primaryLight : c.foreground }}>
                    {PERIODO_LABELS[p]}
                  </T>
                </Pressable>
              );
            })}
          </View>
          {erros.periodos ? (
            <T tam={12} tom="destrutivo" peso="medium">
              {erros.periodos}
            </T>
          ) : null}
        </View>

        {f.periodos.map((p) => (
          <Bloco key={p} titulo={`${PERIODO_EMOJIS[p]} ${PERIODO_LABELS[p]}`}>
            {f.horarios[p].map((h, i) => (
              <View key={h.id} style={{ gap: 8 }}>
                <View style={styles.linhaHora}>
                  <CampoHora valor={h.horario} rotulo={`Horário ${i + 1} da ${PERIODO_LABELS[p]}`} onChange={(v) => horarioMod(p, i, { horario: v })} />
                  <View style={{ flex: 1 }}>
                    <Campo
                      value={h.anotacao}
                      onChangeText={(t) => horarioMod(p, i, { anotacao: t })}
                      placeholder="Anotação (opcional)"
                      accessibilityLabel={`Anotação do horário ${h.horario}`}
                    />
                  </View>
                  {f.horarios[p].length > 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remover horário ${h.horario}`}
                      hitSlop={8}
                      onPress={() => setF((e) => ({ ...e, horarios: { ...e.horarios, [p]: e.horarios[p].filter((_, idx) => idx !== i) } }))}
                      style={styles.remover}
                    >
                      <Icone nome="x" tam={18} cor={c.destructive} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
            {erros[`horarios_${p}`] ? (
              <T tam={12} tom="destrutivo" peso="medium">
                {erros[`horarios_${p}`]}
              </T>
            ) : null}
            <Botao
              titulo="Adicionar horário"
              icone="plus"
              variante="contorno"
              tamanho="sm"
              onPress={() => {
                const ultimo = f.horarios[p][f.horarios[p].length - 1]?.horario ?? '08:00';
                const [h, m] = ultimo.split(':').map(Number);
                const prox = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                setF((e) => ({ ...e, horarios: { ...e.horarios, [p]: [...e.horarios[p], { id: generateId(), horario: prox, anotacao: '' }] } }));
              }}
              estilo={{ alignSelf: 'flex-start' }}
            />
            <LinhaSwitch
              titulo="Diário"
              dica="Sem data para terminar"
              valor={f.modos[p] === 'diario'}
              onChange={(v) => setF((e) => ({ ...e, modos: { ...e.modos, [p]: v ? 'diario' : 'nenhum' } }))}
            />
            <LinhaSwitch
              titulo="Dias de tratamento"
              dica="Termina após alguns dias"
              valor={f.modos[p] === 'dias'}
              onChange={(v) => setF((e) => ({ ...e, modos: { ...e.modos, [p]: v ? 'dias' : 'nenhum' } }))}
            />
          </Bloco>
        ))}

        {temDias ? (
          <Campo
            rotulo="Quantidade de dias de tratamento"
            keyboardType="number-pad"
            value={f.diasDeTratamento}
            onChangeText={(t) => set('diasDeTratamento', t.replace(/[^0-9]/g, ''))}
            placeholder="Ex.: 7"
            erro={erros.diasDeTratamento}
          />
        ) : null}

        <T peso="extra" tam={16} style={{ marginTop: 6 }}>
          Controle de estoque
        </T>

        <Bloco titulo="📦 Estoque (unidades)" interruptor={{ valor: f.estoque, onChange: (v) => set('estoque', v), rotulo: 'Ativar estoque em unidades' }}>
          {f.estoque ? (
            <View style={{ gap: 10 }}>
              <Campo rotulo="Quantidade em estoque" keyboardType="number-pad" value={f.quantidadeEstoque} onChangeText={(t) => set('quantidadeEstoque', t.replace(/[^0-9]/g, ''))} erro={erros.quantidadeEstoque} />
              <Campo rotulo="Avisar quando restar" keyboardType="number-pad" value={f.alertaEstoque} onChangeText={(t) => set('alertaEstoque', t.replace(/[^0-9]/g, ''))} erro={erros.alertaEstoque} dica="Opcional" />
            </View>
          ) : null}
        </Bloco>

        <Bloco titulo="💧 Controle de volume" interruptor={{ valor: f.volume, onChange: (v) => set('volume', v), rotulo: 'Ativar controle de volume' }}>
          {f.volume ? (
            <View style={{ gap: 10 }}>
              <Seletor
                rotulo="Unidade"
                opcoes={(['ml', 'g', 'gotas'] as const).map((u) => ({ chave: u, texto: u }))}
                valor={f.unidadeVolume}
                onChange={(v) => set('unidadeVolume', v)}
              />
              <Campo rotulo="Volume total" keyboardType="decimal-pad" value={f.totalVolume} onChangeText={(t) => set('totalVolume', t)} erro={erros.totalVolume} />
              <Campo rotulo="Dosagem por dose" keyboardType="decimal-pad" value={f.dosagemPorDose} onChangeText={(t) => set('dosagemPorDose', t)} erro={erros.dosagemPorDose} />
              <Campo rotulo="Volume restante" keyboardType="decimal-pad" value={f.restanteVolume} onChangeText={(t) => set('restanteVolume', t)} erro={erros.restanteVolume} dica="Vazio = volume total" />
              <Campo rotulo="Avisar quando restar" keyboardType="decimal-pad" value={f.alertaVolume} onChangeText={(t) => set('alertaVolume', t)} erro={erros.alertaVolume} dica="Opcional" />
            </View>
          ) : null}
        </Bloco>

        <Bloco titulo="💉 Controle de dosagem (canetas)" interruptor={{ valor: f.dosagem, onChange: (v) => set('dosagem', v), rotulo: 'Ativar controle de dosagem' }}>
          {f.dosagem ? (
            <View style={{ gap: 10 }}>
              <Seletor
                rotulo="Medicamento"
                opcoes={(Object.keys(DOSAGEM_POR_MARCA) as Marca[]).map((m) => ({ chave: m, texto: DOSAGEM_POR_MARCA[m].rotulo }))}
                valor={f.marca}
                onChange={(m) => setF((e) => ({ ...e, marca: m, dosagemDiaria: (DOSAGEM_POR_MARCA[m].doses as readonly number[]).includes(Number(e.dosagemDiaria)) ? e.dosagemDiaria : '' }))}
              />
              <Seletor
                rotulo="Dose diária (mg)"
                opcoes={DOSAGEM_POR_MARCA[f.marca].doses.map((d) => ({ chave: String(d), texto: String(d).replace('.', ',') }))}
                valor={f.dosagemDiaria}
                onChange={(v) => set('dosagemDiaria', v)}
                erro={erros.dosagemDiaria}
              />
              <Campo rotulo="Restante (mg)" keyboardType="decimal-pad" value={f.restanteDosagem} onChangeText={(t) => set('restanteDosagem', t)} erro={erros.restanteDosagem} dica={`Vazio = ${DOSAGEM_POR_MARCA[f.marca].total} mg (caneta cheia)`} />
              <Campo rotulo="Dias em tratamento (0 a 90)" keyboardType="number-pad" value={f.diasEmTratamento} onChangeText={(t) => set('diasEmTratamento', t.replace(/[^0-9]/g, ''))} erro={erros.diasEmTratamento} dica="Opcional · recalcula o restante automaticamente" />
              <Campo rotulo="Avisar quando restarem (dias)" keyboardType="number-pad" value={f.alertaDiasDosagem} onChangeText={(t) => set('alertaDiasDosagem', t.replace(/[^0-9]/g, ''))} erro={erros.alertaDiasDosagem} />
              <Campo rotulo="Agulhas (total)" keyboardType="number-pad" value={f.agulhasTotal} onChangeText={(t) => set('agulhasTotal', t.replace(/[^0-9]/g, ''))} erro={erros.agulhasTotal} dica="Opcional" />
              {f.agulhasTotal ? (
                <Campo rotulo="Agulhas restantes" keyboardType="number-pad" value={f.agulhasRestante} onChangeText={(t) => set('agulhasRestante', t.replace(/[^0-9]/g, ''))} erro={erros.agulhasRestante} dica="Vazio = total" />
              ) : null}
            </View>
          ) : null}
        </Bloco>
      </ScrollView>

      <View style={[styles.rodape, { paddingBottom: Math.max(insets.bottom, 12), borderColor: c.border, backgroundColor: c.surface }]}>
        <Botao titulo="Cancelar" variante="contorno" onPress={onFechar} estilo={{ flex: 1 }} />
        <Botao titulo={modo === 'editar' ? 'Salvar' : 'Adicionar'} onPress={salvar} carregando={salvando} estilo={{ flex: 1.4 }} />
      </View>
    </View>
  );
}

function Bloco({
  titulo,
  children,
  interruptor,
}: {
  titulo: string;
  children?: ReactNode;
  interruptor?: { valor: boolean; onChange: (v: boolean) => void; rotulo: string };
}) {
  const { c } = useTema();
  return (
    <View style={[styles.bloco, { borderColor: interruptor?.valor ? c.primaryBorder : c.border, backgroundColor: c.dark ? 'rgba(255,255,255,0.03)' : c.card }]}>
      <View style={styles.blocoTopo}>
        <T peso="extra" tam={15} style={{ flex: 1 }}>
          {titulo}
        </T>
        {interruptor ? <Chave valor={interruptor.valor} onChange={interruptor.onChange} rotulo={interruptor.rotulo} /> : null}
      </View>
      {children}
    </View>
  );
}

function LinhaSwitch({ titulo, dica, valor, onChange }: { titulo: string; dica: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.linhaSwitch}>
      <View style={{ flex: 1 }}>
        <T peso="bold" tam={14}>
          {titulo}
        </T>
        <T tom="suave" tam={12}>
          {dica}
        </T>
      </View>
      <Chave valor={valor} onChange={onChange} rotulo={titulo} />
    </View>
  );
}

function Seletor<K extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
  erro,
}: {
  rotulo: string;
  opcoes: { chave: K; texto: string }[];
  valor: string;
  onChange: (v: K) => void;
  erro?: string;
}) {
  const { c } = useTema();
  return (
    <View style={{ gap: 6 }}>
      <T peso="bold" tam={13}>
        {rotulo}
      </T>
      <View style={styles.chips}>
        {opcoes.map((o) => {
          const ativo = o.chave === valor;
          return (
            <Pressable
              key={o.chave}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={o.texto}
              onPress={() => onChange(o.chave)}
              style={[styles.opcao, { borderColor: ativo ? c.primary : c.input, backgroundColor: ativo ? c.primarySoft : 'transparent' }]}
            >
              <T peso="bold" tam={13} style={{ color: ativo ? c.primaryLight : c.foreground }}>
                {o.texto}
              </T>
            </Pressable>
          );
        })}
      </View>
      {erro ? (
        <T tam={12} tom="destrutivo" peso="medium">
          {erro}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { padding: 20, gap: 16, paddingBottom: 32 },
  resumo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipPeriodo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 46, borderRadius: radius.md, borderWidth: 1.5 },
  bloco: { borderWidth: 1.5, borderRadius: radius.lg, padding: 14, gap: 12 },
  blocoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linhaHora: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  remover: { width: 40, height: 46, alignItems: 'center', justifyContent: 'center' },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  opcao: { paddingHorizontal: 14, height: 42, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rodape: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1 },
});
