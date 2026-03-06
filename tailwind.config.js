/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // FairPadel Brand Colors - Paleta Mokoto
        primary: {
          DEFAULT: '#df2531',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#df2531', // Brand color
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Transparencias del primary
        'primary-45': 'rgba(223, 37, 49, 0.45)',
        'primary-65': 'rgba(223, 37, 49, 0.65)',
        // Background colors
        dark: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b', // Almost black
        },
        // Utilities
        black: '#000000',
        white: '#ffffff',
      },
      fontFamily: {
        sans: ['Open Sans', 'system-ui', 'sans-serif'],
        display: ['Mokoto', 'Open Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
