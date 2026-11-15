module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './contexts/**/*.{js,jsx,ts,tsx}', './constants/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
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
        'cherry-soft': '#FEF2F2',
        'emerald-soft': '#ECFDF5',
        'harvest-soft': '#FFFBEB',
      },
      borderRadius: { '3xl': '1.5rem', '4xl': '2rem' },
      boxShadow: {
        card: '0 8px 24px rgba(44, 24, 16, 0.06)',
        lift: '0 12px 30px rgba(44, 24, 16, 0.10)',
      },
    },
  },
  plugins: [],
};
