/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0a0a0f',
          900: '#111118',
          800: '#1c1c26',
          700: '#2a2a38',
          600: '#3d3d52',
          500: '#5c5c78',
          400: '#8080a0',
          300: '#a0a0be',
          200: '#c8c8dc',
          100: '#e8e8f0',
          50:  '#f4f4f8',
        },
        accent: {
          DEFAULT: '#6c63ff',
          light: '#8b85ff',
          dark: '#4e46d6',
        },
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f59e0b',
      }
    },
  },
  plugins: [],
}
