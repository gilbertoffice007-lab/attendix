/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e5ff',
          200: '#bcd2ff',
          300: '#8eb5ff',
          400: '#598cff',
          500: '#3563f6',
          600: '#2447eb',
          700: '#1e38d8',
          800: '#1f30af',
          900: '#1e2f8a',
          950: '#171f54',
        },
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#d9dde6',
          300: '#b8bfcd',
          400: '#919bad',
          500: '#737e92',
          600: '#5c6577',
          700: '#4b5261',
          800: '#404652',
          900: '#1f2430',
          950: '#12151c',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.12)',
        'card-hover': '0 2px 4px 0 rgb(15 23 42 / 0.05), 0 16px 32px -16px rgb(15 23 42 / 0.2)',
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
      },
    },
  },
  plugins: [],
}
