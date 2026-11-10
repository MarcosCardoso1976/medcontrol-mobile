import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';
import { Botao } from './botao';
import { T } from './texto';

/** Diálogo centralizado (equivale ao Dialog/AlertDialog do web). */
export function Dialogo({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
  acoes,
  icone,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo?: string;
  descricao?: string;
  children?: ReactNode;
  acoes?: ReactNode;
  icone?: ReactNode;
}) {
  const { c } = useTema();
  return (
    <Modal visible={aberto} transparent animationType="fade" onRequestClose={onFechar} statusBarTranslucent>
      <SafeAreaProvider>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centro}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onFechar} accessibilityLabel="Fechar" />
          <View style={[styles.caixa, { backgroundColor: c.surface, borderColor: c.dark ? 'rgba(255,255,255,0.09)' : c.border }]}>
            {titulo ? (
              <View style={styles.titulo}>
                {icone}
                <T peso="extra" tam={18} style={{ flex: 1 }}>
                  {titulo}
                </T>
              </View>
            ) : null}
            {descricao ? (
              <T tom="suave" tam={14}>
                {descricao}
              </T>
            ) : null}
            {children ? <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">{children}</ScrollView> : null}
            {acoes ? <View style={styles.acoes}>{acoes}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}

export function Confirmar({
  aberto,
  titulo,
  descricao,
  confirmarTexto = 'Confirmar',
  perigo,
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  confirmarTexto?: string;
  perigo?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Dialogo
      aberto={aberto}
      onFechar={onCancelar}
      titulo={titulo}
      descricao={descricao}
      acoes={
        <>
          <Botao titulo="Cancelar" variante="contorno" onPress={onCancelar} estilo={{ flex: 1 }} />
          <Botao titulo={confirmarTexto} variante={perigo ? 'destrutivo' : 'padrao'} onPress={onConfirmar} estilo={{ flex: 1 }} />
        </>
      }
    />
  );
}

/** Folha em tela cheia (equivale ao Dialog `max-sm:inset-0` do web). */
export function Folha({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={aberto} animationType="slide" onRequestClose={onFechar} statusBarTranslucent>
      <SafeAreaProvider>
        <ConteudoFolha onFechar={onFechar} titulo={titulo} descricao={descricao}>
          {children}
        </ConteudoFolha>
      </SafeAreaProvider>
    </Modal>
  );
}

function ConteudoFolha({ onFechar, titulo, descricao, children }: { onFechar: () => void; titulo: string; descricao?: string; children: ReactNode }) {
  const { c } = useTema();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
      <View style={styles.cabecalhoFolha}>
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <T peso="extra" tam={19} centro>
            {titulo}
          </T>
          {descricao ? (
            <T tom="suave" tam={13} centro>
              {descricao}
            </T>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={onFechar}
          hitSlop={12}
          style={[styles.fechar, { backgroundColor: c.dark ? 'rgba(255,255,255,0.06)' : c.muted }]}
        >
          <T peso="bold" tam={16}>
            ✕
          </T>
        </Pressable>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 24 },
  caixa: { borderRadius: radius.xxl, borderWidth: 1.5, padding: 20, gap: 12 },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acoes: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cabecalhoFolha: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  fechar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
