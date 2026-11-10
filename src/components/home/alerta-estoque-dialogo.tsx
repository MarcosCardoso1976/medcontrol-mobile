import { Botao } from '@/components/ui/botao';
import { Dialogo } from '@/components/ui/dialogo';
import { Icone } from '@/components/ui/icone';
import { mensagemAlertaEstoque, tituloAlertaEstoque } from '@/lib/dominio/estoque';
import { appStore, fecharAlertaEstoque, useApp } from '@/lib/store';
import { useTema } from '@/theme/theme-provider';

export function AlertaEstoqueDialogo() {
  const { c } = useTema();
  const alerta = useApp((s) => s.alertaEstoque);
  if (!alerta) return null;
  const lista = appStore.get().listas.find((l) => l.id === alerta.remedio.listaId);
  return (
    <Dialogo
      aberto
      onFechar={fecharAlertaEstoque}
      titulo={tituloAlertaEstoque(alerta.alerta)}
      descricao={mensagemAlertaEstoque(alerta.remedio, alerta.alerta, lista?.nome ?? 'Geral')}
      icone={<Icone nome="alert-triangle" cor={c.warn} tam={22} />}
      acoes={<Botao titulo="Entendi" variante="contorno" onPress={fecharAlertaEstoque} estilo={{ flex: 1 }} />}
    />
  );
}
