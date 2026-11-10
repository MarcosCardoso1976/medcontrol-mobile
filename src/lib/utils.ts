/** YYYY-MM-DD no fuso local do aparelho (mesma função do app web). */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function agoraISO(): string {
  return new Date().toISOString();
}
