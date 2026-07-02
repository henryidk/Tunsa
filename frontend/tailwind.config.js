/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0891b2',
        secondary: '#64748b',
        danger: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        brand: {
          50: '#EEF3FC',
          100: '#DCE7F8',
          200: '#B9D0F2',
          300: '#8FB3E8',
          400: '#5F8FDB',
          500: '#3D6DCC',
          600: '#2856B8',
          700: '#1F429A',
          800: '#1A3577',
          900: '#172C5F',
          950: '#0F1C3D',
        },
        ink: {
          700: '#1B2333',
          800: '#121826',
          900: '#0B0F1A',
        },
      },
      zIndex: {
        '60': '60',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}