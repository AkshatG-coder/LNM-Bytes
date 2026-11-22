/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Haldi yellow: buttons, active states, highlights. Always carries ink text (on-primary).
        primary: {
          light: '#FFD152',
          DEFAULT: '#F5B400',
          dark: '#D99E00',
        },
        'on-primary': '#121B2E',
        // The accent used AS TEXT: dark amber on light surfaces, haldi on dark ones
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        veg: '#1E8E3E',
        nonveg: '#C62828',
        secondary: {
          light: '#fbbf24',
          DEFAULT: '#f59e0b',
          dark: '#b45309',
        },
        accent: '#f43f5e',
        background: '#f8fafc',
        surface: '#ffffff',
        // Dark mode surfaces
        'dark-bg': '#0f172a',
        'dark-surface': '#1e293b',
        'dark-border': '#334155',
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Figtree', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'spin-slow': 'spin 1s linear infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

