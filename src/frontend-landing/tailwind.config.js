/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        maroon: { 950: '#230B09', 900: '#3B1210', 800: '#5A1B17' },
        rose: { 100: '#F8D7D3', 300: '#E9B9B3', 400: '#DFA9A2' },
        gold: { DEFAULT: '#E8C27A', deep: '#C8964A' },
      },
      keyframes: {
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slow-zoom': {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.12)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        'fade-in-down': 'fade-in-down 0.2s ease-out',
        'fade-up': 'fade-up 0.9s ease-out both',
        'slow-zoom': 'slow-zoom 18s ease-in-out infinite alternate',
        float: 'float 6s ease-in-out infinite',
        'spin-slow': 'spin-slow 60s linear infinite',
        'spin-slower': 'spin-slow 110s linear infinite reverse',
        marquee: 'marquee 38s linear infinite',
      },
    },
  },
  plugins: [],
};
