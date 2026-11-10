/**
 * Tokens de cor — portados de src/app/globals.css do app web.
 * oklch → hex (com mapeamento de gamut). No escuro usamos os hex fixos que o web aplica
 * em abas, switch, progresso, diálogos, toasts e gradientes.
 */
export interface Cores {
  dark: boolean;
  background: string;
  foreground: string;
  card: string;
  surface: string; // diálogos / sheets
  primary: string;
  primaryForeground: string;
  primaryLight: string; // texto de destaque (no escuro #5DE8D0)
  primarySoft: string; // fundo translúcido da cor primária
  primaryBorder: string;
  secondary: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  destructive: string;
  destructiveSoft: string;
  destructiveBorder: string;
  warn: string;
  warnSoft: string;
  border: string;
  input: string;
  headerBg: string;
  headerBorder: string;
  tabActiveBg: string;
  tabActiveText: string;
  switchOff: string;
  overlay: string;
  calGradient: [string, string];
  addGradient: [string, string];
  progressGradient: [string, string];
  shadow: string;
  shadowOpacity: number;
}

export const light: Cores = {
  dark: false,
  background: '#F9FBF8',
  foreground: '#030C07',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  primary: '#11D463',
  primaryForeground: '#FFFFFF',
  primaryLight: '#0DA54D',
  primarySoft: 'rgba(17,212,99,0.12)',
  primaryBorder: 'rgba(17,212,99,0.30)',
  secondary: '#EFF3ED',
  muted: '#EBF4EF',
  mutedForeground: '#586C60',
  accent: '#18DC6A',
  destructive: '#EF4343',
  destructiveSoft: 'rgba(239,67,67,0.10)',
  destructiveBorder: 'rgba(239,67,67,0.30)',
  warn: '#F59E0B',
  warnSoft: 'rgba(245,158,11,0.12)',
  border: '#C8D0CB',
  input: '#D9E0DC',
  headerBg: 'rgba(249,251,248,0.96)',
  headerBorder: 'rgba(200,208,203,0.5)',
  tabActiveBg: '#FFFFFF',
  tabActiveText: '#030C07',
  switchOff: '#D9E0DC',
  overlay: 'rgba(0,0,0,0.45)',
  calGradient: ['#FFFFFF', '#EBF4EF'],
  addGradient: ['#11D463', '#0DA54D'],
  progressGradient: ['#11D463', '#18DC6A'],
  shadow: '#0F1D40',
  shadowOpacity: 0.08,
};

export const dark: Cores = {
  dark: true,
  background: '#000B05',
  foreground: '#E2E6E3',
  card: '#00150A',
  surface: '#0D2E22',
  primary: '#1BB89A',
  primaryForeground: '#FFFFFF',
  primaryLight: '#5DE8D0',
  primarySoft: 'rgba(27,184,154,0.12)',
  primaryBorder: 'rgba(27,184,154,0.30)',
  secondary: '#001C10',
  muted: '#0C1F17',
  mutedForeground: '#8A918D',
  accent: '#1BB89A',
  destructive: '#F87171',
  destructiveSoft: 'rgba(248,113,113,0.12)',
  destructiveBorder: 'rgba(248,113,113,0.30)',
  warn: '#FB923C',
  warnSoft: 'rgba(251,146,60,0.14)',
  border: 'rgba(255,255,255,0.07)',
  input: 'rgba(255,255,255,0.07)',
  headerBg: 'rgba(8,31,24,0.94)',
  headerBorder: 'rgba(27,184,154,0.12)',
  tabActiveBg: '#0D2E22',
  tabActiveText: '#5DE8D0',
  switchOff: 'rgba(255,255,255,0.12)',
  overlay: 'rgba(0,0,0,0.65)',
  calGradient: ['#0D4A3A', '#081F18'],
  addGradient: ['#1BB89A', '#0E9B80'],
  progressGradient: ['#1BB89A', '#5DE8D0'],
  shadow: '#000000',
  shadowOpacity: 0.3,
};

export const radius = { sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 } as const;

export const fontes = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extra: 'Nunito_800ExtraBold',
  serif: 'Lora_600SemiBold',
} as const;
