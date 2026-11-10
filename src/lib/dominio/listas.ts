export function validarNomeLista(nome: string, existentes: { id: string; nome: string }[], ignorarId?: string): string | null {
  const n = nome.trim();
  if (!n) return 'Nome não pode ser vazio';
  if (n.length > 50) return 'Máximo 50 caracteres';
  const igual = existentes.some((l) => l.id !== ignorarId && l.nome.trim().toLowerCase() === n.toLowerCase());
  if (igual) return 'Nome já existe';
  return null;
}
