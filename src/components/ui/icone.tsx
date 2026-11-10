import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

export type NomeIcone = ComponentProps<typeof Feather>['name'];

export function Icone({ nome, tam = 18, cor }: { nome: NomeIcone; tam?: number; cor: string }) {
  return <Feather name={nome} size={tam} color={cor} />;
}
