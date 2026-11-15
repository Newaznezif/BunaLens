export const BunaLensTheme = {
  colors: {
    espresso: '#2C1810',
    cherry: '#B91C1C',
    emerald: '#065F46',
    harvest: '#D97706',
    parchment: '#FAF8F5',
    surface: '#FFFFFF',
    line: '#E7E5E4',
    secondary: '#78716C',
    muted: '#A8A29E',
    cherrySoft: '#FEF2F2',
    emeraldSoft: '#ECFDF5',
    harvestSoft: '#FFFBEB',
  },
  radius: { card: 22, control: 14, pill: 999 },
  spacing: { screen: 20, section: 24, card: 16 },
  typography: {
    display: 30,
    heading: 22,
    subheading: 16,
    body: 14,
    caption: 12,
  },
} as const;

export type BunaLensColor = keyof typeof BunaLensTheme.colors;
