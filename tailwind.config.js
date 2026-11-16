module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './contexts/**/*.{js,jsx,ts,tsx}', './constants/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
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
        'cherry-soft': '#F4E8E4',
        'emerald-soft': '#EAF0E9',
        'harvest-soft': '#F5EBDD',
      },
      borderRadius: { '3xl': '1.5rem', '4xl': '2rem' },
      boxShadow: {
        card: '0 5px 18px rgba(36, 23, 16, 0.045)',
        lift: '0 10px 26px rgba(36, 23, 16, 0.08)',
      },
    },
  },
  plugins: [],
};
