import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Confirmar, Dialogo } from '@/components/ui/dialogo';
import { Icone } from '@/components/ui/icone';
import { T } from '@/components/ui/texto';
import { validarNomeLista } from '@/lib/dominio/listas';
import type { ListaLocal } from '@/lib/db/repo';
import { toast } from '@/lib/toast';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';

interface Props {
  listas: ListaLocal[];
  ativaId: string | null;
  onSelecionar: (id: string) => void;
  onCriar: (nome: string) => Promise<unknown>;
  onRenomear: (id: string, nome: string) => Promise<unknown>;
  onExcluir: (id: string) => Promise<unknown>;
  onCopiar: (id: string) => Promise<unknown>;
}

type Modo = { tipo: 'lista' } | { tipo: 'nome'; id?: string } | { tipo: 'excluir'; lista: ListaLocal };

export function HeaderListas({ listas, ativaId, onSelecionar, onCriar, onRenomear, onExcluir, onCopiar }: Props) {
  const { c } = useTema();
  const [modo, setModo] = useState<Modo | null>(null);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const ativa = listas.find((l) => l.id === ativaId);

  const fechar = () => {
    setModo(null);
    setNome('');
    setErro(undefined);
  };

  const salvarNome = async () => {
    const id = modo?.tipo === 'nome' ? modo.id : undefined;
    const e = validarNomeLista(nome, listas, id);
    if (e) return setErro(e);
    if (id) await onRenomear(id, nome.trim());
    else await onCriar(nome.trim());
    toast.sucesso(id ? 'Lista renomeada' : 'Lista criada');
    fechar();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Lista ativa: ${ativa?.nome ?? 'nenhuma'}. Toque para trocar de lista`}
        onPress={() => setModo({ tipo: 'lista' })}
        style={({ pressed }) => [styles.botao, { backgroundColor: c.dark ? 'rgba(255,255,255,0.06)' : c.muted, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <Icone nome="list" tam={16} cor={c.primaryLight} />
        <T peso="bold" tam={14} numberOfLines={1} style={{ maxWidth: 130 }}>
          {ativa?.nome ?? 'Listas'}
        </T>
        <Icone nome="chevron-down" tam={16} cor={c.mutedForeground} />
      </Pressable>

      <Dialogo aberto={modo?.tipo === 'lista'} onFechar={fechar} titulo="Minhas listas" descricao="Escolha qual lista de remédios exibir.">
        <View style={{ gap: 8 }}>
          {listas.map((l) => {
            const sel = l.id === ativaId;
            return (
              <View
                key={l.id}
                style={[styles.item, { borderColor: sel ? c.primaryBorder : c.border, backgroundColor: sel ? c.primarySoft : 'transparent' }]}
              >
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={l.nome}
                  onPress={() => {
                    onSelecionar(l.id);
                    fechar();
                  }}
                  style={styles.itemNome}
                >
                  <Icone nome={sel ? 'check-circle' : 'circle'} tam={18} cor={sel ? c.primary : c.mutedForeground} />
                  <T peso="bold" tam={14.5} numberOfLines={1} style={{ flex: 1 }}>
                    {l.nome}
                  </T>
                </Pressable>
                <Mini nome="copy" rotulo={`Copiar lista ${l.nome}`} onPress={async () => { await onCopiar(l.id); toast.sucesso('Lista copiada'); fechar(); }} />
                <Mini nome="edit-2" rotulo={`Editar nome da lista ${l.nome}`} onPress={() => { setNome(l.nome); setModo({ tipo: 'nome', id: l.id }); }} />
                {listas.length > 1 ? <Mini nome="trash-2" rotulo={`Excluir lista ${l.nome}`} perigo onPress={() => setModo({ tipo: 'excluir', lista: l })} /> : null}
              </View>
            );
          })}
          <Botao titulo="Nova lista" icone="plus" variante="contorno" onPress={() => { setNome(''); setModo({ tipo: 'nome' }); }} />
        </View>
      </Dialogo>

      <Dialogo
        aberto={modo?.tipo === 'nome'}
        onFechar={fechar}
        titulo={modo?.tipo === 'nome' && modo.id ? 'Editar nome' : 'Nova lista'}
        acoes={
          <>
            <Botao titulo="Cancelar" variante="contorno" onPress={fechar} estilo={{ flex: 1 }} />
            <Botao titulo="Salvar" onPress={salvarNome} estilo={{ flex: 1 }} />
          </>
        }
      >
        <Campo
          rotulo="Nome da lista"
          value={nome}
          onChangeText={(t) => {
            setNome(t);
            setErro(undefined);
          }}
          maxLength={60}
          autoFocus
          erro={erro}
          returnKeyType="done"
          onSubmitEditing={salvarNome}
        />
      </Dialogo>

      <Confirmar
        aberto={modo?.tipo === 'excluir'}
        titulo="Excluir lista?"
        descricao={modo?.tipo === 'excluir' ? `A lista "${modo.lista.nome}", seus remédios e o histórico serão apagados.` : ''}
        confirmarTexto="Excluir"
        perigo
        onCancelar={fechar}
        onConfirmar={async () => {
          if (modo?.tipo === 'excluir') await onExcluir(modo.lista.id);
          toast.sucesso('Lista excluída');
          fechar();
        }}
      />
    </>
  );
}

function Mini({ nome, rotulo, onPress, perigo }: { nome: 'copy' | 'edit-2' | 'trash-2'; rotulo: string; onPress: () => void; perigo?: boolean }) {
  const { c } = useTema();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={rotulo} onPress={onPress} hitSlop={6} style={styles.mini}>
      <Icone nome={nome} tam={16} cor={perigo ? c.destructive : c.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  botao: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: radius.md },
  item: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md, paddingRight: 4 },
  itemNome: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 12 },
  mini: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
});
