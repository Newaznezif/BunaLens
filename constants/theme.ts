export const BunaLensTheme = {
  colors: {
    espresso: '#241710',
    cherry: '#9B3F32',
    emerald: '#365C49',
    harvest: '#A8753F',
    parchment: '#F5F1E9',
    surface: '#FFFDFA',
    line: '#E5DDD1',
    secondary: '#74685E',
    muted: '#A69A8D',
    cherrySoft: '#F4E8E4',
    emeraldSoft: '#EAF0E9',
    harvestSoft: '#F5EBDD',
  },
  radius: { card: 5, control: 8, pill: 999 },
  spacing: { screen: 20, section: 28, card: 16 },
  typography: {
    display: 34,
    heading: 23,
    subheading: 16,
    body: 14,
    caption: 11,
  },
} as const;

export type BunaLensColor = keyof typeof BunaLensTheme.colors;
